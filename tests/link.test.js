/**
 * The console and the participant display in separate "tabs": a real
 * BroadcastChannel (built into Node) between a display session and a console
 * link, with the display driven by a fake clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { createDisplaySession } from '../src/session.js';
import { createConsoleLink, MSG, CONSOLE_ID } from '../src/link.js';
import { buildRunCSV } from '../src/export.js';

let counter = 0;
const channelName = () => `engagement-game-test-${process.pid}-${++counter}`;

async function waitFor(pred, label, ms = 3000) {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 2));
  }
}

/** A display "tab" with a fake clock and a recording view. */
function openDisplay(name, id) {
  const channel = new BroadcastChannel(name);
  let now = 0;
  let pending = null;
  const seen = { idle: [], ups: [], downs: [], ended: [], errors: [], paused: [] };
  const session = createDisplaySession({
    channel,
    displayId: id,
    clock: () => now,
    raf: (fn) => { pending = fn; return 1; },
    caf: () => { pending = null; },
    userAgent: 'node-test',
    now: () => new Date('2026-09-25T12:00:00Z'),
    view: {
      idle: (c) => seen.idle.push(c),
      moleUp: (hole, stim) => seen.ups.push([hole, stim]),
      moleDown: (hole) => seen.downs.push(hole),
      ended: (reason) => seen.ended.push(reason),
      paused: (on) => seen.paused.push(on),
      error: (m) => seen.errors.push(m),
    },
  });
  /** Run frames until the run ends, pressing as scheduled. */
  function drive(presses = [], frameMs = 1000 / 60) {
    const queue = presses.slice().sort((a, b) => a.tMs - b.tMs);
    while (pending) {
      const next = now + frameMs;
      while (queue.length && queue[0].tMs <= next) {
        const p = queue.shift();
        now = Math.max(now, p.tMs);
        session.press(p.button, 'test');
      }
      now = next;
      const fn = pending; pending = null; fn();
    }
  }
  const advance = (ms) => { now += ms; };
  return { channel, session, seen, drive, advance, close: () => channel.close() };
}

function openConsole(name) {
  const channel = new BroadcastChannel(name);
  const got = { states: [], events: [], trials: [], runs: [], errors: [] };
  const link = createConsoleLink({
    channel,
    onChange: (s) => got.states.push(s),
    onEvent: (record, trial) => { got.events.push(record); if (trial) got.trials.push(trial); },
    onRun: (run) => got.runs.push(run),
    onError: (m) => got.errors.push(m),
  });
  return { channel, link, got, close: () => { link.close(); channel.close(); } };
}

const small = () => resolveConfig({ seed: 99, nTrials: 30 });

test('link: a display that opens gets the console settings and reports ready', async () => {
  const name = channelName();
  const con = openConsole(name);
  con.link.setConfig(small());
  const disp = openDisplay(name, 'display-A');
  await waitFor(() => con.link.state().connected && disp.session.config().nTrials === 30, 'display to take the settings');
  assert.equal(con.link.state().current, 'display-A');
  assert.equal(con.link.state().phase, 'idle');
  assert.equal(disp.seen.idle.at(-1).seed, 99);
  disp.close(); con.close();
});

test('link: start from the console, play in the display, and the whole run comes back', async () => {
  const name = channelName();
  const con = openConsole(name);
  const disp = openDisplay(name, 'display-A');
  con.link.setConfig(small());
  await waitFor(() => disp.session.config().nTrials === 30, 'settings');

  assert.equal(con.link.start(), true);
  await waitFor(() => disp.session.isRunning(), 'display to start');
  await waitFor(() => con.link.state().phase === 'running', 'console to see running');

  const schedule = disp.session.engine().trials();
  const t1 = schedule[0];
  disp.drive([{ tMs: t1.scheduledOnsetMs + 280, button: t1.targets[0].response }]);
  await waitFor(() => con.got.runs.length === 1, 'the finished run');

  const run = con.got.runs[0];
  assert.equal(run.displayId, 'display-A');
  assert.equal(run.trials.length, 30);
  assert.equal(run.trials[0].outcome, 'hit');
  assert.equal(run.events[0].event, 'trigger');
  assert.equal(run.events[0].source, 'console');
  assert.equal(run.events.at(-1).event, 'run_end');
  assert.equal(run.created, '2026-09-25T12:00:00.000Z');
  // Every logged event also streamed live, and every trial arrived with trial_end.
  await waitFor(() => con.got.events.length === run.events.length, 'the live event stream');
  assert.deepEqual(con.got.events.map((e) => e.event), run.events.map((e) => e.event));
  assert.equal(con.got.trials.length, 30);
  // The display drew each mole up and took each one down.
  const moles = run.trials.reduce((n, t) => n + t.targets.length, 0);
  assert.equal(disp.seen.ups.length, moles);
  assert.equal(disp.seen.downs.length, moles);
  assert.deepEqual(disp.seen.ended, ['completed']);
  // The console can build the export from what it received.
  const csv = buildRunCSV(run.trials);
  assert.equal(csv.trim().split('\n').length, 31);
  disp.close(); con.close();
});

test('link: the trigger key in the display starts a run on its own, and a second trigger is a pulse', async () => {
  const name = channelName();
  const con = openConsole(name);
  const disp = openDisplay(name, 'display-A');
  con.link.setConfig(small());
  await waitFor(() => disp.session.config().nTrials === 30, 'settings');
  disp.session.trigger('key t');
  disp.advance(1500);
  disp.session.trigger('key t');
  disp.session.stop();
  await waitFor(() => con.got.runs.length === 1, 'the stopped run');
  const ev = con.got.runs[0].events;
  assert.equal(ev[0].source, 'key t');
  assert.ok(ev.some((e) => e.event === 'volume' && e.simulated === false && e.t_ms === 1500));
  assert.equal(ev.at(-1).reason, 'stopped');
  disp.close(); con.close();
});

