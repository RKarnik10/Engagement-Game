import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, runDurationMs } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { createEngine } from '../src/engine.js';
import { createLogger } from '../src/logger.js';
import { simulateRun } from './_sim.js';

const cfg = (p = {}) => resolveConfig({ seed: 1234, nTrials: 60, ...p });
const FRAME = 10;
const firstOf = (schedule, type) => schedule.find((t) => t.type === type);

test('engine: trigger first, run_end last, completes at the end of the last trial', () => {
  const config = cfg();
  const { events, state } = simulateRun({ config, trials: buildSchedule(config) });
  assert.equal(events[0].event, 'trigger');
  assert.equal(events[0].setting, 'behavioral');
  assert.equal(events.at(-1).event, 'run_end');
  assert.equal(events.at(-1).reason, 'completed');
  assert.equal(events.at(-1).t_ms, runDurationMs(config));
  assert.equal(state.phase, 'ended');
});

test('engine: every trial is shown on time, with one target_on event per mole', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const { trials, events } = simulateRun({ config, trials: schedule, frameMs: FRAME });
  for (const a of trials) {
    assert.ok(a.actualOnsetMs >= a.scheduledOnsetMs && a.actualOnsetMs - a.scheduledOnsetMs < FRAME);
    assert.ok(a.outcome, `trial ${a.trial} has an outcome`);
  }
  const ons = events.filter((e) => e.event === 'target_on');
  assert.equal(ons.length, schedule.reduce((n, t) => n + t.targets.length, 0));
  for (const e of ons) {
    const x = trials[e.trial - 1].targets[e.target - 1];
    assert.equal(e.valence, x.valence);
    assert.equal(e.row, x.row);
    assert.equal(e.col, x.col);
    assert.equal(e.button, x.response + 1);
    assert.equal(e.hole, x.hole + 1);
  }
  // Both moles of a both trial come up on the same frame.
  const both = firstOf(trials, 'both');
  const bothOns = ons.filter((e) => e.trial === both.trial);
  assert.equal(bothOns.length, 2);
  assert.equal(bothOns[0].t_ms, bothOns[1].t_ms);
});

test('engine: trials never overlap at runtime', () => {
  for (const seed of [1, 2, 3, 77, 1234]) {
    const config = cfg({ seed, holdMs: 999, trialMs: 1000 });
    const { trials } = simulateRun({ config, trials: buildSchedule(config) });
    for (let i = 1; i < trials.length; i++) {
      assert.ok(trials[i - 1].offsetMs <= trials[i].actualOnsetMs, `seed ${seed}: trial ${i} overlapped trial ${i + 1}`);
    }
  }
});

test('engine: no presses at all -> good moles missed, bad moles left alone', () => {
  const config = cfg();
  const { trials } = simulateRun({ config, trials: buildSchedule(config) });
  for (const a of trials) {
    for (const x of a.targets) assert.equal(x.outcome, x.valence === 'good' ? 'omission' : 'correct_rejection');
    assert.equal(a.outcome, a.type === 'bad' ? 'correct_rejection' : 'omission');
    assert.equal(a.correct, a.type === 'bad' ? 1 : 0);
    assert.deepEqual(a.presses, []);
    assert.equal(a.goodRtMs, null);
    const down = a.offsetMs - a.actualOnsetMs;
    assert.ok(down >= a.windowMs && down < a.windowMs + FRAME);
  }
});

test('engine: good trial, right column -> hit, the trial ends at once', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  const g = t1.targets[0];
  const { trials, events } = simulateRun({
    config, trials: schedule, presses: [{ tMs: t1.scheduledOnsetMs + 300, button: g.response, source: 'key 1' }],
  });
  const a = trials[0];
  assert.equal(a.outcome, 'hit');
  assert.equal(a.correct, 1);
  assert.ok(a.goodRtMs > 290 && a.goodRtMs <= 300);
  assert.equal(a.offsetMs, t1.scheduledOnsetMs + 300, 'the mole goes down on the hit');
  assert.deepEqual(a.presses.map((p) => [p.button, p.outcome]), [[g.response, 'hit']]);
  const hit = events.find((e) => e.event === 'hit');
  assert.equal(hit.pressed_button, g.response + 1);
  assert.equal(hit.rt_ms, +a.goodRtMs.toFixed(1));
  const end = events.find((e) => e.event === 'trial_end' && e.trial === 1);
  assert.deepEqual([end.outcome, end.correct], ['hit', 1]);
});

