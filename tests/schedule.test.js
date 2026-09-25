import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, LAYOUTS, trialWindowMs } from '../src/config.js';
import { buildSchedule, trialCounts, LEAD_IN_GO_TRIALS, TRIAL, GOOD_STIM } from '../src/schedule.js';

const cfg = (p = {}) => resolveConfig(p);
const SEEDS = 1200;
const SHORT = { nTrials: 60 };   // keeps the 1,200-seed sweeps quick

/** Check every schedule rule on one run. */
function checkConstraints(trials, config, label) {
  const n = trials.length;
  const layout = LAYOUTS[config.layout];
  const windowMs = trialWindowMs(config);
  assert.equal(n, config.nTrials, `${label}: trial count`);

  trials.forEach((t, i) => {
    assert.equal(t.trial, i + 1, `${label}: trial numbers are 1-based and consecutive`);
    assert.ok(Object.values(TRIAL).includes(t.type), `${label}: type`);
    assert.equal(t.scheduledOnsetMs, config.firstOnsetMs + i * config.trialMs, `${label}: onset of trial ${t.trial}`);
    assert.equal(t.windowMs, windowMs, `${label}: window`);

    // The right moles for the trial type, good one listed first.
    const valences = t.targets.map((x) => x.valence).join('+');
    const expected = { good: 'good', bad: 'bad', both: 'good+bad' }[t.type];
    assert.equal(valences, expected, `${label}: moles on trial ${t.trial}`);
    for (const x of t.targets) {
      assert.ok(Number.isInteger(x.hole) && x.hole >= 0 && x.hole < layout.holes, `${label}: hole in range`);
      assert.equal(x.response, layout.holeResponse[x.hole], `${label}: response is the hole's column`);
      assert.equal(x.row, Math.floor(x.hole / layout.columns) + 1, `${label}: row`);
      assert.equal(x.col, (x.hole % layout.columns) + 1, `${label}: col`);
      assert.equal(x.stim, x.valence === 'good' ? GOOD_STIM : config.badStim, `${label}: picture`);
    }
    // Both trials: the two moles are in different columns.
    if (t.type === TRIAL.BOTH) {
      assert.notEqual(t.targets[0].response, t.targets[1].response, `${label}: both-trial ${t.trial} in one column`);
    }
  });

  // Exact counts.
  const c = trialCounts(n, config);
  for (const type of ['good', 'bad', 'both']) {
    assert.equal(trials.filter((t) => t.type === type).length, c[type], `${label}: ${type} count`);
  }

  // First 3 good; no two bad in a row; no hole reused from the previous trial.
  for (let i = 0; i < Math.min(LEAD_IN_GO_TRIALS, n); i++) assert.equal(trials[i].type, TRIAL.GOOD, `${label}: lead-in`);
  for (let i = 1; i < n; i++) {
    assert.ok(!(trials[i].type === TRIAL.BAD && trials[i - 1].type === TRIAL.BAD), `${label}: bad trials adjacent at ${i + 1}`);
    const prev = trials[i - 1].targets.map((x) => x.hole);
    for (const x of trials[i].targets) assert.ok(!prev.includes(x.hole), `${label}: hole reused at trial ${i + 1}`);
  }

  // Moles never overlap across trials.
  assert.ok(windowMs <= config.trialMs, `${label}: window exceeds the cycle`);

  // preceding_go: press-required trials since the last bad trial, on trials with a bad mole.
  let streak = 0;
  for (const t of trials) {
    assert.equal(t.precedingGo, t.type === TRIAL.GOOD ? null : streak, `${label}: preceding_go on trial ${t.trial}`);
    streak = t.type === TRIAL.BAD ? 0 : streak + 1;
  }
}

test('schedule: the default run is 600 trials at 1 s, split 80 / 10 / 10', () => {
  const config = cfg();
  const trials = buildSchedule(config);
  assert.equal(trials.length, 600);
  assert.equal(config.durationS, 602);
  const n = (type) => trials.filter((t) => t.type === type).length;
  assert.equal(n('good'), 480);
  assert.equal(n('bad'), 60);
  assert.equal(n('both'), 60);
  checkConstraints(trials, config, 'default run');
});

test('schedule: same config and seed produce an identical schedule', () => {
  for (const seed of [0, 1, 1234, -5, 2 ** 31 - 1, 987654321]) {
    const config = cfg({ seed, ...SHORT });
    const a = buildSchedule(config);
    assert.deepEqual(a, buildSchedule(config));
    assert.equal(JSON.stringify(a), JSON.stringify(buildSchedule(config)));
  }
});

