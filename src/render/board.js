/**
 * Board: hole layout and drawing helpers shared by all skins (README 3.6).
 *
 * Only draws. Never decides outcomes. The engine reports what is up and the
 * board shows it. Skins supply the target art; everything else (mound, pit,
 * clip, key caps, feedback ring) lives here so it is identical across skins.
 */

import { LAYOUTS } from '../config.js';

/** Fixed mid-grey stimulus background (README 4.3). Must not change with theme. */
export const STIMULUS_BACKGROUND = '#808080';

/** Hole colors, identical in every skin and theme. */
const HOLE = Object.freeze({ mound: '#6E6258', pit: '#2A231D', lip: '#574B40' });

/** Vertical travel of the target group inside its clip, in SVG units. */
const TRAVEL = 84;

/**
 * SVG for one hole. The target group holds both go and no-go art; the hole's
 * data-type attribute picks which one is visible (styles.css).
 * @param {number} i     0-based hole index (for a unique clip-path id).
 * @param {object} skin  { goArt, nogoArt }.
 */
export function holeSVG(i, skin) {
  return (
    `<svg viewBox="0 0 120 120" aria-hidden="true">` +
      `<defs><clipPath id="clip-${i}"><rect x="-10" y="-10" width="140" height="102"/></clipPath></defs>` +
      `<ellipse fill="${HOLE.mound}" cx="60" cy="95" rx="57" ry="19"/>` +
      `<ellipse fill="${HOLE.pit}" cx="60" cy="92" rx="45" ry="12"/>` +
      `<g clip-path="url(#clip-${i})"><g class="target" transform="translate(0 ${TRAVEL})">` +
        `<g class="shape-go">${skin.goArt}</g>` +
        `<g class="shape-nogo">${skin.nogoArt}</g>` +
      `</g></g>` +
      `<path fill="none" stroke="${HOLE.lip}" stroke-width="5" stroke-linecap="round" d="M15 92 A45 12 0 0 0 105 92"/>` +
      `<ellipse class="fx" cx="60" cy="92" rx="52" ry="16"/>` +
    `</svg>`
  );
}

/**
 * Build the holes for a config and skin.
 * @param {Element} holesEl
 * @param {object} config   Resolved config (layout, keys).
 * @param {object} skin
 */
export function renderBoard(holesEl, config, skin) {
  holesEl.className = `holes ${config.layout} skin-${skin.name}`;
  holesEl.innerHTML = config.keys.map((key, i) =>
    `<div class="hole" data-i="${i}" data-type="">` +
      `<div class="art">${holeSVG(i, skin)}</div>` +
      `<span class="keycap">${key}</span>` +
    `</div>`,
  ).join('');
}

/**
 * Show a target at visible fraction p (0 = fully down, 1 = fully up).
 */
export function setTarget(holesEl, i, p) {
  const h = holesEl.children[i];
  if (!h) return;
  h.querySelector('.target').setAttribute('transform', `translate(0 ${(TRAVEL * (1 - p)).toFixed(1)})`);
}

/** Select which art is shown in a hole: 'go', 'nogo', or '' for none. */
export function setTargetType(holesEl, i, type) {
  const h = holesEl.children[i];
  if (h) h.dataset.type = type || '';
}

/**
 * Brief feedback ring around a hole. TODO(Q6): feedback is a reward signal;
 * keep or remove with the score decision.
 * @param {'hit'|'commission'|'wrong'} kind
 */
export function flash(holesEl, i, kind) {
  const h = holesEl.children[i];
  if (!h) return;
  const cls = { hit: 'fx-hit', commission: 'fx-com', wrong: 'fx-wrong' }[kind];
  if (!cls) return;
  h.classList.remove('fx-hit', 'fx-com', 'fx-wrong');
  void h.offsetWidth; // restart the transition
  h.classList.add(cls);
  clearTimeout(h._fx);
  h._fx = setTimeout(() => h.classList.remove(cls), 200);
}

/**
 * Visible fraction of a target at `elapsedMs` into its window (README 3.5).
 * Instant onset: always 1. Gradual: linear rise over rampMs, hold, then sink.
 * Pure.
 */
export function rampVisibility(elapsedMs, windowMs, config) {
  if (config.onset !== 'gradual') return 1;
  const r = config.rampMs;
  if (r <= 0) return 1;
  if (elapsedMs < r) return Math.max(0, elapsedMs / r);
  if (elapsedMs > windowMs - r) return Math.max(0, (windowMs - elapsedMs) / r);
  return 1;
}

/** Human description of the key mapping for instructions. */
export function keysDescription(config) {
  const layout = LAYOUTS[config.layout];
  const defaults = layout && layout.keys.join() === config.keys.join();
  if (config.layout === 'row4' && defaults) return 'keys 1 to 4';
  if (config.layout === 'grid9' && defaults) return 'the number pad, where 7 8 9 is the top row';
  return `keys ${config.keys.join(' ')} for the holes in reading order`;
}
