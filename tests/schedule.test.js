import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { buildSchedule, trialWindowMs, nogoCount, LEAD_IN_GO_TRIALS } from '../src/schedule.js';

const cfg = (p = {}) => resolveConfig(p);
const SEEDS = 1200;

/** Check every README 3.4 constraint on one schedule. */
function checkConstraints(trials, config, label) {
  const n = trials.length;
  const nHoles = config.keys.length;
  const windowMs = trialWindowMs(config);
  const endMs = config.durationS * 1000;
  assert.ok(n > 0, `${label}: schedule is not empty`);

  // Numbering and record shape.
  trials.forEach((t, i) => {
    assert.equal(t.trial, i + 1, `${label}: trial numbers are 1-based and consecutive`);
    assert.ok(['go', 'nogo'].includes(t.type), `${label}: type`);
    assert.ok(Number.isInteger(t.hole) && t.hole >= 0 && t.hole < nHoles, `${label}: hole in range`);
    assert.ok(Number.isInteger(t.scheduledOnsetMs), `${label}: integer onset`);
    assert.equal(t.windowMs, windowMs, `${label}: window`);
  });

  // Exact go/no-go counts.
  const nNogo = trials.filter((t) => t.type === 'nogo').length;
  assert.equal(nNogo, nogoCount(n, config.goProb), `${label}: no-go count`);
  const slots = Math.max(0, n - LEAD_IN_GO_TRIALS);
  const uncapped = Math.round(n * (1 - config.goProb));
  if (uncapped <= Math.floor((slots + 1) / 2)) {
    assert.equal(nNogo, uncapped, `${label}: exact proportion`);
  }

  // First 3 go; no two no-go in a row.
  for (let i = 0; i < Math.min(LEAD_IN_GO_TRIALS, n); i++) assert.equal(trials[i].type, 'go', `${label}: trial ${i + 1} is go`);
  for (let i = 1; i < n; i++) {
    assert.ok(!(trials[i].type === 'nogo' && trials[i - 1].type === 'nogo'), `${label}: consecutive no-go at ${i + 1}`);
  }

  // Same hole never twice in a row.
  for (let i = 1; i < n; i++) assert.notEqual(trials[i].hole, trials[i - 1].hole, `${label}: repeated hole at trial ${i + 1}`);

  // Timing: first onset, gaps, no overlap, fits the run.
  assert.equal(trials[0].scheduledOnsetMs, config.firstOnsetMs, `${label}: first onset`);
  for (let i = 1; i < n; i++) {
    const gap = trials[i].scheduledOnsetMs - trials[i - 1].scheduledOnsetMs;
    assert.ok(gap >= windowMs + config.isiMinMs, `${label}: gap ${gap} < window + isiMin at trial ${i + 1}`);
    assert.ok(gap <= windowMs + config.isiMaxMs + 1, `${label}: gap ${gap} > window + isiMax at trial ${i + 1}`);
  }
  assert.ok(trials[n - 1].scheduledOnsetMs + windowMs <= endMs, `${label}: last window fits in the run`);

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
    const config = cfg({ seed });
    const a = buildSchedule(config);
    const b = buildSchedule(config);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.notEqual(a, b, 'a fresh array each call');
  }
});

test('schedule: interleaved calls with other seeds do not change the result', () => {
  const a1 = buildSchedule(cfg({ seed: 11 }));
  buildSchedule(cfg({ seed: 12 }));
  buildSchedule(cfg({ seed: 13, layout: 'grid9', onset: 'gradual' }));
  assert.deepEqual(buildSchedule(cfg({ seed: 11 })), a1);
});

test('schedule: different seeds give different schedules', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 50; seed++) seen.add(JSON.stringify(buildSchedule(cfg({ seed }))));
  assert.ok(seen.size >= 49, `expected near-unique schedules, got ${seen.size} of 50`);
});

