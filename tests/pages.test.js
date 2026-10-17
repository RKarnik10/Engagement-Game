/**
 * Both pages, run in Node under a fake page (tests/pages/_dom.js), each in
 * its own worker thread like its own browser tab. This checks the wiring:
 * buttons, keys, links, what is shown, and what is downloaded. It cannot
 * check how anything looks, or real timing and sound.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

const open = new Set();
const worker = (file, workerData) => {
  const w = new Worker(new URL(`./pages/${file}`, import.meta.url), { workerData });
  open.add(w);
  w.on('exit', () => open.delete(w));
  return w;
};
// Close every page, pass or fail, so a failing test cannot leave the run hanging.
afterEach(async () => { await Promise.all([...open].map((w) => w.terminate())); open.clear(); });

function inbox(w) {
  const msgs = [];
  w.on('message', (m) => msgs.push(m));
  w.on('error', (e) => msgs.push({ kind: 'error', error: String(e && e.stack || e) }));
  return {
    msgs,
    async next(pred, label, ms = 10000) {
      const t0 = Date.now();
      for (;;) {
        const err = msgs.find((m) => m.kind === 'error');
        if (err) throw new Error(err.error);
        const i = msgs.findIndex(pred);
        if (i >= 0) return msgs.splice(i, 1)[0];
        if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${label}`);
        await new Promise((r) => setTimeout(r, 3));
      }
    },
  };
}

test('pages: a labmate link runs the game alone, with score, rings, sound, and hammer', async () => {
  const w = worker('_display-standalone.js', { search: '?trials=20&score=1&rings=1&sound=1&hammer=1&results=1' });
  const box = inbox(w);
  const out = await box.next(() => true, 'the display');
  assert.match(out.idleText, /press <kbd>T<\/kbd> to start/i, 'tells the tester how to start');
  assert.equal(out.scoreHiddenIdle, true);
  assert.equal(out.started, true, 'T starts the run');
  // Presses in time order: hits on happy moles, one empty-column press, one sad mole hit.
  const moles = out.presses.filter((p) => p.kind !== 'empty');
  const emptyPress = out.presses.find((p) => p.kind === 'empty');
  assert.deepEqual(moles.map((p) => [p.kind, p.ring, p.swing]), [
    ['hit', 'white', true], ['hit', 'white', true], ['hit', 'white', true], ['com', 'red', true],
  ]);
  // Sound only when a mole is hit: two good tones for a happy mole, one bad for a sad one.
  assert.deepEqual(moles.map((p) => p.sounds), ['good,good', 'good,good', 'good,good', 'bad']);
  assert.equal(emptyPress.sounds, '', 'an empty-column press is silent');
  assert.equal(emptyPress.swing, false, 'and gets no hammer');
  // Hammer on: a hit mole stays up, struck, until the hammer lands, then sinks.
  assert.ok(moles.every((p) => p.struck && p.stillShown), 'each hit mole waits for the hammer');
  assert.equal(out.leftUp, 0, 'every struck mole is gone once the hammer finishes');
  assert.equal(out.leftStruck, 0);
  assert.equal(out.sceneGarden, true, 'the garden scene is the default');
  const { resolveConfig } = await import('../src/config.js');
  const { buildSchedule } = await import('../src/schedule.js');
  const sched = buildSchedule(resolveConfig({ nTrials: 20 }));
  const bad = sched.find((t) => t.type === 'bad');
  const goodBefore = sched.filter((t) => t.trial < bad.trial && t.type !== 'bad').length;
  const after = (100 * (3 - 3)) / goodBefore;   // three hits, then the default -3
  assert.deepEqual(moles.map((p) => p.score),
    ['Score 100%', 'Score 100%', 'Score 100%', `Score ${Math.round(after)}%`]);
  // The bar: full and green at 100%; at 0% it empties and turns dark red.
  assert.deepEqual(moles.map((p) => [p.fill, p.band]),
    [['100%', 'high'], ['100%', 'high'], ['100%', 'high'], ['0%', 'low']]);
  assert.deepEqual(moles.map((p) => p.color), ['#3FA34D', '#3FA34D', '#3FA34D', '#7A1414'], 'green when perfect, dark red at zero');
  assert.ok(out.presses.every((p) => p.roomMade), 'the grid moves down to make room');
  assert.ok(out.presses.every((p) => !p.scoreHidden));
  assert.equal(out.resultsHidden, false, 'results on screen at the end');
  assert.match(out.summary, /^Run finished after 20 of 20 trials\./);
  assert.match(out.summary, /Feedback shown to the player: score\+rings\+sound\+hammer\./);
  // Auto-save: a labmate link saves all three files itself when the run ends.
  assert.equal(out.autoSaved.length, 3, `auto-saved: ${out.autoSaved.join(', ')}`);
  assert.deepEqual(out.autoSaved.map((n) => n.split('_').at(-1)), ['run.csv', 'events.tsv', 'log.json']);
  assert.ok(out.autoSaved.every((n) => n.startsWith('engagement-game_')), 'no participant ID in the link: unlabelled names');
  assert.match(out.download, /_behavioral_seed1234_score\+rings\+sound\+hammer_run\.csv$/, 'the button still works too');
});

test('pages: console and display tabs, with pause, early stop, and results that stay', async () => {
  const con = worker('_console.js');
  const c = inbox(con);
  let r = await c.next((m) => m.cmd === 'loaded', 'console');
  assert.equal(r.loadCheckHidden, true);
  assert.match(r.link, /not open/);
  assert.equal(r.startDisabled, true);
  assert.equal(r.share, 'https://example.org/Engagement-Game/display.html?trials=30&run=2&distractor=molerat&sub=07&results=1',
    'the labmate link carries the settings and turns results on');
  con.postMessage('copy');
  r = await c.next((m) => m.cmd === 'copy', 'copy');
  assert.equal(r.clipboard, r.share);
  assert.equal(r.shareStatus, 'Copied.');

  const disp = worker('_display-linked.js');
  const d = inbox(disp);
  const loaded = await d.next((m) => m.kind === 'loaded', 'display');
  assert.match(loaded.idleText, /Please wait for the task to start/, 'a console-run display does not tell the participant to press T');
  for (let i = 0; ; i++) {
    assert.ok(i < 2000, 'display never connected');
    con.postMessage('report');
    r = await c.next((m) => m.cmd === 'report', 'report');
    if (/connected, ready/.test(r.link)) break;
    await new Promise((res) => setTimeout(res, 5));
  }
  con.postMessage('start');
  const p = await d.next((m) => m.kind === 'paused', 'pause');
  assert.equal(p.title, 'Paused');
  assert.equal(p.framesStopped, true, 'no frames while paused');
  assert.equal(p.resumed, true);
  assert.match(p.score, /^Score -?\d+%$/, 'the score shows on a console-run display too');

  await d.next((m) => m.kind === 'midrun', 'mid-run');
  con.postMessage('stop');
  const done = await d.next((m) => m.kind === 'done', 'display end');
  assert.equal(done.title, 'Finished');
  assert.equal(done.resultsHidden, true, 'results stay off the participant screen by default');
  for (let i = 0; ; i++) {
    assert.ok(i < 2000, 'console never received the finished run');
    con.postMessage('report');
    r = await c.next((m) => m.cmd === 'report', 'report');
    if (!r.dlDisabled) break;
    await new Promise((res) => setTimeout(res, 5));
  }
  const check = (x, when) => {
    assert.match(x.summary, /Run ended early after \d+ of 30 trials/, `${when}: summary`);
    assert.match(x.summary, /Feedback shown to the player: score\./, `${when}: variant`);
    assert.match(x.hits, /^[1-9]\d* \/ \d+$/, `${when}: hits`);
    assert.equal(x.pauses, '1 (2.0 s)', `${when}: pauses`);
    assert.match(x.trace, /class="vtc"/, `${when}: trace`);
    assert.equal(x.csv, 'participant,run,trial,onset_s,trial_type,good_row,good_col,bad_row,bad_col,correct_action,expected_button,n_presses,press_1_button,press_1_ms,press_2_button,press_2_ms,press_3_button,press_3_ms,press_4_button,press_4_ms,press_5_button,press_5_ms,first_press_ms,good_hit_ms,good_outcome,bad_outcome,outcome,correct,score_points,score_pct,scheduled_onset_s,onset_lag_ms,preceding_go');
  };
  check(r, 'after End run');
  con.postMessage('touch');
  r = await c.next((m) => m.cmd === 'touch', 'touch');
  check(r, 'after changing a setting');
  // Auto-save: the console saved all three files once, labelled with participant and run.
  await new Promise((res) => setTimeout(res, 1000));
  con.postMessage('report');
  r = await c.next((m) => m.cmd === 'report', 'report');
  assert.equal(r.downloads.length, 3, `auto-saved once: ${r.downloads.join(', ')}`);
  for (const n of r.downloads) assert.match(n, /^sub-07_task-whacamole_run-02_\d{8}-\d{6}_behavioral_seed1234_score_(run\.csv|events\.tsv|log\.json)$/);
  assert.match(r.saveStatus, /^Saved automatically to your downloads folder/);
  con.postMessage('download');
  r = await c.next((m) => m.cmd === 'download', 'download');
  assert.equal(r.downloads.length, 4, 'the button adds one more');
  assert.match(r.downloads.at(-1), /^sub-07_task-whacamole_run-02_.*_score_run\.csv$/);
  // Changing a setting afterwards must not save the run again.
  con.postMessage('touch');
  r = await c.next((m) => m.cmd === 'touch', 'touch');
  assert.equal(r.downloads.length, 4, 'no second auto-save');
});
