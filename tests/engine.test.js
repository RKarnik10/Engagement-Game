import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { createEngine } from '../src/engine.js';
import { createLogger } from '../src/logger.js';
import { simulateRun } from './_sim.js';

const cfg = (p = {}) => resolveConfig({ seed: 1234, ...p });
const FRAME = 10;

test('engine: trigger first, run_end last, completes at durationS', () => {
  const config = cfg();
  const { events, state } = simulateRun({ config, trials: buildSchedule(config) });
  assert.equal(events[0].event, 'trigger');
  assert.equal(events[0].t_ms, 0);
  assert.equal(events.at(-1).event, 'run_end');
  assert.equal(events.at(-1).reason, 'completed');
  assert.equal(events.at(-1).t_ms, config.durationS * 1000);
  assert.equal(state.phase, 'ended');
  assert.equal(state.endReason, 'completed');
});

test('engine: every scheduled target is shown at or after its scheduled time with lag under one frame', () => {
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
    assert.ok(e.lag_ms >= 0 && e.lag_ms < FRAME);
    assert.equal(e.hole, trials[e.trial - 1].hole + 1, 'logged hole is 1-based');
  }
});

test('engine: target windows never overlap at runtime', () => {
  for (const seed of [1, 2, 3, 77, 1234]) {
    const config = cfg({ seed, isiMinMs: 0, isiMaxMs: 0 });
    const { trials } = simulateRun({ config, trials: buildSchedule(config) });
    for (let i = 1; i < trials.length; i++) {
      assert.ok(trials[i - 1].offsetMs <= trials[i].actualOnsetMs, `seed ${seed}: trial ${i} went down before trial ${i + 1} came up`);
    }
  }
});

test('engine: no press -> omission for go, correct_rejection for no-go, at the end of the window', () => {
  const config = cfg();
  const { trials } = simulateRun({ config, trials: buildSchedule(config) });
  const truncated = trials.filter((a) => a.outcome === 'truncated');
  assert.ok(truncated.length <= 1);
  for (const a of trials) {
    if (a.outcome === 'truncated') continue;
    assert.equal(a.outcome, a.type === 'go' ? 'omission' : 'correct_rejection');
    assert.equal(a.rtMs, null);
    const down = a.offsetMs - a.actualOnsetMs;
    assert.ok(down >= a.windowMs && down < a.windowMs + FRAME, `trial ${a.trial} down after ${down} ms (window ${a.windowMs})`);
  }
});

test('engine: gradual onset widens the window by 2 * rampMs', () => {
  const config = cfg({ onset: 'gradual' });
  const { trials } = simulateRun({ config, trials: buildSchedule(config) });
  assert.equal(trials[0].windowMs, 900 + 700);
  assert.equal(trials[0].offsetMs - trials[0].actualOnsetMs, 1600);
});

test('engine: matching press on a go target -> hit with reaction time and +1 score', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  assert.equal(t1.type, 'go');
  const { trials, events, state } = simulateRun({
    config, trials: schedule, presses: [{ tMs: t1.scheduledOnsetMs + 300, hole: t1.hole, source: 'key 1' }],
  });
  const a = trials[0];
  assert.equal(a.outcome, 'hit');
  assert.ok(a.rtMs > 290 && a.rtMs <= 300, `rt ${a.rtMs}`);
  assert.equal(a.offsetMs, t1.scheduledOnsetMs + 300);
  assert.equal(a.source, 'key 1');
  const ev = events.find((e) => e.event === 'hit');
  assert.equal(ev.trial, 1);
  assert.equal(ev.hole, t1.hole + 1);
  assert.equal(ev.rt_ms, a.rtMs);
  assert.equal(ev.source, 'key 1');
  assert.equal(state.score, 1);
});

test('engine: matching press on a no-go target -> commission with reaction time and -1 score', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const ng = schedule.find((t) => t.type === 'nogo');
  const { trials, state } = simulateRun({
    config, trials: schedule, presses: [{ tMs: ng.scheduledOnsetMs + 200, hole: ng.hole, source: 'pointer' }],
  });
  const a = trials[ng.trial - 1];
  assert.equal(a.outcome, 'commission');
  assert.ok(a.rtMs > 190 && a.rtMs <= 200);
  assert.equal(a.precedingGo, ng.precedingGo);
  assert.equal(state.score, -1);
});

test('engine: press on a different hole -> wrong_hole, trial continues and resolves normally', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  const other = (t1.hole + 1) % config.keys.length;
  const { trials, events, state } = simulateRun({
    config, trials: schedule, presses: [{ tMs: t1.scheduledOnsetMs + 100, hole: other, source: 'key x' }],
  });
  const wrong = events.find((e) => e.event === 'wrong_hole');
  assert.ok(wrong);
  assert.equal(wrong.trial, 1);
  assert.equal(wrong.hole, other + 1);
  assert.equal(wrong.target_hole, t1.hole + 1);
  assert.equal(state.counts.wrong_hole, 1);
  assert.equal(trials[0].outcome, 'omission');
  assert.equal(trials[0].rtMs, null);
});

