/**
 * Pausing (testing only) and what a stopped or finished run leaves behind.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { createEngine } from '../src/engine.js';
import { createLogger } from '../src/logger.js';
import { summarize, eventCounts, runSummaryText } from '../src/summary.js';
import { buildRunCSV } from '../src/export.js';

/** An engine on a hand-driven clock: step(ms) advances time frame by frame. */
function manual(p = {}) {
  const config = resolveConfig({ seed: 1234, nTrials: 20, ...p });
  const logger = createLogger();
  let now = 0;
  let pending = null;
  const engine = createEngine({
    config, trials: buildSchedule(config), logger,
    clock: () => now, raf: (fn) => { pending = fn; return 1; }, caf: () => { pending = null; },
  });
  const step = (ms, frame = 10) => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(end, now + frame);
      if (pending) { const fn = pending; pending = null; fn(); }
    }
  };
  const wait = (ms) => { now += ms; };          // time passes with no frames (paused)
  const runToEnd = () => { while (pending) step(10); };
  return { config, engine, logger, step, wait, runToEnd, now: () => now };
}

test('pause: the run clock stops, and the schedule picks up where it left off', () => {
  const m = manual();
  m.engine.start();
  m.step(2500);                                  // trial 1 at 2000 ms is up
  assert.equal(m.engine.pause(), true);
  assert.equal(m.engine.pause(), false, 'already paused');
  m.wait(60000);                                 // a one-minute pause
  assert.equal(m.engine.resume(), true);
  m.runToEnd();
  const trials = m.engine.trials();
  // Every trial still starts on its scheduled run time; the minute is not in the run clock.
  for (const t of trials) assert.ok(t.actualOnsetMs - t.scheduledOnsetMs < 10, `trial ${t.trial} on time`);
  const events = m.logger.toArray();
  const pause = events.find((e) => e.event === 'pause');
  const resume = events.find((e) => e.event === 'resume');
  assert.equal(pause.t_ms, 2500);
  assert.equal(resume.t_ms, 2500, 'the run resumes at the run time it paused at');
  assert.equal(resume.paused_ms, 60000);
  assert.equal(events.at(-1).t_ms, 22000, 'run length excludes the pause');
  assert.equal(m.engine.getState().pausedTotalMs, 60000);
  assert.ok(m.engine.frameStats().max_interval_ms <= 10, 'the pause is not counted as a slow frame');
});

test('pause: presses and trigger pulses while paused are ignored', () => {
  const m = manual();
  m.engine.start();
  m.step(2100);
  m.engine.pause();
  assert.equal(m.engine.press(m.engine.trials()[0].targets[0].response, 'key'), null);
  assert.equal(m.engine.pulse('key t'), null);
  m.engine.resume();
  m.runToEnd();
  assert.equal(m.engine.trials()[0].outcome, 'omission', 'the press during the pause did not count');
});

test('pause: a mole up when the run pauses keeps its remaining time', () => {
  const m = manual();
  m.engine.start();
  m.step(2300);                                  // mole up for 300 of its 800 ms
  m.engine.pause();
  m.wait(5000);
  m.engine.resume();
  m.step(400);                                   // 700 ms of window used: still up
  assert.equal(m.engine.trials()[0].outcome, null);
  m.step(200);                                   // past 800 ms: down
  assert.equal(m.engine.trials()[0].outcome, 'omission');
});

test('stop while paused: the run ends at the paused run time, data intact', () => {
  const m = manual();
  m.engine.start();
  m.step(4400);                                  // trials 1-3 shown, trial 3 up
  m.engine.pause();
  m.wait(10000);
  m.engine.stop();
  const events = m.logger.toArray();
  assert.equal(events.at(-1).event, 'run_end');
  assert.equal(events.at(-1).reason, 'stopped');
  assert.equal(events.at(-1).t_ms, 4400);
  const shown = m.engine.trials().filter((t) => t.actualOnsetMs != null);
  assert.equal(shown.length, 3);
  assert.equal(shown[2].outcome, 'truncated');
  assert.equal(m.engine.getState().paused, false);
});

test('a stopped run still gives a summary and a full run table', () => {
  const m = manual();
  m.engine.start();
  m.step(2200);
  m.engine.press(m.engine.trials()[0].targets[0].response, 'key 1');
  m.step(3000);
  m.engine.pause();
  m.wait(1500);
  m.engine.resume();
  m.step(500);
  m.engine.stop();
  const run = { config: m.config, trials: m.engine.trials(), events: m.logger.toArray() };
  const s = summarize(run.trials);
  assert.equal(s.hits, 1);
  assert.ok(s.rts[0] > 190 && s.rts[0] <= 200);
  const c = eventCounts(run.events);
  assert.deepEqual([c.pauses, c.pausedMs], [1, 1500]);
  const text = runSummaryText(run);
  assert.match(text, /^Run ended early after \d+ of 20 trials\./);
  assert.match(text, /1 of \d+ happy moles hit/);
  assert.match(text, /Paused 1 time\(s\), 1\.5 s in total: fine for testing, not usable for scanning\./);
  const rows = buildRunCSV(run.trials).trim().split('\n');
  assert.equal(rows.length, 1 + run.trials.filter((t) => t.actualOnsetMs != null).length);
});

test('a completed run summary says finished', () => {
  const m = manual({ nTrials: 10 });
  m.engine.start();
  m.runToEnd();
  const text = runSummaryText({ config: m.config, trials: m.engine.trials(), events: m.logger.toArray() });
  assert.match(text, /^Run finished after 10 of 10 trials\./);
  assert.doesNotMatch(text, /Paused/);
});

test('config: results on the display are off by default (Q6: the participant sees nothing)', () => {
  assert.equal(resolveConfig().showResultsOnDisplay, false);
  assert.equal(resolveConfig({ showResultsOnDisplay: true }).showResultsOnDisplay, true);
  assert.throws(() => resolveConfig({ showResultsOnDisplay: 'yes' }), /showResultsOnDisplay/);
});