test('schedule: golden values for the default config, seed 1234 (matches index.html)', () => {
  const trials = buildSchedule(cfg({ seed: 1234 }));
  assert.equal(trials.length, 32);
  const head = trials.slice(0, 6).map((t) => [t.trial, t.type, t.hole, t.scheduledOnsetMs, t.precedingGo]);
  assert.deepEqual(head, [
    [1, 'go', 0, 2000, null],
    [2, 'go', 3, 3892, null],
    [3, 'go', 0, 5972, null],
    [4, 'go', 3, 7454, null],
    [5, 'nogo', 0, 9133, 4],
    [6, 'go', 1, 10914, null],
  ]);
  assert.equal(trials.filter((t) => t.type === 'nogo').length, 6); // round(32 * 0.2)
});

test('schedule: the input config is not modified', () => {
  const config = cfg({ seed: 3 });
  const before = JSON.stringify(config);
  buildSchedule(config);
  assert.equal(JSON.stringify(config), before);
});

test(`schedule: constraints hold across ${SEEDS} seeds, default config`, () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const config = cfg({ seed });
    checkConstraints(buildSchedule(config), config, `seed ${seed}`);
  }
});

test(`schedule: constraints hold across ${SEEDS} seeds, grid9 + gradual + 300 s`, () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const config = cfg({ seed, layout: 'grid9', onset: 'gradual', durationS: 300 });
    checkConstraints(buildSchedule(config), config, `grid9 seed ${seed}`);
  }
});

test('schedule: constraints hold for every go share the console offers, and at the edges', () => {
  const shares = [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];
  for (const goProb of shares) {
    for (let seed = 1; seed <= 150; seed++) {
      const config = cfg({ seed, goProb });
      const trials = buildSchedule(config);
      checkConstraints(trials, config, `goProb ${goProb} seed ${seed}`);
      const n = trials.length;
      assert.equal(trials.filter((t) => t.type === 'nogo').length, Math.round(n * (1 - goProb)));
    }
  }
});

test('schedule: constraints hold with zero and equal gaps (no overlap even with isiMin 0)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const p of [{ isiMinMs: 0, isiMaxMs: 0 }, { isiMinMs: 0, isiMaxMs: 300 }, { isiMinMs: 700, isiMaxMs: 700 }]) {
      const config = cfg({ seed, ...p, holdMs: 450 });
      checkConstraints(buildSchedule(config), config, `${JSON.stringify(p)} seed ${seed}`);
    }
  }
});

test('schedule: short runs still satisfy the lead-in and no-consecutive rules', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const config = cfg({ seed, durationS: 15, goProb: 0.6, holdMs: 3000, isiMinMs: 100, isiMaxMs: 100 });
    const trials = buildSchedule(config);
    checkConstraints(trials, config, `short seed ${seed}`);
  }
});

test('schedule: window length follows the onset mode', () => {
  assert.equal(trialWindowMs(cfg({ onset: 'instant' })), 900);
  assert.equal(trialWindowMs(cfg({ onset: 'gradual' })), 900 + 2 * 350);
  assert.equal(trialWindowMs(cfg({ onset: 'gradual', rampMs: 100, holdMs: 500 })), 700);
});

test('schedule: nogoCount is exact when uncapped and capped by the no-consecutive rule', () => {
  assert.equal(nogoCount(32, 0.8), 6);
  assert.equal(nogoCount(10, 0.5), 4);   // round(5) = 5, cap floor((7 + 1) / 2) = 4
  assert.equal(nogoCount(3, 0.5), 0);
  assert.equal(nogoCount(0, 0.8), 0);
});

test('schedule: run length and first onset come from config', () => {
  const trials = buildSchedule(cfg({ seed: 5, firstOnsetMs: 4000, durationS: 120 }));
  assert.equal(trials[0].scheduledOnsetMs, 4000);
  assert.ok(trials.at(-1).scheduledOnsetMs + 900 <= 120000);
  assert.ok(trials.length > 50);
});
