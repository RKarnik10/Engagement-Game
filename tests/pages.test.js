/**
 * Both pages, run in Node under a fake page (tests/pages/_dom.js), each in
 * its own worker thread like its own browser tab. This checks the wiring:
 * buttons, keys, links, what is shown, and what is downloaded. It cannot
 * check how anything looks, or real timing and sound.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

const worker = (file, workerData) => new Worker(new URL(`./pages/${file}`, import.meta.url), { workerData });

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
  assert.deepEqual(out.presses.map((p) => [p.kind, p.ring, p.swing]), [
    ['hit', 'white', true], ['hit', 'white', true], ['hit', 'white', true], ['com', 'red', true],
  ]);
  assert.deepEqual(out.presses.map((p) => p.score), ['Score 1', 'Score 2', 'Score 3', 'Score 3']);
  assert.ok(out.presses.every((p) => !p.scoreHidden));
  assert.equal(out.resultsHidden, false, 'results on screen at the end');
  assert.match(out.summary, /^Run finished after 20 of 20 trials\./);
  assert.match(out.summary, /Feedback shown to the player: score\+rings\+sound\+hammer\./);
  assert.match(out.download, /_behavioral_seed1234_score\+rings\+sound\+hammer_run\.csv$/);
});

test('pages: console and display tabs, with pause, early stop, and results that stay', async () => {
  const con = worker('_console.js');
  const c = inbox(con);
  let r = await c.next((m) => m.cmd === 'loaded', 'console');
  assert.equal(r.loadCheckHidden, true);
  assert.match(r.link, /not open/);
  assert.equal(r.startDisabled, true);
  assert.equal(r.share, 'https://example.org/Engagement-Game/display.html?trials=30&distractor=molerat&score=1&results=1',
    'the labmate link carries the settings and turns results on');
  con.postMessage('copy');
  r = await c.next((m) => m.cmd === 'copy', 'copy');
  assert.equal(r.clipboard, r.share);
  assert.equal(r.shareStatus, 'Copied.');

  const disp = worker('_display-linked.js');
  const d = inbox(disp);
  const loaded = await d.next((m) => m.kind === 'loaded', 'display');
  assert.match(loaded.idleText, /Please wait for the task to start/, 'a console-run display does not tell the participant to press T');
  for (;;) {
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
  assert.match(p.score, /^Score [1-9]/, 'the score shows on a console-run display too');

  await d.next((m) => m.kind === 'midrun', 'mid-run');
  con.postMessage('stop');
  const done = await d.next((m) => m.kind === 'done', 'display end');
  assert.equal(done.title, 'Finished');
  assert.equal(done.resultsHidden, true, 'results stay off the participant screen by default');
  for (;;) {
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
    assert.equal(x.csv, 'trial,onset_s,trial_type,good_row,good_col,bad_row,bad_col,correct_action,expected_button,pressed_buttons,first_press_ms,good_hit_ms,good_outcome,bad_outcome,outcome,correct,scheduled_onset_s,onset_lag_ms,preceding_go');
  };
  check(r, 'after End run');
  con.postMessage('touch');
  r = await c.next((m) => m.cmd === 'touch', 'touch');
  check(r, 'after changing a setting');
  con.postMessage('download');
  r = await c.next((m) => m.cmd === 'download', 'download');
  assert.match(r.downloads.at(-1), /_behavioral_seed1234_score_run\.csv$/);
  await con.terminate();
  await disp.terminate();
});
