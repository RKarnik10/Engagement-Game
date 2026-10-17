/**
 * Run configuration: defaults, validation, presets (README 6.1).
 *
 * Values answered by Dr. Song on September 21, 2026, and clarified by
 * Rehaan Karnik on September 25, 2026, are marked DECIDED and recorded in
 * docs/decisions.md. Values still open are marked TODO.
 *
 * Pure: no DOM, no clock.
 */

export const VERSION = '0.3';

/**
 * Hole layouts.
 *
 * `holeResponse` maps a 0-based hole index (reading order: left to right,
 * top to bottom) to the 0-based button the participant should press for it.
 * In `grid3x3` a button is a COLUMN, so three buttons cover nine holes and
 * the row a mole appears in does not change the correct response.
 * `keys` has one entry per button, not per hole.
 */
export const LAYOUTS = Object.freeze({
  grid3x3: Object.freeze({
    holes: 9,
    rows: 3,
    columns: 3,
    keys: Object.freeze(['1', '2', '3']),
    holeResponse: Object.freeze([0, 1, 2, 0, 1, 2, 0, 1, 2]),
    label: '9 holes in a 3x3 grid, 3 buttons, one per column (one hand)',
  }),
  row4: Object.freeze({
    holes: 4,
    rows: 1,
    columns: 4,
    keys: Object.freeze(['1', '2', '3', '4']),
    holeResponse: Object.freeze([0, 1, 2, 3]),
    label: '4 holes in a row, keys 1 to 4 (superseded September 21, 2026)',
  }),
  grid9: Object.freeze({
    holes: 9,
    rows: 3,
    columns: 3,
    keys: Object.freeze(['7', '8', '9', '4', '5', '6', '1', '2', '3']),
    holeResponse: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    label: '9 holes, number pad, one key per hole (desktop piloting only)',
  }),
});

export const SKINS = Object.freeze(['mole', 'neutral']); // neutral: not built
/** Pictures the "bad" mole can use. The good mole is always the happy mole. */
export const BAD_STIMS = Object.freeze(['mole_sad', 'molerat']);
export const ONSETS = Object.freeze(['instant', 'gradual']);
/** Where the run is happening. Logged with the data as 1 (scanner) or 0 (behavioral). */
export const SETTINGS = Object.freeze(['scanner', 'behavioral']);
/**
 * What the participant display looks like behind the holes.
 *   garden: sky, a horizon with hills, and grass; brown holes (October 17, 2026).
 *   grey:   plain mid-grey, as README 4.3 recommends for scanning.
 */
export const SCENES = Object.freeze(['garden', 'grey']);

export const DEFAULTS = Object.freeze({
  version: VERSION,
  skin: 'mole',                 // DECIDED(Q8): moles. No-go is a sad mole or a molerat, not an eggplant.
  layout: 'grid3x3',            // DECIDED(Q2): one hand, 3 buttons, 3x3 grid, a button per column.
  keys: LAYOUTS.grid3x3.keys,   // TODO(Q2): confirm the codes the scanner button box actually sends (README 4.2).
  triggerKey: 't',              // TODO(Q4): 't' simulates the scanner trigger in development.
  setting: 'behavioral',        // DECIDED: logged as scanner = 1, behavioral = 0.
  onset: 'instant',             // DECIDED (N, October 17, 2026): moles pop up instantly.
  scene: 'garden',              // DECIDED (M, October 17, 2026): garden, scanning included. Grey kept as an option.
  rampMs: 350,                  // Rise/sink time, only used when onset is "gradual".

  // Timing. DECIDED: a fixed 1 s trial cycle, 600 trials, so a run is 10 minutes.
  nTrials: 600,
  trialMs: 1000,                // Onset-to-onset. Fixed, not jittered.
  holdMs: 800,                  // DECIDED (D, October 17, 2026): a mole stays up 800 ms of each 1 s trial.
  firstOnsetMs: 2000,           // TODO(Q4): depends on dummy scans.

  // Trial mix. DECIDED (Dr. Song, confirmed September 25, 2026): 80 / 10 / 10.
  goodShare: 0.8,               // One good mole: press its column (it gets "killed").
  badShare: 0.1,                // One bad mole: do nothing (it is not killed).
  bothShare: 0.1,               // A good and a bad mole at once, in different columns:
                                // press the good one's column only.
  badStim: 'mole_sad',          // DECIDED (A, October 17, 2026): the distractor is the sad mole.

  trS: 1.0,                     // TODO(Q4): TR, used for simulated volume events.
  // Feedback. Dr. Song's Q6 answer was no feedback at all. Rehaan Karnik
  // decided on October 17, 2026 (open decision L) to show the score by
  // default; rings, sound, and hammer stay off. Every run records which were
  // on (`feedbackVariant`).
  showScore: true,              // Score at the top centre, as a percentage (see engine.js):
                                // happy moles hit minus scorePenalty per distractor hit,
                                // over the happy moles so far.
  scorePenalty: 3,              // Points lost for hitting a distractor (10 on Oct 13, 5 then 3 on Oct 17, 2026).
  hitRings: false,              // White ring on a hit, red ring on a distractor pressed.
  sound: false,                 // A good sound on a hit, a bad sound on any wrong press.
  hammer: false,                // A hammer swings onto any mole that is pressed.
  // README section 8 kept the "violence dial" low (no hammer, no impact, no
  // sound); sound and hammer turn it up, so they are for piloting only.
  showResultsOnDisplay: false,  // Testing only: after a run, show results and downloads on the
                                // participant display too. Off for real participants (Q6).
  seed: 1234,
  // Who and which run (Phase 2, October 17, 2026). They label the files
  // (sub-<participant>_task-whacamole_run-<run>_...) and the data.
  participant: '',              // Letters and digits only, as BIDS requires; '' for unlabelled testing.
  run: 1,
  // Off: everyone gets the schedule from `seed`, so every run is identical.
  // On: the schedule seed is worked out from seed, participant, and run, so
  // each participant and run gets its own schedule, still reproducible.
  // TODO: which one the study uses is an open decision (O).
  seedFromIds: false,
  // Save the three files to the downloads folder when a run ends.
  autoSave: true,
  // DECIDED(Q5): continuous play, no rest blocks.
  // DECIDED(Q7): no adaptive difficulty; nothing in the engine adapts to performance.
  // DECIDED(Q11): a press on the wrong column is logged as wrong_hole; the trial continues.
});