test('schedule: interleaved calls with other seeds do not change the result', () => {
  const a1 = buildSchedule(cfg({ seed: 11, ...SHORT }));
  buildSchedule(cfg({ seed: 12, ...SHORT }));
  buildSchedule(cfg({ seed: 13, layout: 'grid9', nTrials: 40 }));
  assert.deepEqual(buildSchedule(cfg({ seed: 11, ...SHORT })), a1);
});

test('schedule: different seeds give different schedules', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 50; seed++) seen.add(JSON.stringify(buildSchedule(cfg({ seed, ...SHORT }))));
  assert.ok(seen.size >= 49, `expected near-unique schedules, got ${seen.size} of 50`);
});

test('schedule: the bad picture follows config, the good one is always the happy mole', () => {
  for (const badStim of ['mole_sad', 'molerat']) {
    const trials = buildSchedule(cfg({ badStim, ...SHORT }));
    const stims = new Set(trials.flatMap((t) => t.targets.map((x) => `${x.valence}:${x.stim}`)));
    assert.deepEqual([...stims].sort(), [`bad:${badStim}`, 'good:mole_happy']);
  }
});

test('schedule: every column is used, and both trials use every pair of columns', () => {
  const trials = buildSchedule(cfg({ seed: 7 }));
  const cols = [0, 0, 0];
  const pairs = new Set();
  for (const t of trials) {
    for (const x of t.targets) cols[x.response]++;
    if (t.type === 'both') pairs.add(t.targets.map((x) => x.col).sort().join('-'));
  }
  assert.ok(cols.every((c) => c > 150), `columns used: ${cols.join(', ')}`);
  assert.deepEqual([...pairs].sort(), ['1-2', '1-3', '2-3']);
});

test('schedule: the input config is not modified', () => {
  const config = cfg({ seed: 3, ...SHORT });
  const before = JSON.stringify(config);
  buildSchedule(config);
  assert.equal(JSON.stringify(config), before);
});

test(`schedule: constraints hold across ${SEEDS} seeds, 3x3 column layout`, () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const config = cfg({ seed, ...SHORT });
    checkConstraints(buildSchedule(config), config, `seed ${seed}`);
  }
});

test(`schedule: constraints hold across ${SEEDS} seeds, one key per hole and four in a row`, () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (const layout of ['grid9', 'row4']) {
      const config = cfg({ seed, layout, nTrials: 40 });
      checkConstraints(buildSchedule(config), config, `${layout} seed ${seed}`);
    }
  }
});

test('schedule: constraints hold across trial mixes', () => {
  const mixes = [
    [0.8, 0.1, 0.1], [0.7, 0.2, 0.1], [1, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0.4, 0.3, 0.3], [0, 0.5, 0.5],
  ];
  for (const [goodShare, badShare, bothShare] of mixes) {
    for (let seed = 1; seed <= 100; seed++) {
      const config = cfg({ seed, goodShare, badShare, bothShare, nTrials: 80 });
      checkConstraints(buildSchedule(config), config, `mix ${goodShare}/${badShare}/${bothShare} seed ${seed}`);
    }
  }
});

test('schedule: constraints hold across trial cycles and hold times', () => {
  for (const p of [
    { trialMs: 1000, holdMs: 999 },
    { trialMs: 800, holdMs: 500 },
    { trialMs: 2000, holdMs: 1200 },
    { trialMs: 1000, holdMs: 300, onset: 'gradual', rampMs: 350 },
  ]) {
    for (let seed = 1; seed <= 150; seed++) {
      const config = cfg({ seed, nTrials: 50, ...p });
      checkConstraints(buildSchedule(config), config, `${JSON.stringify(p)} seed ${seed}`);
    }
  }
});

test('schedule: trialCounts is exact, and caps bad trials by the no-adjacent rule', () => {
  const c = (n, goodShare, badShare, bothShare) => trialCounts(n, { goodShare, badShare, bothShare });
  assert.deepEqual(c(600, 0.8, 0.1, 0.1), { good: 480, bad: 60, both: 60 });
  assert.deepEqual(c(600, 0.7, 0.2, 0.1), { good: 420, bad: 120, both: 60 });
  assert.deepEqual(c(10, 0.0, 1.0, 0.0), { good: 6, bad: 4, both: 0 }, 'at most every other trial after the lead-in');
  assert.deepEqual(c(3, 0.8, 0.1, 0.1), { good: 3, bad: 0, both: 0 }, 'the lead-in is all good');
});