test('link: with two displays open, Start goes only to the current one, and the console warns', async () => {
  const name = channelName();
  const con = openConsole(name);
  const a = openDisplay(name, 'display-A');
  await waitFor(() => con.link.state().connected, 'first display');
  const b = openDisplay(name, 'display-B');
  await waitFor(() => con.link.state().displayCount === 2, 'second display');
  assert.equal(con.link.state().current, 'display-B', 'the newest display is the one commanded');
  con.link.start();
  await waitFor(() => b.session.isRunning(), 'display B to start');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(a.session.isRunning(), false, 'display A ignored the start');
  b.session.stop();
  a.close(); b.close(); con.close();
});

test('link: settings are ignored while a run is going', async () => {
  const name = channelName();
  const con = openConsole(name);
  const disp = openDisplay(name, 'display-A');
  con.link.setConfig(small());
  await waitFor(() => disp.session.config().nTrials === 30, 'settings');
  disp.session.trigger('key t');
  con.link.setConfig(resolveConfig({ seed: 5, nTrials: 90 }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(disp.session.config().nTrials, 30);
  disp.session.stop();
  disp.close(); con.close();
});

test('link: a reloaded console gets the last finished run back', async () => {
  const name = channelName();
  const first = openConsole(name);
  const disp = openDisplay(name, 'display-A');
  first.link.setConfig(small());
  await waitFor(() => disp.session.config().nTrials === 30, 'settings');
  disp.session.trigger('key t');
  disp.drive();
  await waitFor(() => first.got.runs.length === 1, 'first console to get the run');
  first.close();

  const second = openConsole(name);
  second.link.hello();
  await waitFor(() => second.got.runs.length === 1, 'reloaded console to recover the run');
  assert.equal(second.got.runs[0].runId, first.got.runs[0].runId);
  assert.equal(second.got.runs[0].trials.length, 30);
  disp.close(); second.close();
});

test('link: hiding the display tab during a run is logged', async () => {
  const name = channelName();
  const con = openConsole(name);
  const disp = openDisplay(name, 'display-A');
  con.link.setConfig(small());
  await waitFor(() => disp.session.config().nTrials === 30, 'settings');
  assert.equal(disp.session.visibility(true), null, 'nothing to log before a run');
  disp.session.trigger('key t');
  disp.advance(3000);
  disp.session.visibility(true);
  disp.advance(2000);
  disp.session.visibility(false);
  disp.session.stop();
  await waitFor(() => con.got.runs.length === 1, 'run');
  const notes = con.got.runs[0].events.filter((e) => e.event.startsWith('display_'));
  assert.deepEqual(notes.map((e) => [e.event, e.t_ms]), [['display_hidden', 3000], ['display_visible', 5000]]);
  disp.close(); con.close();
});

test('link: bad settings are refused by the display and reported to the console', async () => {
  const name = channelName();
  const con = openConsole(name);
  const disp = openDisplay(name, 'display-A');
  await waitFor(() => con.link.state().connected, 'display');
  con.channel.postMessage({ from: CONSOLE_ID, type: MSG.CONFIG, config: { goodShare: 0.9 } });
  await waitFor(() => con.got.errors.length === 1, 'the error');
  assert.match(con.got.errors[0], /add up to 1/);
  assert.equal(disp.session.config().goodShare, 0.8, 'the display kept its previous settings');
  disp.close(); con.close();
});

test('link: a display that closes says goodbye', async () => {
  const name = channelName();
  const con = openConsole(name);
  const disp = openDisplay(name, 'display-A');
  await waitFor(() => con.link.state().connected, 'display');
  disp.session.bye();
  await waitFor(() => !con.link.state().connected, 'console to drop the display');
  assert.equal(con.link.start(), false, 'nothing to start');
  disp.close(); con.close();
});

test('link: pause and resume from the console; the console sees the pause', async () => {
  const name = channelName();
  const con = openConsole(name);
  const disp = openDisplay(name, 'display-A');
  con.link.setConfig(small());
  await waitFor(() => disp.session.config().nTrials === 30, 'settings');
  assert.equal(con.link.pause(), true);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(disp.session.isPaused(), false, 'nothing to pause before a run');
  disp.session.trigger('key t');
  disp.advance(2500);
  con.link.pause();
  await waitFor(() => disp.session.isPaused(), 'display to pause');
  await waitFor(() => con.link.state().paused === true, 'console to see the pause');
  assert.deepEqual(disp.seen.paused, [true]);
  disp.advance(4000);
  con.link.resume();
  await waitFor(() => !disp.session.isPaused(), 'display to resume');
  await waitFor(() => con.link.state().paused === false, 'console to see the resume');
  assert.equal(disp.session.togglePause(), true, 'P in the display pauses too');
  con.link.stop();
  await waitFor(() => con.got.runs.length === 1, 'the run');
  const ev = con.got.runs[0].events.map((e) => e.event);
  assert.deepEqual(ev.filter((e) => e === 'pause' || e === 'resume'), ['pause', 'resume', 'pause']);
  assert.equal(ev.at(-1), 'run_end', 'stopping while paused still ends the run cleanly');
  disp.close(); con.close();
});