/**
 * Presets. "scanner" only flips the setting flag for now.
 * TODO(Q4): fill in TR, run count, and dummy scans once decided.
 */
export const PRESETS = Object.freeze({
  'behavioral': Object.freeze({ setting: 'behavioral' }),
  'scanner': Object.freeze({ setting: 'scanner' }),
});

const isInt = (v) => Number.isInteger(v);
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

/** Buttons a layout has (one per column in grid3x3). */
export function buttonCount(layout) {
  const l = LAYOUTS[layout];
  return l ? Math.max(...l.holeResponse) + 1 : NaN;
}

/** Holes a layout has. */
export function holeCount(config) {
  const l = LAYOUTS[config.layout];
  return l ? l.holes : NaN;
}

/** 0-based button that a 0-based hole expects. */
export function responseForHole(config, hole) {
  return LAYOUTS[config.layout].holeResponse[hole];
}

/** 1-based row and column of a 0-based hole, in reading order. */
export function holePosition(config, hole) {
  const { columns } = LAYOUTS[config.layout];
  return { row: Math.floor(hole / columns) + 1, col: (hole % columns) + 1 };
}

/** The feedback switches, in the order they appear in a variant name. */
export const FEEDBACK_KEYS = Object.freeze(['showScore', 'hitRings', 'sound', 'hammer']);
const FEEDBACK_NAMES = Object.freeze({ showScore: 'score', hitRings: 'rings', sound: 'sound', hammer: 'hammer' });

/**
 * Short name for the feedback a run had, e.g. "none", "score", "sound+hammer".
 * Goes in the file names and the log so runs from different variants never mix.
 */
export function feedbackVariant(config) {
  const on = FEEDBACK_KEYS.filter((k) => config[k]).map((k) => FEEDBACK_NAMES[k]);
  return on.length ? on.join('+') : 'none';
}

/**
 * The seed the schedule is actually built from. Normally `seed` itself. With
 * seedFromIds on, a fixed hash (FNV-1a, 32-bit) of seed, participant, and run,
 * so the same participant and run always get the same schedule, and different
 * ones (almost always) get different schedules. Pure.
 */