test('engine: press with no target up -> no_target_press', () => {
  const config = cfg();
  const { events, state, trials } = simulateRun({
    config, trials: buildSchedule(config), presses: [{ tMs: 500, hole: 2, source: 'key 3' }],
  });
  const e = events.find((x) => x.event === 'no_target_press');
  assert.ok(e);
  assert.equal(e.t_ms, 500);
  assert.equal(e.hole, 3);
  assert.equal(e.trial, undefined);
  assert.equal(state.counts.no_target_press, 1);
  assert.ok(trials.every((a) => a.outcome !== 'hit'));
});

test('engine: stopping while a target is up -> truncated, then run_end with reason stopped', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const stopAt = schedule[0].scheduledOnsetMs + 400;
  const { trials, events, state } = simulateRun({ config, trials: schedule, stopAt });
  assert.equal(trials[0].outcome, 'truncated');
  assert.equal(trials[0].offsetMs, stopAt);
  assert.equal(trials[0].rtMs, null);
  assert.ok(trials.slice(1).every((a) => a.actualOnsetMs == null && a.outcome == null));
  assert.equal(events.at(-2).event, 'truncated');
  assert.equal(events.at(-1).event, 'run_end');
  assert.equal(events.at(-1).reason, 'stopped');
  assert.equal(state.endedMs, stopAt);
});

test('engine: simulated volume events sit on the TR grid', () => {
  const config = cfg({ trS: 1.5, durationS: 30 });
  const { events } = simulateRun({ config, trials: buildSchedule(config) });
  const vols = events.filter((e) => e.event === 'volume');
  assert.equal(vols.length, 20);
  vols.forEach((v, i) => {
    assert.equal(v.volume, i + 1);
    assert.equal(v.t_ms, (i + 1) * 1500);
    assert.equal(v.simulated, true);
  });
});

test('engine: real trigger pulses during the run are logged as non-simulated volume events', () => {
  const config = cfg({ durationS: 15 });
  const { events, state } = simulateRun({
    config, trials: buildSchedule(config), pulses: [{ tMs: 1005, source: 'key t' }, { tMs: 2005, source: 'key t' }],
  });
  const real = events.filter((e) => e.event === 'volume' && e.simulated === false);
  assert.equal(real.length, 2);
  assert.deepEqual(real.map((e) => [e.volume, e.t_ms, e.source]), [[1, 1005, 'key t'], [2, 2005, 'key t']]);
  assert.equal(state.pulses, 2);
});

test('engine: frame statistics count frames, mean, max, and slow frames', () => {
  const config = cfg({ durationS: 15 });
  const jitter = (i) => (i === 100 ? 50 : FRAME);
  const { engine } = simulateRun({ config, trials: buildSchedule(config), frameJitter: jitter });
  const f = engine.frameStats();
  assert.ok(f.frames > 1000);
  assert.equal(f.max_interval_ms, 50);
  assert.equal(f.intervals_over_20ms, 1);
  assert.ok(f.mean_interval_ms > FRAME && f.mean_interval_ms < FRAME + 1);
  assert.deepEqual(Object.keys(f).sort(), ['frames', 'intervals_over_20ms', 'max_interval_ms', 'mean_interval_ms']);
});

test('engine: does not mutate the schedule it is given', () => {
  const config = cfg({ durationS: 20 });
  const schedule = buildSchedule(config);
  const before = JSON.stringify(schedule);
  simulateRun({ config, trials: schedule, presses: [{ tMs: 2300, hole: schedule[0].hole }] });
  assert.equal(JSON.stringify(schedule), before);
});

test('engine: lifecycle guards', () => {
  const config = cfg({ durationS: 15 });
  const logger = createLogger();
  let pending = null;
  const engine = createEngine({
    config, trials: buildSchedule(config), logger, clock: () => 0, raf: (fn) => { pending = fn; return 1; }, caf: () => {},
  });
  assert.equal(engine.press(0, 'key 1'), null, 'press before start is ignored');
  assert.equal(engine.pulse('key t'), null, 'pulse before start is ignored');
  engine.start();
  assert.throws(() => engine.start(), /once/);
  assert.throws(() => engine.press(9, 'key'), /hole/);
  assert.throws(() => engine.press(-1, 'key'), /hole/);
  assert.equal(typeof pending, 'function');
  engine.stop();
  assert.equal(engine.press(0, 'key 1'), null, 'press after end is ignored');
  assert.equal(engine.getState().phase, 'ended');
  assert.equal(logger.toArray().at(-1).event, 'run_end');
});

test('engine: grid9 layout accepts all nine holes', () => {
  const config = cfg({ layout: 'grid9', durationS: 20 });
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  const { trials } = simulateRun({ config, trials: schedule, presses: [{ tMs: t1.scheduledOnsetMs + 250, hole: t1.hole }] });
  assert.equal(trials[0].outcome, 'hit');
  assert.ok(trials.every((a) => a.hole >= 0 && a.hole < 9));
});
