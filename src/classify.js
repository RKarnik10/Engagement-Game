/**
 * Response classification: README section 3.3.
 *
 * PURE. No DOM, no clock. The engine calls these with the moles currently
 * up and the button that was pressed; the renderer never decides outcomes.
 *
 * A button is a COLUMN. Each mole ("target") carries `response`, the 0-based
 * button for its column, and `valence`, "good" or "bad". A trial shows one
 * mole, or two at once ("both" trials) in different columns.
 *
 * Per mole:
 * | Situation                                        | Outcome             |
 * |--------------------------------------------------|---------------------|
 * | Good mole up, its column's button pressed        | hit                 |
 * | Good mole goes down with no press                | omission            |
 * | Bad mole up, its column's button pressed         | commission          |
 * | Bad mole goes down with no press                 | correct_rejection   |
 * | Run ends while a mole is up                      | truncated           |
 *
 * Per press that does not land on a mole:
 * | Mole(s) up, a column with no mole pressed        | wrong_hole          |
 * | Nothing up, any mapped button pressed            | no_target_press     |
 *
 * A hit or commission takes that mole down. In a "both" trial the other mole
 * stays up until its own press or the end of the window.
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

const VALENCES = new Set(['good', 'bad']);
const WITH_RT = new Set([OUTCOME.HIT, OUTCOME.COMMISSION]);

function assertTarget(t) {
  if (!t || !VALENCES.has(t.valence)) {
    throw new Error(`classify: unknown mole valence "${t && t.valence}"`);
  }
  if (!Number.isInteger(t.response)) {
    throw new Error('classify: each mole needs an integer `response` (its column button)');
  }
}

/**
 * Classify a button press against the moles currently up.
 *
 * @param {Array<{valence: 'good'|'bad', response: number}>|null|undefined} upTargets
 * @param {number} pressedButton  0-based button index.
 * @returns {{outcome: string, target: object|null}}
 *          `target` is the mole the press landed on, or null.
 */
export function classifyPress(upTargets, pressedButton) {
  if (!Number.isInteger(pressedButton)) {
    throw new Error(`classify: pressedButton must be an integer, got ${pressedButton}`);
  }
  const up = upTargets || [];
  if (!up.length) return { outcome: OUTCOME.NO_TARGET_PRESS, target: null };
  up.forEach(assertTarget);
  const target = up.find((t) => t.response === pressedButton);
  // DECIDED(Q11): a press on a column with no mole, while a mole is up, is
  // wrong_hole, never a commission.
  if (!target) return { outcome: OUTCOME.WRONG_HOLE, target: null };
  return { outcome: target.valence === 'good' ? OUTCOME.HIT : OUTCOME.COMMISSION, target };
}

/** A mole that went down with no press on its column. */
export function classifyTimeout(target) {
  assertTarget(target);
  return target.valence === 'good' ? OUTCOME.OMISSION : OUTCOME.CORRECT_REJECTION;
}

/** A mole still up when the run ends. */
export function classifyRunEnd(target) {
  return target ? OUTCOME.TRUNCATED : null;
}

/** True when the outcome carries a reaction time. */
export function hasResponseTime(outcome) {
  return WITH_RT.has(outcome);
}

/**
 * One outcome for the whole trial, from its moles' outcomes.
 *   good trial: the good mole's outcome (hit or omission);
 *   bad trial:  the bad mole's outcome (commission or correct_rejection);
 *   both trial: commission if the bad mole was pressed, whatever happened to
 *               the good one; otherwise hit or omission for the good mole.
 *   Any mole truncated: truncated.
 * TODO: confirm that pressing the bad mole in a "both" trial should count as
 * a commission even when the good mole was also hit.
 */
export function classifyTrial(trial) {
  const outs = trial.targets.map((t) => t.outcome);
  if (outs.some((o) => !o)) throw new Error(`classify: trial ${trial.trial} still has a mole up`);
  if (outs.includes(OUTCOME.TRUNCATED)) return OUTCOME.TRUNCATED;
  const good = trial.targets.find((t) => t.valence === 'good');
  const bad = trial.targets.find((t) => t.valence === 'bad');
  if (bad && bad.outcome === OUTCOME.COMMISSION) return OUTCOME.COMMISSION;
  if (good) return good.outcome;
  return bad.outcome;
}

/**
 * Whether the trial was answered correctly: 1, 0, or null when truncated.
 * Correct means every good mole hit and every bad mole left alone.
 */
export function trialCorrect(trial) {
  const outcome = classifyTrial(trial);
  if (outcome === OUTCOME.TRUNCATED) return null;
  return trial.targets.every((t) =>
    (t.valence === 'good' ? t.outcome === OUTCOME.HIT : t.outcome === OUTCOME.CORRECT_REJECTION)) ? 1 : 0;
}
