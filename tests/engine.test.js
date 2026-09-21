import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, runDurationMs } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { createEngine } from '../src/engine.js';
import { createLogger } from '../src/logger.js';
import { simulateRun } from './_sim.js';

const cfg = (p = {}) => resolveConfig({ seed: 1234, nTrials: 40, ...p });
const FRAME = 10;

test('engine: trigger first, run_end last, completes at the end of the last trial', () => {
  const config = cfg();
  const { events, state } = simulateRun({ config, trials: buildSchedule(config) });
  assert.equal(events[0].event, 'trigger');
  assert.equal(events[0].t_ms, 0);
  assert.equal(events[0].setting, 'behavioral');
  assert.equal(events.at(-1).event, 'run_end');
  assert.equal(events.at(-1).reason, 'completed');
  assert.equal(events.at(-1).t_ms, runDurationMs(config));
  assert.equal(state.phase, 'ended');
});

test('engine: every scheduled target is shown at or after its time, lag under one frame', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const { trials, events } = simulateRun({ config, trials: schedule, frameMs: FRAME });
  assert.equal(trials.length, schedule.length);
  for (const a of trials) {
    assert.ok(a.actualOnsetMs != null, `trial ${a.trial} shown`);
    assert.ok(a.actualOnsetMs >= a.scheduledOnsetMs);
    assert.ok(a.actualOnsetMs - a.scheduledOnsetMs < FRAME);
    assert.ok(a.outcome, `trial ${a.trial} has an outcome`);
  }
  const ons = events.filter((e) => e.event === 'target_on');
  assert.equal(ons.length, schedule.length);
  for (const e of ons) {
    const a = trials[e.trial - 1];
    assert.ok(e.lag_ms >= 0 && e.lag_ms < FRAME);
    assert.equal(e.hole, a.hole + 1, 'logged hole is 1-based');
    assert.equal(e.row, a.row);
    assert.equal(e.col, a.col);
    assert.equal(e.expected_button, a.response + 1, 'the event says which button was expected');
    assert.ok(['mole_happy', 'mole_sad', 'molerat'].includes(e.stim));
  }
});

test('engine: target windows never overlap at runtime', () => {
  for (const seed of [1, 2, 3, 77, 1234]) {
    const config = cfg({ seed, holdMs: 999, trialMs: 1000 });
    const { trials } = simulateRun({ config, trials: buildSchedule(config) });
    for (let i = 1; i < trials.length; i++) {
      assert.ok(trials[i - 1].offsetMs <= trials[i].actualOnsetMs, `seed ${seed}: trial ${i} overlapped trial ${i + 1}`);
    }
  }
});

test('engine: no press -> omission for happy moles, correct_rejection for skip trials', () => {
  const config = cfg();
  const { trials } = simulateRun({ config, trials: buildSchedule(config) });
  for (const a of trials) {
    if (a.outcome === 'truncated') continue;
    assert.equal(a.outcome, a.type === 'go' ? 'omission' : 'correct_rejection');
    assert.equal(a.rtMs, null);
    assert.equal(a.pressed, null);
    const down = a.offsetMs - a.actualOnsetMs;
    assert.ok(down >= a.windowMs && down < a.windowMs + FRAME, `trial ${a.trial} down after ${down} ms`);
  }
});

test('engine: pressing the column of a happy mole -> hit with a reaction time', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  assert.equal(t1.type, 'go');
  const { trials, events } = simulateRun({
    config, trials: schedule, presses: [{ tMs: t1.scheduledOnsetMs + 300, button: t1.response, source: 'key 1' }],
  });
  const a = trials[0];
  assert.equal(a.outcome, 'hit');
  assert.ok(a.rtMs > 290 && a.rtMs <= 300, `rt ${a.rtMs}`);
  assert.equal(a.pressed, t1.response);
  const ev = events.find((e) => e.event === 'hit');
  assert.equal(ev.trial, 1);
  assert.equal(ev.expected_button, t1.response + 1);
  assert.equal(ev.pressed_button, t1.response + 1);
  assert.equal(ev.row, t1.row);
  assert.equal(ev.col, t1.col);
  assert.equal(ev.rt_ms, a.rtMs);
});

test('engine: any row in the right column counts as a hit', () => {
  const config = cfg({ seed: 21 });
  const schedule = buildSchedule(config);
  // Press the expected button for the first ten go trials, whatever row they are in.
  const goTrials = schedule.filter((t) => t.type === 'go').slice(0, 10);
  const presses = goTrials.map((t) => ({ tMs: t.scheduledOnsetMs + 250, button: t.response }));
  const { trials } = simulateRun({ config, trials: schedule, presses });
  const rowsHit = new Set();
  for (const t of goTrials) {
    const a = trials[t.trial - 1];
    assert.equal(a.outcome, 'hit', `trial ${t.trial} in row ${t.row} column ${t.col}`);
    rowsHit.add(t.row);
  }
  assert.ok(rowsHit.size >= 2, 'hits came from more than one row');
});

test('engine: pressing the column of a skip trial -> commission', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const ng = schedule.find((t) => t.type === 'nogo');
  const { trials } = simulateRun({
    config, trials: schedule, presses: [{ tMs: ng.scheduledOnsetMs + 200, button: ng.response, source: 'pointer' }],
  });
  const a = trials[ng.trial - 1];
  assert.equal(a.outcome, 'commission');
  assert.ok(a.rtMs > 190 && a.rtMs <= 200);
  assert.equal(a.precedingGo, ng.precedingGo);
  assert.ok(['mole_sad', 'molerat'].includes(a.stim));
});

