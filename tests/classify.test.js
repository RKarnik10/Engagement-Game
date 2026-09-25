import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTCOME, classifyPress, classifyTimeout, classifyRunEnd, classifyTrial, trialCorrect, hasResponseTime,
} from '../src/classify.js';

// `response` is the 0-based button (column) of the mole.
const good = (response = 1) => ({ valence: 'good', response });
const bad = (response = 1) => ({ valence: 'bad', response });

// One test per row of the README 3.3 table.

test('3.3 hit: good mole up, its column pressed', () => {
  const g = good(2);
  assert.deepEqual(classifyPress([g], 2), { outcome: 'hit', target: g });
  assert.equal(hasResponseTime('hit'), true);
});

test('3.3 omission: good mole goes down with no press', () => {
  assert.equal(classifyTimeout(good()), 'omission');
  assert.equal(hasResponseTime('omission'), false);
});

test('3.3 commission: bad mole up, its column pressed', () => {
  const b = bad(0);
  assert.deepEqual(classifyPress([b], 0), { outcome: 'commission', target: b });
  assert.equal(hasResponseTime('commission'), true);
});

test('3.3 correct_rejection: bad mole goes down with no press', () => {
  assert.equal(classifyTimeout(bad()), 'correct_rejection');
});

test('3.3 wrong_hole: a column with no mole pressed while a mole is up', () => {
  assert.deepEqual(classifyPress([good(1)], 2), { outcome: 'wrong_hole', target: null });
  // DECIDED(Q11): never a commission, even when the mole up is bad.
  assert.deepEqual(classifyPress([bad(1)], 0), { outcome: 'wrong_hole', target: null });
});

test('3.3 no_target_press: nothing up', () => {
  assert.deepEqual(classifyPress([], 0), { outcome: 'no_target_press', target: null });
  assert.deepEqual(classifyPress(null, 2), { outcome: 'no_target_press', target: null });
});

test('3.3 truncated: the run ends while a mole is up', () => {
  assert.equal(classifyRunEnd(good()), 'truncated');
  assert.equal(classifyRunEnd(null), null);
});

test('both trial: pressing the good column hits the good mole only', () => {
  const g = good(0);
  const b = bad(2);
  assert.deepEqual(classifyPress([g, b], 0), { outcome: 'hit', target: g });
});

test('both trial: pressing the bad column is a commission on the bad mole', () => {
  const g = good(0);
  const b = bad(2);
  assert.deepEqual(classifyPress([g, b], 2), { outcome: 'commission', target: b });
});

test('both trial: pressing the third column is a wrong-column press', () => {
  assert.deepEqual(classifyPress([good(0), bad(2)], 1), { outcome: 'wrong_hole', target: null });
});

test('both trial: after the good mole is hit, only the bad one is left to classify', () => {
  const b = bad(2);
  assert.deepEqual(classifyPress([b], 0), { outcome: 'wrong_hole', target: null }, 'the good column is empty now');
  assert.deepEqual(classifyPress([b], 2), { outcome: 'commission', target: b });
});

const trial = (type, ...targets) => ({ trial: 1, type, targets });
const withOutcome = (t, outcome) => ({ ...t, outcome });

test('trial outcome: good and bad trials take their mole\'s outcome', () => {
  for (const o of ['hit', 'omission']) {
    const t = trial('good', withOutcome(good(), o));
    assert.equal(classifyTrial(t), o);
    assert.equal(trialCorrect(t), o === 'hit' ? 1 : 0);
  }
  for (const o of ['commission', 'correct_rejection']) {
    const t = trial('bad', withOutcome(bad(), o));
    assert.equal(classifyTrial(t), o);
    assert.equal(trialCorrect(t), o === 'correct_rejection' ? 1 : 0);
  }
});

test('trial outcome: all four combinations of a both trial', () => {
  const cases = [
    ['hit', 'correct_rejection', 'hit', 1],
    ['hit', 'commission', 'commission', 0],
    ['omission', 'correct_rejection', 'omission', 0],
    ['omission', 'commission', 'commission', 0],
  ];
  for (const [g, b, outcome, correct] of cases) {
    const t = trial('both', withOutcome(good(0), g), withOutcome(bad(2), b));
    assert.equal(classifyTrial(t), outcome, `${g} + ${b}`);
    assert.equal(trialCorrect(t), correct, `${g} + ${b}`);
  }
});

test('trial outcome: any truncated mole makes the trial truncated, neither right nor wrong', () => {
  const t = trial('both', withOutcome(good(0), 'hit'), withOutcome(bad(2), 'truncated'));
  assert.equal(classifyTrial(t), 'truncated');
  assert.equal(trialCorrect(t), null);
});

test('classify: every outcome code is exported exactly once', () => {
  assert.deepEqual(Object.values(OUTCOME).sort(), [
    'commission', 'correct_rejection', 'hit', 'no_target_press', 'omission', 'truncated', 'wrong_hole',
  ]);
});

test('classify: rejects malformed input instead of guessing', () => {
  assert.throws(() => classifyPress([{ valence: 'maybe', response: 0 }], 0), /valence/);
  assert.throws(() => classifyPress([{ valence: 'good' }], 0), /integer `response`/);
  assert.throws(() => classifyTimeout({ valence: 'maybe', response: 0 }), /valence/);
  assert.throws(() => classifyPress([good(0)], 0.5), /integer/);
  assert.throws(() => classifyTrial(trial('good', good(0))), /still has a mole up/);
});
