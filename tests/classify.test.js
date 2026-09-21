import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTCOME, classifyPress, classifyTimeout, classifyRunEnd, endsTrial, hasResponseTime,
} from '../src/classify.js';

// `response` is the 0-based button (column) the trial expects.
const go = (response = 1) => ({ type: 'go', response });
const nogo = (response = 1) => ({ type: 'nogo', response });

// One test per row of the README 3.3 table.

test('3.3 hit: happy mole up, its column button pressed', () => {
  assert.equal(classifyPress(go(2), 2), 'hit');
  assert.equal(endsTrial('hit'), true);
  assert.equal(hasResponseTime('hit'), true);
});

test('3.3 omission: happy mole goes down with no press', () => {
  assert.equal(classifyTimeout(go()), 'omission');
  assert.equal(endsTrial('omission'), true);
  assert.equal(hasResponseTime('omission'), false);
});

test('3.3 commission: skip trial up, its column button pressed', () => {
  assert.equal(classifyPress(nogo(0), 0), 'commission');
  assert.equal(endsTrial('commission'), true);
  assert.equal(hasResponseTime('commission'), true);
});

test('3.3 correct_rejection: skip trial goes down with no press', () => {
  assert.equal(classifyTimeout(nogo()), 'correct_rejection');
  assert.equal(endsTrial('correct_rejection'), true);
  assert.equal(hasResponseTime('correct_rejection'), false);
});

test('3.3 wrong_hole: a different column is pressed; the trial continues', () => {
  assert.equal(classifyPress(go(1), 2), 'wrong_hole');
  // DECIDED(Q11): still wrong_hole, not a commission, on a skip trial.
  assert.equal(classifyPress(nogo(1), 0), 'wrong_hole');
  assert.equal(endsTrial('wrong_hole'), false);
  assert.equal(hasResponseTime('wrong_hole'), false);
});

test('3.3 no_target_press: nothing up, any mapped button pressed', () => {
  assert.equal(classifyPress(null, 0), 'no_target_press');
  assert.equal(classifyPress(undefined, 2), 'no_target_press');
  assert.equal(endsTrial('no_target_press'), false);
});

test('3.3 truncated: the run ends while a target is up', () => {
  assert.equal(classifyRunEnd(go()), 'truncated');
  assert.equal(classifyRunEnd(nogo()), 'truncated');
  assert.equal(classifyRunEnd(null), null);
  assert.equal(endsTrial('truncated'), true);
  assert.equal(hasResponseTime('truncated'), false);
});

test('classify: the row a mole is in does not change the correct button', () => {
  // Three holes in column 2 (holes 1, 4, 7) all expect button index 1.
  for (const response of [1, 1, 1]) {
    assert.equal(classifyPress(go(response), 1), 'hit');
    assert.equal(classifyPress(go(response), 0), 'wrong_hole');
  }
});

test('classify: every outcome code in the table is exported exactly once', () => {
  assert.deepEqual(Object.values(OUTCOME).sort(), [
    'commission', 'correct_rejection', 'hit', 'no_target_press', 'omission', 'truncated', 'wrong_hole',
  ]);
});

test('classify: rejects malformed input instead of guessing', () => {
  assert.throws(() => classifyPress({ type: 'maybe', response: 0 }, 0), /unknown trial type/);
  assert.throws(() => classifyPress({ type: 'go' }, 0), /integer `response`/);
  assert.throws(() => classifyTimeout({ type: 'maybe' }), /unknown trial type/);
  assert.throws(() => classifyTimeout(null), /active trial/);
  assert.throws(() => classifyPress(go(0), 0.5), /integer/);
  assert.throws(() => classifyPress(go(0), '0'), /integer/);
});
