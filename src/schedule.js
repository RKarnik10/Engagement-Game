/**
 * Trial schedule generator (README 3.4).
 *
 * PURE: (config) -> trial list. No DOM, no clock. The same config and seed
 * always give the identical schedule. The schedule never depends on the
 * participant's responses (README 3.1).
 *
 * Decided September 21, 2026:
 *   - a fixed 1 s trial cycle, so onsets are firstOnsetMs + n * trialMs and
 *     600 trials make a 10-minute run. No jitter;
 *   - three pictures at 80 / 10 / 10: happy mole (press), sad mole (hold
 *     back), molerat (hold back). The go/no-go split is still 80 / 20.
 *
 * Rules kept from v0.1 (placeholders until the PI says otherwise):
 *   - the same hole is never used twice in a row;
 *   - the first LEAD_IN_GO_TRIALS trials are go;
 *   - no two no-go trials in a row;
 *   - the go share and each picture's share are exact per run.
 *
 * Trial record (0-based hole and response; exports convert to 1-based):
 *   { trial, type, stim, hole, row, col, response, scheduledOnsetMs,
 *     windowMs, precedingGo }
 */

import { mulberry32 } from './rng.js';
import { LAYOUTS, trialWindowMs, responseForHole, holePosition } from './config.js';

/** Number of leading trials forced to "go" (placeholder). */
export const LEAD_IN_GO_TRIALS = 3;

/** Picture names. The engine only cares about `type`; skins draw `stim`. */
export const STIM = Object.freeze({
  GO: 'mole_happy',
  NOGO_SAD: 'mole_sad',
  NOGO_RAT: 'molerat',
});

/**
 * Number of no-go trials for n trials at the configured go share, capped by
 * the "no two no-go in a row" rule over the trials after the lead-in.
 */
export function nogoCount(n, goProb, leadIn = LEAD_IN_GO_TRIALS) {
  const slots = Math.max(0, n - leadIn);
  return Math.min(Math.round(n * (1 - goProb)), Math.floor((slots + 1) / 2));
}

/** Fisher-Yates, driven by the seeded stream so runs stay reproducible. */
function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/**
 * Build the schedule for one run.
 * @param {object} config  A resolved config (see config.js).
 * @returns {Array<object>}
 */
export function buildSchedule(config) {
  const rand = mulberry32(config.seed);
  const layout = LAYOUTS[config.layout];
  const nHoles = layout.holes;
  if (!(nHoles >= 2)) throw new Error('schedule: at least 2 holes are required');
  const windowMs = trialWindowMs(config);
  const n = config.nTrials;

  // 1. Onsets are fixed; only the hole is random. Never the same hole twice.
  const trials = [];
  let prev = -1;
  for (let i = 0; i < n; i++) {
    let hole;
    do { hole = Math.floor(rand() * nHoles); } while (hole === prev);
    const { row, col } = holePosition(config, hole);
    trials.push({
      trial: i + 1,
      hole,
      row,
      col,
      response: responseForHole(config, hole),
      scheduledOnsetMs: config.firstOnsetMs + i * config.trialMs,
      windowMs,
    });
    prev = hole;
  }

  // 2. Go/no-go assignment with an exact count.
  //    Pick nNogo distinct values from 0..(slots - nNogo), sort them, then
  //    shift the j-th pick by +j so no two no-go positions are adjacent.
  const leadIn = LEAD_IN_GO_TRIALS;
  const slots = Math.max(0, n - leadIn);
  const nNogo = nogoCount(n, config.goProb, leadIn);
  const pool = Array.from({ length: Math.max(0, slots - nNogo + 1) }, (_, i) => i);
  shuffle(pool, rand);
  const picks = pool.slice(0, nNogo).sort((p, q) => p - q);
  const types = new Array(n).fill('go');
  const nogoIndex = [];
  picks.forEach((v, j) => { const at = leadIn + v + j; types[at] = 'nogo'; nogoIndex.push(at); });

  // 3. Split the no-go trials between the two pictures, exact counts.
  const nSad = Math.round(nNogo * config.nogoSadShare);
  const pictures = [
    ...new Array(nSad).fill(STIM.NOGO_SAD),
    ...new Array(nNogo - nSad).fill(STIM.NOGO_RAT),
  ];
  shuffle(pictures, rand);
  const stims = new Array(n).fill(STIM.GO);
  nogoIndex.forEach((at, j) => { stims[at] = pictures[j]; });

  // 4. preceding_go: number of go trials since the last no-go (README 3.2).
  let streak = 0;
  trials.forEach((tr, i) => {
    tr.type = types[i];
    tr.stim = stims[i];
    tr.precedingGo = tr.type === 'nogo' ? streak : null;
    streak = tr.type === 'go' ? streak + 1 : 0;
  });

  return trials;
}