test('engine: bad trial, its column pressed -> commission', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t = firstOf(schedule, 'bad');
  const { trials } = simulateRun({
    config, trials: schedule, presses: [{ tMs: t.scheduledOnsetMs + 200, button: t.targets[0].response }],
  });
  const a = trials[t.trial - 1];
  assert.equal(a.outcome, 'commission');
  assert.equal(a.correct, 0);
  assert.ok(a.targets[0].rtMs > 190 && a.targets[0].rtMs <= 200);
  assert.equal(a.goodRtMs, null);
});

test('engine: both trial, good column -> hit; the bad mole stays up until the window ends', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t = firstOf(schedule, 'both');
  const [g, b] = t.targets;
  const { trials, events } = simulateRun({
    config, trials: schedule, presses: [{ tMs: t.scheduledOnsetMs + 250, button: g.response }],
  });
  const a = trials[t.trial - 1];
  assert.equal(a.targets[0].outcome, 'hit');
  assert.equal(a.targets[0].offsetMs, t.scheduledOnsetMs + 250);
  assert.equal(a.targets[1].outcome, 'correct_rejection');
  assert.ok(a.targets[1].offsetMs >= a.actualOnsetMs + a.windowMs, 'bad mole is not killed');
  assert.equal(a.outcome, 'hit');
  assert.equal(a.correct, 1);
  assert.ok(a.goodRtMs > 240 && a.goodRtMs <= 250);
  assert.equal(a.offsetMs, a.targets[1].offsetMs, 'the trial ends when its last mole goes down');
  const downs = events.filter((e) => e.trial === t.trial && ['hit', 'correct_rejection'].includes(e.event));
  assert.deepEqual(downs.map((e) => [e.event, e.col]), [['hit', g.col], ['correct_rejection', b.col]]);
});

test('engine: both trial, bad column -> commission; the good mole is then missed', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t = firstOf(schedule, 'both');
  const b = t.targets[1];
  const { trials } = simulateRun({ config, trials: schedule, presses: [{ tMs: t.scheduledOnsetMs + 200, button: b.response }] });
  const a = trials[t.trial - 1];
  assert.deepEqual(a.targets.map((x) => x.outcome), ['omission', 'commission']);
  assert.equal(a.outcome, 'commission');
  assert.equal(a.correct, 0);
});

test('engine: both trial, good then bad -> both moles down, trial counts as a commission', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t = firstOf(schedule, 'both');
  const [g, b] = t.targets;
  const { trials } = simulateRun({
    config, trials: schedule,
    presses: [{ tMs: t.scheduledOnsetMs + 200, button: g.response }, { tMs: t.scheduledOnsetMs + 400, button: b.response }],
  });
  const a = trials[t.trial - 1];
  assert.deepEqual(a.targets.map((x) => x.outcome), ['hit', 'commission']);
  assert.equal(a.outcome, 'commission');
  assert.equal(a.offsetMs, t.scheduledOnsetMs + 400, 'the trial ends when the second mole goes down');
  assert.deepEqual(a.presses.map((p) => p.button), [g.response, b.response]);
  assert.ok(a.goodRtMs > 190 && a.goodRtMs <= 200, 'the good-mole RT is still kept');
});

test('engine: both trial, third column -> wrong_hole; both moles still up', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t = firstOf(schedule, 'both');
  const third = [0, 1, 2].find((c) => !t.targets.some((x) => x.response === c));
  const { trials, events, state } = simulateRun({ config, trials: schedule, presses: [{ tMs: t.scheduledOnsetMs + 150, button: third }] });
  const wrong = events.find((e) => e.event === 'wrong_hole');
  assert.equal(wrong.trial, t.trial);
  assert.equal(wrong.pressed_button, third + 1);
  assert.deepEqual(wrong.up_buttons, t.targets.map((x) => x.response + 1));
  assert.ok(wrong.rt_ms > 140 && wrong.rt_ms <= 150);
  assert.equal(state.counts.wrong_hole, 1);
  const a = trials[t.trial - 1];
  assert.deepEqual(a.targets.map((x) => x.outcome), ['omission', 'correct_rejection']);
  assert.deepEqual(a.presses.map((p) => [p.button, p.outcome]), [[third, 'wrong_hole']]);
});