test('engine: pressing another column -> wrong_hole, and the trial still resolves', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  const other = (t1.response + 1) % config.keys.length;
  const { trials, events, state } = simulateRun({
    config, trials: schedule, presses: [{ tMs: t1.scheduledOnsetMs + 100, button: other, source: 'key x' }],
  });
  const wrong = events.find((e) => e.event === 'wrong_hole');
  assert.ok(wrong);
  assert.equal(wrong.trial, 1);
  assert.equal(wrong.expected_button, t1.response + 1);
  assert.equal(wrong.pressed_button, other + 1);
  assert.ok(wrong.rt_ms > 90 && wrong.rt_ms <= 100, 'a wrong-column press still carries its timing');
  assert.equal(state.counts.wrong_hole, 1);
  assert.equal(trials[0].outcome, 'omission');
  assert.equal(trials[0].rtMs, null);
});

test('engine: press in the gap between trials -> no_target_press', () => {
  const config = cfg();
  const { events, state } = simulateRun({
    config, trials: buildSchedule(config), presses: [{ tMs: 500, button: 2, source: 'key 3' }],
  });
  const e = events.find((x) => x.event === 'no_target_press');
  assert.ok(e);
  assert.equal(e.t_ms, 500);
  assert.equal(e.pressed_button, 3);
  assert.equal(e.trial, undefined);
  assert.equal(state.counts.no_target_press, 1);
});

test('engine: stopping while a target is up -> truncated, then run_end', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const stopAt = schedule[0].scheduledOnsetMs + 400;
  const { trials, events, state } = simulateRun({ config, trials: schedule, stopAt });
  assert.equal(trials[0].outcome, 'truncated');
  assert.equal(trials[0].offsetMs, stopAt);
  assert.ok(trials.slice(1).every((a) => a.actualOnsetMs == null));
  assert.equal(events.at(-2).event, 'truncated');
  assert.equal(events.at(-1).reason, 'stopped');
  assert.equal(state.endedMs, stopAt);
});

test('engine: simulated volume events sit on the TR grid', () => {
  const config = cfg({ trS: 1.5, nTrials: 20 });
  const { events } = simulateRun({ config, trials: buildSchedule(config) });
  const vols = events.filter((e) => e.event === 'volume' && e.simulated);
  assert.equal(vols.length, Math.floor(runDurationMs(config) / 1500));
  vols.forEach((v, i) => {
    assert.equal(v.volume, i + 1);
    assert.equal(v.t_ms, (i + 1) * 1500);
  });
});

test('engine: real trigger pulses are logged as non-simulated volume events', () => {
  const config = cfg({ nTrials: 20 });
  const { events, state } = simulateRun({
    config, trials: buildSchedule(config), pulses: [{ tMs: 1005, source: 'key t' }, { tMs: 2005, source: 'key t' }],
  });
  const real = events.filter((e) => e.event === 'volume' && e.simulated === false);
  assert.deepEqual(real.map((e) => [e.volume, e.t_ms, e.source]), [[1, 1005, 'key t'], [2, 2005, 'key t']]);
  assert.equal(state.pulses, 2);
});

test('engine: frame statistics count frames, mean, max, and slow frames', () => {
  const config = cfg({ nTrials: 20 });
  const { engine } = simulateRun({ config, trials: buildSchedule(config), frameJitter: (i) => (i === 100 ? 50 : FRAME) });
  const f = engine.frameStats();
  assert.ok(f.frames > 1000);
  assert.equal(f.max_interval_ms, 50);
  assert.equal(f.intervals_over_20ms, 1);
  assert.deepEqual(Object.keys(f).sort(), ['frames', 'intervals_over_20ms', 'max_interval_ms', 'mean_interval_ms']);
});

test('engine: does not mutate the schedule it is given', () => {
  const config = cfg({ nTrials: 20 });
  const schedule = buildSchedule(config);
  const before = JSON.stringify(schedule);
  simulateRun({ config, trials: schedule, presses: [{ tMs: 2300, button: schedule[0].response }] });
  assert.equal(JSON.stringify(schedule), before);
});

test('engine: lifecycle guards', () => {
  const config = cfg({ nTrials: 20 });
  const logger = createLogger();
  let pending = null;
  const engine = createEngine({
    config, trials: buildSchedule(config), logger, clock: () => 0, raf: (fn) => { pending = fn; return 1; }, caf: () => {},
  });
  assert.equal(engine.press(0, 'key 1'), null, 'press before start is ignored');
  assert.equal(engine.pulse('key t'), null, 'pulse before start is ignored');
  engine.start();
  assert.throws(() => engine.start(), /once/);
  assert.throws(() => engine.press(3, 'key'), /button/, 'there are only three buttons');
  assert.throws(() => engine.press(-1, 'key'), /button/);
  engine.stop();
  assert.equal(engine.press(0, 'key 1'), null, 'press after end is ignored');
  assert.equal(logger.toArray().at(-1).event, 'run_end');
});

test('engine: the per-hole layout still works, one key per hole', () => {
  const config = cfg({ layout: 'grid9', nTrials: 20 });
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  assert.equal(t1.response, t1.hole, 'one button per hole');
  const { trials } = simulateRun({ config, trials: schedule, presses: [{ tMs: t1.scheduledOnsetMs + 250, button: t1.response }] });
  assert.equal(trials[0].outcome, 'hit');
});
