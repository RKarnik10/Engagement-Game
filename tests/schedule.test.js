import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, LAYOUTS, trialWindowMs } from '../src/config.js';
import { buildSchedule, nogoCount, LEAD_IN_GO_TRIALS, STIM } from '../src/schedule.js';

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
    assert.ok(['go', 'nogo'].includes(t.type), `${label}: type`);
    assert.ok(Object.values(STIM).includes(t.stim), `${label}: stimulus name`);
    assert.equal(t.type === 'go', t.stim === STIM.GO, `${label}: picture matches type on trial ${t.trial}`);
    assert.ok(Number.isInteger(t.hole) && t.hole >= 0 && t.hole < layout.holes, `${label}: hole in range`);
    assert.equal(t.response, layout.holeResponse[t.hole], `${label}: response is the hole's column`);
    assert.ok(t.response >= 0 && t.response < config.keys.length, `${label}: response in range`);
    assert.equal(t.row, Math.floor(t.hole / layout.columns) + 1, `${label}: row`);
    assert.equal(t.col, (t.hole % layout.columns) + 1, `${label}: col`);
    assert.equal(t.windowMs, windowMs, `${label}: window`);
    // Fixed cycle: onsets are exact, with no jitter.
    assert.equal(t.scheduledOnsetMs, config.firstOnsetMs + i * config.trialMs, `${label}: onset of trial ${t.trial}`);
  });

  // Exact counts: go/no-go, and the two skip pictures.
  const nNogo = trials.filter((t) => t.type === 'nogo').length;
  assert.equal(nNogo, nogoCount(n, config.goProb), `${label}: no-go count`);
  const nSad = trials.filter((t) => t.stim === STIM.NOGO_SAD).length;
  const nRat = trials.filter((t) => t.stim === STIM.NOGO_RAT).length;
  assert.equal(nSad, Math.round(nNogo * config.nogoSadShare), `${label}: sad-mole count`);
  assert.equal(nSad + nRat, nNogo, `${label}: skip pictures add up`);

  // First 3 go; no two skip trials in a row.
  for (let i = 0; i < Math.min(LEAD_IN_GO_TRIALS, n); i++) {
    assert.equal(trials[i].type, 'go', `${label}: trial ${i + 1} is go`);
  }
  for (let i = 1; i < n; i++) {
    assert.ok(!(trials[i].type === 'nogo' && trials[i - 1].type === 'nogo'), `${label}: consecutive no-go at ${i + 1}`);
    assert.notEqual(trials[i].hole, trials[i - 1].hole, `${label}: repeated hole at trial ${i + 1}`);
  }

  // Targets never overlap: a target is down before the next one is due.
  assert.ok(windowMs <= config.trialMs, `${label}: window ${windowMs} exceeds the ${config.trialMs} ms cycle`);

  // preceding_go.
  let streak = 0;
  for (const t of trials) {
    if (t.type === 'nogo') assert.equal(t.precedingGo, streak, `${label}: preceding_go on trial ${t.trial}`);
    else assert.equal(t.precedingGo, null, `${label}: preceding_go is null on go trials`);
    streak = t.type === 'go' ? streak + 1 : 0;
  }
}

test('schedule: same config and seed produce an identical schedule', () => {
  for (const seed of [0, 1, 1234, -5, 2 ** 31 - 1, 987654321]) {
    const config = cfg({ seed, ...SHORT });
    const a = buildSchedule(config);
    const b = buildSchedule(config);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.notEqual(a, b, 'a fresh array each call');
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

test('schedule: the run Dr. Song asked for is 600 trials at 1 s, split 80 / 10 / 10', () => {
  const config = cfg();
  assert.equal(config.nTrials, 600);
  assert.equal(config.trialMs, 1000);
  const trials = buildSchedule(config);
  assert.equal(trials.length, 600);
  assert.equal(trials.at(-1).scheduledOnsetMs, 2000 + 599 * 1000);
  assert.equal(config.durationS, 602);
  const n = (stim) => trials.filter((t) => t.stim === stim).length;
  assert.equal(n(STIM.GO), 480);
  assert.equal(n(STIM.NOGO_SAD), 60);
  assert.equal(n(STIM.NOGO_RAT), 60);
  checkConstraints(trials, config, 'default 600-trial run');
});

test('schedule: three buttons cover nine holes, and every column is used', () => {
  const trials = buildSchedule(cfg({ seed: 7 }));
  const byCol = [0, 0, 0];
  for (const t of trials) {
    assert.equal(t.response, t.col - 1, 'the expected button is the column');
    byCol[t.response]++;
  }
  assert.ok(byCol.every((c) => c > 100), `every column is used: ${byCol.join(', ')}`);
  const rows = new Set(trials.map((t) => t.row));
  assert.deepEqual([...rows].sort(), [1, 2, 3]);
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

test(`schedule: constraints hold across ${SEEDS} seeds, one key per hole`, () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const config = cfg({ seed, layout: 'grid9', nTrials: 60 });
    checkConstraints(buildSchedule(config), config, `grid9 seed ${seed}`);
  }
});

test('schedule: constraints hold for every go share the console offers', () => {
  for (const goProb of [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0]) {
    for (let seed = 1; seed <= 120; seed++) {
      const config = cfg({ seed, goProb, nTrials: 80 });
      const trials = buildSchedule(config);
      checkConstraints(trials, config, `goProb ${goProb} seed ${seed}`);
      // Exact, except where the "no two skip trials in a row" rule caps it
      // (at goProb 0.5 that is 39 of 80, not 40).
      assert.equal(trials.filter((t) => t.type === 'nogo').length, nogoCount(80, goProb));
    }
  }
});

test('schedule: constraints hold across trial cycles and hold times', () => {
  for (const p of [
    { trialMs: 1000, holdMs: 800 },
    { trialMs: 1000, holdMs: 999 },
    { trialMs: 800, holdMs: 500 },
    { trialMs: 2000, holdMs: 1200 },
    { trialMs: 1000, holdMs: 300, onset: 'gradual', rampMs: 350 },
  ]) {
    for (let seed = 1; seed <= 200; seed++) {
      const config = cfg({ seed, nTrials: 50, ...p });
      checkConstraints(buildSchedule(config), config, `${JSON.stringify(p)} seed ${seed}`);
    }
  }
});

test('schedule: short runs still satisfy the lead-in and no-consecutive rules', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const config = cfg({ seed, nTrials: 10, goProb: 0.6 });
    checkConstraints(buildSchedule(config), config, `short seed ${seed}`);
  }
});

test('schedule: nogoCount is exact when uncapped and capped by the no-consecutive rule', () => {
  assert.equal(nogoCount(600, 0.8), 120);
  assert.equal(nogoCount(32, 0.8), 6);
  assert.equal(nogoCount(10, 0.5), 4);   // round(5) = 5, cap floor((7 + 1) / 2) = 4
  assert.equal(nogoCount(3, 0.5), 0);
  assert.equal(nogoCount(0, 0.8), 0);
});

test('schedule: trial count and lead-in come from config', () => {
  const trials = buildSchedule(cfg({ seed: 5, nTrials: 120, firstOnsetMs: 4000, trialMs: 1500 }));
  assert.equal(trials.length, 120);
  assert.equal(trials[0].scheduledOnsetMs, 4000);
  assert.equal(trials[1].scheduledOnsetMs, 5500);
});
