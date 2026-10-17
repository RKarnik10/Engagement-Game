/**
 * Settings in a web address, so a run can be shared as one link
 * (e.g. display.html?trials=60&score=1). PURE: no DOM, no clock.
 *
 * Only settings that differ from the defaults are written, so links stay
 * short. Unknown parameters are ignored; bad values are reported by
 * resolveConfig as usual.
 */

import { DEFAULTS, resolveConfig } from './config.js';

const BOOL = Object.freeze({
  score: 'showScore', rings: 'hitRings', sound: 'sound', hammer: 'hammer', results: 'showResultsOnDisplay',
});
const INT = Object.freeze({
  trials: 'nTrials', trialms: 'trialMs', holdms: 'holdMs', seed: 'seed', penalty: 'scorePenalty',
});
const TEXT = Object.freeze({ setting: 'setting', layout: 'layout', onset: 'onset', scene: 'scene' });
const DISTRACTOR = Object.freeze({ sad: 'mole_sad', molerat: 'molerat' });

const pct = (x) => Math.round(x * 100);

/**
 * Read settings from a query string ("?trials=60&mix=80-10-10&score=1").
 * @returns {object} a partial config (possibly empty)
 */
export function configFromQuery(search) {
  const q = new URLSearchParams(search || '');
  const out = {};
  for (const [k, field] of Object.entries(BOOL)) if (q.has(k)) out[field] = q.get(k) !== '0';
  for (const [k, field] of Object.entries(INT)) if (q.has(k)) out[field] = Number(q.get(k));
  for (const [k, field] of Object.entries(TEXT)) if (q.has(k)) out[field] = q.get(k);
  if (q.has('mix')) {
    const parts = q.get('mix').split('-').map(Number);
    if (parts.length === 3) [out.goodShare, out.badShare, out.bothShare] = parts.map((n) => n / 100);
    else out.goodShare = NaN;                        // let validation report it
  }
  if (q.has('distractor')) out.badStim = DISTRACTOR[q.get('distractor')] || q.get('distractor');
  return out;
}

/** True when the query string carries any setting this page understands. */
export function hasQuerySettings(search) {
  return Object.keys(configFromQuery(search)).length > 0;
}

/**
 * Write a config as a query string, defaults left out.
 * @param {object} config  A resolved config.
 * @param {object} [force] Extra settings to always include, e.g. { showResultsOnDisplay: true }.
 */
export function configToQuery(config, force = {}) {
  const c = { ...config, ...force };
  const q = new URLSearchParams();
  for (const [k, field] of Object.entries(INT)) if (c[field] !== DEFAULTS[field]) q.set(k, String(c[field]));
  if ([c.goodShare, c.badShare, c.bothShare].some((v, i) => v !== [DEFAULTS.goodShare, DEFAULTS.badShare, DEFAULTS.bothShare][i])) {
    q.set('mix', [c.goodShare, c.badShare, c.bothShare].map(pct).join('-'));
  }
  if (c.badStim !== DEFAULTS.badStim) q.set('distractor', c.badStim === 'mole_sad' ? 'sad' : c.badStim);
  for (const [k, field] of Object.entries(TEXT)) if (c[field] !== DEFAULTS[field]) q.set(k, c[field]);
  for (const [k, field] of Object.entries(BOOL)) if (c[field]) q.set(k, '1');
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Round trip check used by the console: the link must give back the same settings. */
export function linkMatches(config, search) {
  const back = resolveConfig(configFromQuery(search));
  return Object.keys(DEFAULTS).every((k) => JSON.stringify(back[k]) === JSON.stringify(config[k]));
}
