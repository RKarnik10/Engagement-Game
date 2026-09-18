/**
 * Response classification: README section 3.3.
 *
 * PURE. No DOM, no clock. The engine calls these with the active trial (or
 * null) and the pressed hole; the renderer never decides outcomes.
 *
 * | Situation                                   | Outcome             |
 * |---------------------------------------------|---------------------|
 * | Go target up, matching key pressed          | hit                 |
 * | Go target goes down, no matching press      | omission            |
 * | No-go target up, matching key pressed       | commission          |
 * | No-go target goes down, no press            | correct_rejection   |
 * | Target up, key for a different hole pressed | wrong_hole          |
 * | No target up, any mapped key pressed        | no_target_press     |
 * | Run ends while a target is up               | truncated           |
 */

export const OUTCOME = Object.freeze({
  HIT: 'hit',
  OMISSION: 'omission',
  COMMISSION: 'commission',
  CORRECT_REJECTION: 'correct_rejection',
  WRONG_HOLE: 'wrong_hole',
  NO_TARGET_PRESS: 'no_target_press',
  TRUNCATED: 'truncated',
});

export const TRIAL_TYPE = Object.freeze({ GO: 'go', NOGO: 'nogo' });

/** Outcomes that end the active trial (the target goes down). */
const TRIAL_ENDING = new Set([
  OUTCOME.HIT, OUTCOME.OMISSION, OUTCOME.COMMISSION, OUTCOME.CORRECT_REJECTION, OUTCOME.TRUNCATED,
]);

/** Outcomes that carry a reaction time (a press on the target's own hole). */
const WITH_RT = new Set([OUTCOME.HIT, OUTCOME.COMMISSION]);

function assertType(trial) {
  if (trial.type !== TRIAL_TYPE.GO && trial.type !== TRIAL_TYPE.NOGO) {
    throw new Error(`classify: unknown trial type "${trial.type}"`);
  }
}

/**
 * Classify a key/pointer press.
 *
 * @param {{type: 'go'|'nogo', hole: number} | null | undefined} active
 *        The trial currently up, or null when no target is up.
 * @param {number} pressedHole  0-based hole index that was pressed.
 * @returns {'hit'|'commission'|'wrong_hole'|'no_target_press'}
 */
export function classifyPress(active, pressedHole) {
  if (!Number.isInteger(pressedHole)) {
    throw new Error(`classify: pressedHole must be an integer, got ${pressedHole}`);
  }
  if (!active) return OUTCOME.NO_TARGET_PRESS;
  assertType(active);
  // TODO(Q11): a different-hole press while a no-go target is up is logged as
  // wrong_hole (not a commission). The trial continues.
  if (pressedHole !== active.hole) return OUTCOME.WRONG_HOLE;
  return active.type === TRIAL_TYPE.GO ? OUTCOME.HIT : OUTCOME.COMMISSION;
}

/**
 * Classify a target that went down without a press on its own hole.
 *
 * @param {{type: 'go'|'nogo'}} active
 * @returns {'omission'|'correct_rejection'}
 */
export function classifyTimeout(active) {
  if (!active) throw new Error('classify: classifyTimeout needs an active trial');
  assertType(active);
  return active.type === TRIAL_TYPE.GO ? OUTCOME.OMISSION : OUTCOME.CORRECT_REJECTION;
}

/**
 * Classify the active trial when the run ends.
 *
 * @param {object|null|undefined} active
 * @returns {'truncated'|null}  null when no target was up.
 */
export function classifyRunEnd(active) {
  return active ? OUTCOME.TRUNCATED : null;
}

/** True when the outcome ends the active trial. */
export function endsTrial(outcome) {
  return TRIAL_ENDING.has(outcome);
}

/** True when the outcome carries a reaction time. */
export function hasResponseTime(outcome) {
  return WITH_RT.has(outcome);
}
