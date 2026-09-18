import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTCOME, classifyPress, classifyTimeout, classifyRunEnd, endsTrial, hasResponseTime,
} from '../src/classify.js';

const go = (hole = 1) => ({ type: 'go', hole });
const nogo = (hole = 1) => ({ type: 'nogo', hole });

// One test per row of the README 3.3 table.

test('3.3 hit: go target up, matching key pressed', () => {
  assert.equal(classifyPress(go(2), 2), 'hit');
  assert.equal(endsTrial('hit'), true);
  assert.equal(hasResponseTime('hit'), true);
});

test('3.3 omission: go target goes down, no matching press', () => {
  assert.equal(classifyTimeout(go()), 'omission');
  assert.equal(endsTrial('omission'), true);
  assert.equal(hasResponseTime('omission'), false);
});

test('3.3 commission: no-go target up, matching key pressed', () => {
  assert.equal(classifyPress(nogo(0), 0), 'commission');
  assert.equal(endsTrial('commission'), true);
  assert.equal(hasResponseTime('commission'), true);
});

test('3.3 correct_rejection: no-go target goes down, no press', () => {
  assert.equal(classifyTimeout(nogo()), 'correct_rejection');
  assert.equal(endsTrial('correct_rejection'), true);
  assert.equal(hasResponseTime('correct_rejection'), false);
});

test('3.3 wrong_hole: target up, key for a different hole pressed; trial continues', () => {
  assert.equal(classifyPress(go(1), 3), 'wrong_hole');
  // TODO(Q11): a different-hole press during a no-go is wrong_hole, not commission.
  assert.equal(classifyPress(nogo(1), 0), 'wrong_hole');
  assert.equal(endsTrial('wrong_hole'), false);
  assert.equal(hasResponseTime('wrong_hole'), false);
});

test('3.3 no_target_press: no target up, any mapped key pressed', () => {
  assert.equal(classifyPress(null, 0), 'no_target_press');
  assert.equal(classifyPress(undefined, 8), 'no_target_press');
  assert.equal(endsTrial('no_target_press'), false);
  assert.equal(hasResponseTime('no_target_press'), false);
});

test('3.3 truncated: run ends while a target is up', () => {
  assert.equal(classifyRunEnd(go()), 'truncated');
  assert.equal(classifyRunEnd(nogo()), 'truncated');
  assert.equal(classifyRunEnd(null), null, 'nothing to truncate when no target is up');
  assert.equal(endsTrial('truncated'), true);
  assert.equal(hasResponseTime('truncated'), false);
});

test('classify: every outcome code in the table is exported exactly once', () => {
  assert.deepEqual(Object.values(OUTCOME).sort(), [
    'commission', 'correct_rejection', 'hit', 'no_target_press', 'omission', 'truncated', 'wrong_hole',
  ]);
});

test('classify: rejects malformed input instead of guessing', () => {
  assert.throws(() => classifyPress({ type: 'maybe', hole: 0 }, 0), /unknown trial type/);
  assert.throws(() => classifyTimeout({ type: 'maybe' }), /unknown trial type/);
  assert.throws(() => classifyTimeout(null), /active trial/);
  assert.throws(() => classifyPress(go(0), 0.5), /integer/);
  assert.throws(() => classifyPress(go(0), '0'), /integer/);
});
