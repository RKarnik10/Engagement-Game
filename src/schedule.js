/**
 * Trial schedule generator (README 3.4).
 *
 * PURE: (config) -> trial list. No DOM, no clock. The same config and seed
 * always give the identical schedule, and the random stream is consumed in
 * the same order as the v0.1 prototype (index.html), so a seed produces the
 * same schedule in both builds.
 *
 * The schedule never depends on the participant's responses (README 3.1).
 *
 * Rules (all placeholders until confirmed with the PI):
 *   - targets appear one at a time; the window is holdMs (+ 2 * rampMs when
 *     onset is "gradual"), followed by a gap uniform in [isiMinMs, isiMaxMs);
 *   - the same hole is never used twice in a row;
 *   - the go share is exact per run (rounded);
 *   - the first LEAD_IN_GO_TRIALS trials are go;
 *   - no two no-go trials in a row.
 *
 * Trial record produced here (0-based hole; exports convert to 1-based):
 *   { trial, type, hole, scheduledOnsetMs, windowMs, precedingGo }
 */

import { mulberry32 } from './rng.js';

/** Number of leading trials forced to "go" (README 3.4, placeholder). */
export const LEAD_IN_GO_TRIALS = 3;

/** How long a target is up from onset to fully down, in ms. */
export function trialWindowMs(config) {
  return config.holdMs + (config.onset === 'gradual' ? 2 * config.rampMs : 0);
}

/**
 * Number of no-go trials for n trials at the configured go share, capped by
 * the "no two no-go in a row" rule over the trials after the lead-in.
 */
export function nogoCount(n, goProb, leadIn = LEAD_IN_GO_TRIALS) {
  const slots = Math.max(0, n - leadIn);
  return Math.min(Math.round(n * (1 - goProb)), Math.floor((slots + 1) / 2));
}

/**
 * Build the schedule for one run.
 * @param {object} config  A resolved config (see config.js).
 * @returns {Array<object>} trials, 1-based `trial`, 0-based `hole`.
 */
export function buildSchedule(config) {
  const rand = mulberry32(config.seed);
  const nHoles = config.keys.length;
  if (!(nHoles >= 2)) throw new Error('schedule: at least 2 holes are required');
  const windowMs = trialWindowMs(config);
  const endMs = config.durationS * 1000;

  // 1. Onset times and holes. Consumes the random stream exactly like the prototype.
  const trials = [];
  let t = config.firstOnsetMs;
  let prev = -1;
  while (t + windowMs <= endMs) {
    let hole;
    do { hole = Math.floor(rand() * nHoles); } while (hole === prev);
    trials.push({ trial: trials.length + 1, hole, scheduledOnsetMs: Math.round(t), windowMs });
    prev = hole;
    t += windowMs + config.isiMinMs + rand() * (config.isiMaxMs - config.isiMinMs);
  }

  // 2. Go/no-go assignment with an exact count.
  //    Pick nNogo distinct values from 0..(slots - nNogo), sort them, then
  //    shift the j-th pick by +j so no two no-go positions are adjacent.
  const n = trials.length;
  const leadIn = LEAD_IN_GO_TRIALS;
  const slots = Math.max(0, n - leadIn);
  const nNogo = nogoCount(n, config.goProb, leadIn);
  const pool = Array.from({ length: Math.max(0, slots - nNogo + 1) }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  const picks = pool.slice(0, nNogo).sort((p, q) => p - q);
  const types = new Array(n).fill('go');
  picks.forEach((v, j) => { types[leadIn + v + j] = 'nogo'; });

  // 3. preceding_go: number of go trials since the last no-go (README 3.2).
  let streak = 0;
  trials.forEach((tr, i) => {
    tr.type = types[i];
    tr.precedingGo = tr.type === 'nogo' ? streak : null;
    streak = tr.type === 'go' ? streak + 1 : 0;
  });

  return trials;
}