export function scheduleSeed(config) {
  if (!config.seedFromIds) return config.seed;
  const text = `${config.seed}|${config.participant}|${config.run}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h | 0;   // a signed 32-bit integer, like any other seed
}

/** Total run length in ms: lead-in plus every trial cycle. */
export function runDurationMs(config) {
  return config.firstOnsetMs + config.nTrials * config.trialMs;
}

/** How long a target is up from onset to fully down, in ms. */
export function trialWindowMs(config) {
  return config.holdMs + (config.onset === 'gradual' ? 2 * config.rampMs : 0);
}

/**
 * Check a fully resolved config. Throws one Error listing every problem.
 */
export function validateConfig(config) {
  const problems = [];
  const c = config || {};
  const layout = LAYOUTS[c.layout];

  if (!layout) problems.push(`layout must be one of ${Object.keys(LAYOUTS).join(', ')}`);
  if (!SKINS.includes(c.skin)) problems.push(`skin must be one of ${SKINS.join(', ')}`);
  if (!ONSETS.includes(c.onset)) problems.push(`onset must be one of ${ONSETS.join(', ')}`);
  if (!SETTINGS.includes(c.setting)) problems.push(`setting must be one of ${SETTINGS.join(', ')}`);
  if (!SCENES.includes(c.scene)) problems.push(`scene must be one of ${SCENES.join(', ')}`);

  if (!Array.isArray(c.keys) || !c.keys.every((k) => typeof k === 'string' && k.length > 0)) {
    problems.push('keys must be an array of non-empty strings');
  } else if (layout) {
    const buttons = buttonCount(c.layout);
    if (c.keys.length !== buttons) problems.push(`keys must have ${buttons} entries (one per button) for layout "${c.layout}", got ${c.keys.length}`);
    if (new Set(c.keys).size !== c.keys.length) problems.push('keys must be unique');
    if (typeof c.triggerKey === 'string' && c.keys.includes(c.triggerKey)) {
      // README 4.2: some trigger boxes send "5", which collides with a number-pad layout.
      problems.push(`triggerKey "${c.triggerKey}" collides with a button key`);
    }
    if (layout.holes < 2) problems.push('at least 2 holes are required (same hole never repeats)');
    if (layout.holeResponse.length !== layout.holes) problems.push(`layout "${c.layout}" has a holeResponse of the wrong length`);
  }
  if (typeof c.triggerKey !== 'string' || c.triggerKey.length === 0) problems.push('triggerKey must be a non-empty string');

  const shares = ['goodShare', 'badShare', 'bothShare'];
  const sharesOk = shares.every((k) => typeof c[k] === 'number' && c[k] >= 0 && c[k] <= 1);
  if (!sharesOk) problems.push('goodShare, badShare, and bothShare must each be in [0, 1]');
  else if (Math.abs(c.goodShare + c.badShare + c.bothShare - 1) > 1e-9) {
    problems.push(`goodShare + badShare + bothShare must add up to 1, got ${+(c.goodShare + c.badShare + c.bothShare).toFixed(6)}`);
  }
  if (!BAD_STIMS.includes(c.badStim)) problems.push(`badStim must be one of ${BAD_STIMS.join(', ')}`);
  if (layout && c.bothShare > 0 && buttonCount(c.layout) < 2) problems.push('"both" trials need at least 2 buttons');
  if (!(isInt(c.nTrials) && c.nTrials > 0)) problems.push('nTrials must be a positive integer');
  if (!(isInt(c.trialMs) && c.trialMs > 0)) problems.push('trialMs must be a positive integer (ms)');
  if (!(isInt(c.holdMs) && c.holdMs > 0)) problems.push('holdMs must be a positive integer (ms)');
  if (!isNonNegInt(c.rampMs)) problems.push('rampMs must be a non-negative integer (ms)');
  if (!isNonNegInt(c.firstOnsetMs)) problems.push('firstOnsetMs must be a non-negative integer (ms)');
  if (isInt(c.trialMs) && isInt(c.holdMs) && isNonNegInt(c.rampMs)) {
    const win = trialWindowMs(c);
    if (win > c.trialMs) {
      problems.push(`a target is up for ${win} ms but trials start every ${c.trialMs} ms; targets would overlap`);
    }
  }
  if (!(typeof c.trS === 'number' && Number.isFinite(c.trS) && c.trS > 0)) problems.push('trS must be a positive number (s)');
  for (const k of FEEDBACK_KEYS) if (typeof c[k] !== 'boolean') problems.push(`${k} must be a boolean`);
  if (!isNonNegInt(c.scorePenalty)) problems.push('scorePenalty must be a non-negative integer');
  if (typeof c.showResultsOnDisplay !== 'boolean') problems.push('showResultsOnDisplay must be a boolean');
  if (!isInt(c.seed)) problems.push('seed must be an integer');
  if (typeof c.participant !== 'string' || !/^[A-Za-z0-9]{0,32}$/.test(c.participant)) {
    problems.push('participant must be up to 32 letters or digits (no spaces, dashes, or underscores)');
  }
  if (!(isInt(c.run) && c.run >= 1 && c.run <= 99)) problems.push('run must be a whole number from 1 to 99');
  if (typeof c.seedFromIds !== 'boolean') problems.push('seedFromIds must be a boolean');
  if (typeof c.autoSave !== 'boolean') problems.push('autoSave must be a boolean');

  if (problems.length) throw new Error(`Invalid config:\n  - ${problems.join('\n  - ')}`);
  return config;
}

/**
 * Merge a partial config over the defaults (optionally via a preset), fill
 * `keys` from the layout when not given, validate, and return a frozen copy.
 */
export function resolveConfig(partial = {}, preset) {
  if (preset !== undefined && !PRESETS[preset]) {
    throw new Error(`Unknown preset "${preset}"; choose one of ${Object.keys(PRESETS).join(', ')}`);
  }
  const merged = { ...DEFAULTS, ...(preset ? PRESETS[preset] : {}), ...partial };
  if (partial.keys === undefined && (!preset || PRESETS[preset].keys === undefined) && LAYOUTS[merged.layout]) {
    merged.keys = LAYOUTS[merged.layout].keys;
  }
  merged.keys = Array.isArray(merged.keys) ? merged.keys.slice() : merged.keys;
  merged.version = VERSION;
  validateConfig(merged);
  // Derived, so the engine and the chart know how long the run is.
  merged.durationS = runDurationMs(merged) / 1000;
  merged.feedbackVariant = feedbackVariant(merged);
  merged.scheduleSeed = scheduleSeed(merged);
  return Object.freeze(merged);
}
