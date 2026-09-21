/**
 * Run configuration: defaults, validation, presets (README 6.1).
 *
 * Values answered by Dr. Song on September 21, 2026 are marked DECIDED(Qn)
 * and recorded in docs/decisions.md. Values still open are marked TODO(Qn).
 *
 * Pure: no DOM, no clock.
 */

export const VERSION = '0.2';

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
export const ONSETS = Object.freeze(['instant', 'gradual']);
/** Where the run is happening. Logged with the data as 1 (scanner) or 0 (behavioral). */
export const SETTINGS = Object.freeze(['scanner', 'behavioral']);

export const DEFAULTS = Object.freeze({
  version: VERSION,
  skin: 'mole',                 // DECIDED(Q8): moles. No-go is a sad mole or a molerat, not an eggplant.
  layout: 'grid3x3',            // DECIDED(Q2): one hand, 3 buttons, 3x3 grid, a button per column.
  keys: LAYOUTS.grid3x3.keys,   // TODO(Q2): confirm the codes the scanner button box actually sends (README 4.2).
  triggerKey: 't',              // TODO(Q4): 't' simulates the scanner trigger in development.
  setting: 'behavioral',        // DECIDED: logged as scanner = 1, behavioral = 0.
  onset: 'instant',             // TODO: pop-up vs. gradual rise (README 3.5) still open.
  rampMs: 350,                  // Rise/sink time, only used when onset is "gradual".

  // Timing. DECIDED: a fixed 1 s trial cycle, 600 trials, so a run is 10 minutes.
  nTrials: 600,
  trialMs: 1000,                // Onset-to-onset. Fixed, not jittered.
  holdMs: 800,                  // TODO: how long the mole stays up inside the 1 s cycle.
  firstOnsetMs: 2000,           // TODO(Q4): depends on dummy scans.

  // Stimulus mix. DECIDED: 80 / 10 / 10.
  goProb: 0.8,                  // Happy mole: press the column's button.
  nogoSadShare: 0.5,            // Half the no-go trials are a sad mole, half a molerat.

  trS: 1.0,                     // TODO(Q4): TR, used for simulated volume events.
  showScore: false,             // DECIDED(Q6): no score.
  feedback: false,              // DECIDED(Q6): no hole lights up on a press. Moles only pop in and out.
  seed: 1234,
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

  if (!(typeof c.goProb === 'number' && c.goProb > 0 && c.goProb <= 1)) problems.push('goProb must be in (0, 1]');
  if (!(typeof c.nogoSadShare === 'number' && c.nogoSadShare >= 0 && c.nogoSadShare <= 1)) problems.push('nogoSadShare must be in [0, 1]');
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
  if (typeof c.showScore !== 'boolean') problems.push('showScore must be a boolean');
  if (typeof c.feedback !== 'boolean') problems.push('feedback must be a boolean');
  if (!isInt(c.seed)) problems.push('seed must be an integer');

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
  return Object.freeze(merged);
}
