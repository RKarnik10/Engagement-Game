/**
 * Trial schedule generator (README 3.4).
 *
 * PURE: (config) -> trial list. No DOM, no clock. The same config and seed
 * always give the identical schedule. The schedule never depends on the
 * participant's responses (README 3.1).
 *
 * Decided with Dr. Song (September 21 and 25, 2026):
 *   - a fixed 1 s trial cycle: onsets are firstOnsetMs + n * trialMs;
 *   - three trial types at 80 / 10 / 10:
 *       good - one good (happy) mole: press its column;
 *       bad  - one bad mole: do nothing;
 *       both - a good and a bad mole at the same time, in different
 *              columns: press the good one's column only.
 *
 * Rules kept from v0.1 (placeholders until the PI says otherwise):
 *   - the first LEAD_IN_GO_TRIALS trials are "good";
 *   - no two "bad" trials in a row;
 *   - no hole is reused from one trial to the next;
 *   - each trial type's count is exact per run.
 *
 * Trial record (0-based hole and response; exports convert to 1-based):
 *   { trial, type, targets: [{ valence, stim, hole, row, col, response }],
 *     scheduledOnsetMs, windowMs, precedingGo }
 * `targets` lists the good mole first.
 */

import { mulberry32 } from './rng.js';
import { LAYOUTS, trialWindowMs, responseForHole, holePosition } from './config.js';

/** Number of leading trials forced to "good" (placeholder). */
export const LEAD_IN_GO_TRIALS = 3;

export const TRIAL = Object.freeze({ GOOD: 'good', BAD: 'bad', BOTH: 'both' });
export const VALENCE = Object.freeze({ GOOD: 'good', BAD: 'bad' });
/** The good mole is always the happy mole; the bad picture comes from config.badStim. */
export const GOOD_STIM = 'mole_happy';

/**
 * Exact trial counts for n trials. Bad trials are capped by the
 * "no two bad trials in a row" rule over the trials after the lead-in;
 * good trials take whatever is left.
 */
export function trialCounts(n, config, leadIn = LEAD_IN_GO_TRIALS) {
  const slots = Math.max(0, n - leadIn);
  const bad = Math.min(Math.round(n * config.badShare), Math.floor((slots + 1) / 2));
  const both = Math.min(Math.round(n * config.bothShare), slots - bad);
  return { good: n - bad - both, bad, both };
}

/** Fisher-Yates, driven by the seeded stream so runs stay reproducible. */
function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function pick(list, rand) {
  if (!list.length) throw new Error('schedule: no hole satisfies the constraints');
  return list[Math.floor(rand() * list.length)];
}

function target(config, valence, stim, hole) {
  const { row, col } = holePosition(config, hole);
  return { valence, stim, hole, row, col, response: responseForHole(config, hole) };
}

/**
 * Build the schedule for one run.
 * @param {object} config  A resolved config (see config.js).
 * @returns {Array<object>}
 */
export function buildSchedule(config) {
  const rand = mulberry32(config.seed);
  const layout = LAYOUTS[config.layout];
  const n = config.nTrials;
  const leadIn = LEAD_IN_GO_TRIALS;
  const counts = trialCounts(n, config, leadIn);

  // 1. Trial types with exact counts.
  //    Bad trials: pick counts.bad values from 0..(slots - bad), sort, then
  //    shift the j-th pick by +j so no two bad trials are adjacent.
  const slots = Math.max(0, n - leadIn);
  const types = new Array(n).fill(TRIAL.GOOD);
  const pool = shuffle(Array.from({ length: Math.max(0, slots - counts.bad + 1) }, (_, i) => i), rand);
  pool.slice(0, counts.bad).sort((p, q) => p - q).forEach((v, j) => { types[leadIn + v + j] = TRIAL.BAD; });
  //    Both trials: a random subset of the remaining slots after the lead-in.
  const open = [];
  for (let i = leadIn; i < n; i++) if (types[i] !== TRIAL.BAD) open.push(i);
  shuffle(open, rand).slice(0, counts.both).forEach((i) => { types[i] = TRIAL.BOTH; });

  // 2. Holes. Never reuse a hole from the previous trial. In a "both" trial
  //    the two moles sit in different columns (different buttons).
  const allHoles = Array.from({ length: layout.holes }, (_, i) => i);
  const windowMs = trialWindowMs(config);
  const trials = [];
  let prevHoles = [];
  for (let i = 0; i < n; i++) {
    const free = allHoles.filter((h) => !prevHoles.includes(h));
    const type = types[i];
    const targets = [];
    if (type === TRIAL.BAD) {
      targets.push(target(config, VALENCE.BAD, config.badStim, pick(free, rand)));
    } else {
      const good = pick(free, rand);
      targets.push(target(config, VALENCE.GOOD, GOOD_STIM, good));
      if (type === TRIAL.BOTH) {
        const other = free.filter((h) => responseForHole(config, h) !== responseForHole(config, good));
        targets.push(target(config, VALENCE.BAD, config.badStim, pick(other, rand)));
      }
    }
    trials.push({
      trial: i + 1,
      type,
      targets,
      scheduledOnsetMs: config.firstOnsetMs + i * config.trialMs,
      windowMs,
    });
    prevHoles = targets.map((t) => t.hole);
  }

  // 3. preceding_go (README 3.2): trials in a row that required a press
  //    (good or both) since the last bad trial. Reported on every trial that
  //    shows a bad mole (bad and both).
  let streak = 0;
  for (const tr of trials) {
    tr.precedingGo = tr.type === TRIAL.GOOD ? null : streak;
    streak = tr.type === TRIAL.BAD ? 0 : streak + 1;
  }

  return trials;
}
