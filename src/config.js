/**
 * Run configuration: defaults, validation, presets (README 6.1).
 *
 * Every value below is a placeholder from README section 2 ("Assumed for now")
 * or section 3.4. Nothing here is a decision. Each assumption tied to an open
 * question carries a TODO(Qn) marker; answers go in docs/decisions.md.
 *
 * Pure: no DOM, no clock.
 */

export const VERSION = '0.1';

/**
 * Hole layouts. `keys` is the default key-to-hole mapping in reading order
 * (left to right, top to bottom); config.keys can override it (README 4.2).
 */
export const LAYOUTS = Object.freeze({
  row4: Object.freeze({
    holes: 4,
    columns: 4,
    keys: Object.freeze(['1', '2', '3', '4']),
    label: '4 holes in a row, keys 1 to 4 (button-box style)',
  }),
  grid9: Object.freeze({
    holes: 9,
    columns: 3,
    keys: Object.freeze(['7', '8', '9', '4', '5', '6', '1', '2', '3']),
    label: '9 holes, number pad (desktop piloting only)',
  }),
});

export const SKINS = Object.freeze(['mole', 'neutral']); // neutral: Phase 2
export const ONSETS = Object.freeze(['instant', 'gradual']);

export const DEFAULTS = Object.freeze({
  version: VERSION,
  skin: 'mole',                 // TODO(Q8): mole vs. neutral art. Neutral skin is Phase 2.
  layout: 'row4',               // TODO(Q2): one hand, 4 buttons assumed.
  keys: LAYOUTS.row4.keys,      // TODO(Q2): confirm the key codes the scanner button box sends (README 4.2).
  triggerKey: 't',              // TODO(Q4): 't' simulates the scanner trigger in development.
  onset: 'instant',             // Pop-up vs. gradual rise is an open design question (README 3.5).
  rampMs: 350,                  // Rise/sink time, only used when onset is "gradual".
  goProb: 0.8,                  // Placeholder (README 3.4). Exact per run.
  holdMs: 900,                  // Placeholder: how long a target stays up if not hit.
  isiMinMs: 500,                // Placeholder: jittered gap, uniform [isiMinMs, isiMaxMs).
  isiMaxMs: 1200,
  firstOnsetMs: 2000,           // TODO(Q4): depends on dummy scans.
  durationS: 60,                // TODO(Q4): real runs are likely several minutes.
  trS: 1.0,                     // TODO(Q4): TR, used for simulated volume events.
  showScore: true,              // TODO(Q6): score is a reward signal; on for piloting.
  seed: 1234,
  // TODO(Q5): continuous play with jittered gaps is assumed; blocks would change schedule.js.
  // TODO(Q7): adaptive difficulty is off; nothing in the engine adapts to performance.
});

/**
 * Presets (README 6). Phase 2 fills these in; for now both equal DEFAULTS so
 * the names exist. TODO(Q2, Q4, Q6): the "scanner" preset needs the button box
 * keys, TR, run length, and the score decision.
 */
export const PRESETS = Object.freeze({
  'desktop-pilot': Object.freeze({}),
  'scanner': Object.freeze({}),
});

const isInt = (v) => Number.isInteger(v);
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

/**
 * Check a fully resolved config. Throws one Error listing every problem.
 * @param {object} config
 * @returns {object} the same config
 */
export function validateConfig(config) {
  const problems = [];
  const c = config || {};

  if (!LAYOUTS[c.layout]) problems.push(`layout must be one of ${Object.keys(LAYOUTS).join(', ')}`);
  if (!SKINS.includes(c.skin)) problems.push(`skin must be one of ${SKINS.join(', ')}`);
  if (!ONSETS.includes(c.onset)) problems.push(`onset must be one of ${ONSETS.join(', ')}`);

  if (!Array.isArray(c.keys) || !c.keys.every((k) => typeof k === 'string' && k.length > 0)) {
    problems.push('keys must be an array of non-empty strings');
  } else {
    const holes = LAYOUTS[c.layout] ? LAYOUTS[c.layout].holes : NaN;
    if (c.keys.length !== holes) problems.push(`keys must have ${holes} entries for layout "${c.layout}", got ${c.keys.length}`);
    if (c.keys.length < 2) problems.push('at least 2 holes are required (same hole never repeats)');
    if (new Set(c.keys).size !== c.keys.length) problems.push('keys must be unique');
    if (typeof c.triggerKey === 'string' && c.keys.includes(c.triggerKey)) {
      // README 4.2: some trigger boxes send "5", which collides with the 9-hole layout.
      problems.push(`triggerKey "${c.triggerKey}" collides with a hole key`);
    }
  }
  if (typeof c.triggerKey !== 'string' || c.triggerKey.length === 0) problems.push('triggerKey must be a non-empty string');

  if (!(typeof c.goProb === 'number' && c.goProb > 0 && c.goProb <= 1)) problems.push('goProb must be in (0, 1]');
  if (!(isInt(c.holdMs) && c.holdMs > 0)) problems.push('holdMs must be a positive integer (ms)');
  if (!isNonNegInt(c.rampMs)) problems.push('rampMs must be a non-negative integer (ms)');
  if (!isNonNegInt(c.isiMinMs)) problems.push('isiMinMs must be a non-negative integer (ms)');
  if (!isNonNegInt(c.isiMaxMs)) problems.push('isiMaxMs must be a non-negative integer (ms)');
  if (isNonNegInt(c.isiMinMs) && isNonNegInt(c.isiMaxMs) && c.isiMaxMs < c.isiMinMs) problems.push('isiMaxMs must be >= isiMinMs');
  if (!isNonNegInt(c.firstOnsetMs)) problems.push('firstOnsetMs must be a non-negative integer (ms)');
  if (!(typeof c.durationS === 'number' && Number.isFinite(c.durationS) && c.durationS > 0)) problems.push('durationS must be a positive number (s)');
  if (!(typeof c.trS === 'number' && Number.isFinite(c.trS) && c.trS > 0)) problems.push('trS must be a positive number (s)');
  if (typeof c.showScore !== 'boolean') problems.push('showScore must be a boolean');
  if (!isInt(c.seed)) problems.push('seed must be an integer');

  if (problems.length) throw new Error(`Invalid config:\n  - ${problems.join('\n  - ')}`);
  return config;
}

/**
 * Merge a partial config over the defaults (optionally via a preset), fill
 * `keys` from the layout when not given, validate, and return a frozen copy.
 *
 * @param {object} [partial]
 * @param {string} [preset]   A key of PRESETS.
 * @returns {Readonly<object>}
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
  return Object.freeze(merged);
}

/** Number of holes for a config (equals config.keys.length after validation). */
export function holeCount(config) {
  return config.keys.length;
}