test('engine: a press between trials -> no_target_press', () => {
  const config = cfg();
  const { events, state } = simulateRun({ config, trials: buildSchedule(config), presses: [{ tMs: 500, button: 2 }] });
  const e = events.find((x) => x.event === 'no_target_press');
  assert.equal(e.t_ms, 500);
  assert.equal(e.pressed_button, 3);
  assert.equal(state.counts.no_target_press, 1);
});

test('engine: stopping during a both trial truncates both moles', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t = firstOf(schedule, 'both');
  const stopAt = t.scheduledOnsetMs + 300;
  const { trials, events } = simulateRun({ config, trials: schedule, stopAt });
  const a = trials[t.trial - 1];
  assert.deepEqual(a.targets.map((x) => x.outcome), ['truncated', 'truncated']);
  assert.equal(a.outcome, 'truncated');
  assert.equal(a.correct, null);
  assert.equal(events.at(-1).reason, 'stopped');
  assert.ok(trials.slice(t.trial).every((x) => x.actualOnsetMs == null));
});

test('engine: simulated volumes on the TR grid, and real pulses kept apart', () => {
  const config = cfg({ trS: 1.5, nTrials: 20 });
  const { events } = simulateRun({ config, trials: buildSchedule(config), pulses: [{ tMs: 1005 }, { tMs: 2005 }] });
  const sim = events.filter((e) => e.event === 'volume' && e.simulated);
  assert.equal(sim.length, Math.floor(runDurationMs(config) / 1500));
  sim.forEach((v, i) => assert.equal(v.t_ms, (i + 1) * 1500));
  const real = events.filter((e) => e.event === 'volume' && e.simulated === false);
  assert.deepEqual(real.map((e) => [e.volume, e.t_ms]), [[1, 1005], [2, 2005]]);
});

test('engine: note() logs things the engine cannot see, only while running', () => {
  const config = cfg({ nTrials: 10 });
  const logger = createLogger();
  let now = 0;
  const engine = createEngine({ config, trials: buildSchedule(config), logger, clock: () => now, raf: () => 1, caf: () => {} });
  assert.equal(engine.note('display_hidden'), null);
  engine.start();
  now = 1234.5;
  const rec = engine.note('display_hidden');
  assert.deepEqual([rec.event, rec.t_ms], ['display_hidden', 1234.5]);
});

test('engine: frame statistics count frames, mean, max, and slow frames', () => {
  const config = cfg({ nTrials: 20 });
  const { engine } = simulateRun({ config, trials: buildSchedule(config), frameJitter: (i) => (i === 100 ? 50 : FRAME) });
  const f = engine.frameStats();
  assert.equal(f.max_interval_ms, 50);
  assert.equal(f.intervals_over_20ms, 1);
  assert.deepEqual(Object.keys(f).sort(), ['frames', 'intervals_over_20ms', 'max_interval_ms', 'mean_interval_ms']);
});

test('engine: does not mutate the schedule it is given', () => {
  const config = cfg({ nTrials: 20 });
  const schedule = buildSchedule(config);
  const before = JSON.stringify(schedule);
  simulateRun({ config, trials: schedule, presses: [{ tMs: 2300, button: schedule[0].targets[0].response }] });
  assert.equal(JSON.stringify(schedule), before);
});

test('engine: lifecycle guards', () => {
  const config = cfg({ nTrials: 20 });
  const logger = createLogger();
  const engine = createEngine({ config, trials: buildSchedule(config), logger, clock: () => 0, raf: () => 1, caf: () => {} });
  assert.equal(engine.press(0, 'key 1'), null, 'press before start is ignored');
  engine.start();
  assert.throws(() => engine.start(), /once/);
  assert.throws(() => engine.press(3, 'key'), /button/, 'there are only three buttons');
  engine.stop();
  assert.equal(engine.press(0, 'key 1'), null, 'press after end is ignored');
  assert.equal(logger.toArray().at(-1).event, 'run_end');
});
