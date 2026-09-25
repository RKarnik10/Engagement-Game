/**
 * Board: hole layout and drawing helpers shared by all skins (README 3.6).
 *
 * Only draws. Never decides outcomes.
 *
 * Decided September 21, 2026: the board gives the participant NO feedback.
 * A press changes nothing on screen; moles only pop in and out. There is no
 * flash, no highlight, and no score, so nothing here reacts to a press.
 */

import { LAYOUTS } from '../config.js';

/** Fixed mid-grey stimulus background (README 4.3). Must not change with theme. */
export const STIMULUS_BACKGROUND = '#808080';

/** Hole colors, identical in every skin and theme. */
const HOLE = Object.freeze({ mound: '#6E6258', pit: '#2A231D', lip: '#574B40' });

/** Vertical travel of the target group inside its clip, in SVG units. */
const TRAVEL = 84;

/**
 * SVG for one hole. The target group holds every stimulus picture; the hole's
 * data-stim attribute picks which one is visible (styles.css).
 * @param {number} i     0-based hole index (for a unique clip-path id).
 * @param {object} skin  { art: { [stimName]: svgFragment } }.
 */
export function holeSVG(i, skin) {
  const arts = Object.entries(skin.art)
    .map(([name, svg]) => `<g class="stim" data-stim="${name}">${svg}</g>`)
    .join('');
  return (
    `<svg viewBox="0 0 120 120" aria-hidden="true">` +
      `<defs><clipPath id="clip-${i}"><rect x="-10" y="-10" width="140" height="102"/></clipPath></defs>` +
      `<ellipse fill="${HOLE.mound}" cx="60" cy="95" rx="57" ry="19"/>` +
      `<ellipse fill="${HOLE.pit}" cx="60" cy="92" rx="45" ry="12"/>` +
      `<g clip-path="url(#clip-${i})"><g class="target" transform="translate(0 ${TRAVEL})">${arts}</g></g>` +
      `<path fill="none" stroke="${HOLE.lip}" stroke-width="5" stroke-linecap="round" d="M15 92 A45 12 0 0 0 105 92"/>` +
    `</svg>`
  );
}

/**
 * Build the holes for a config and skin.
 *
 * Each hole carries data-i (its own index) and data-btn (the 0-based button
 * for its column), so a tap can be turned into a button press.
 */
export function renderBoard(holesEl, config, skin) {
  const layout = LAYOUTS[config.layout];
  holesEl.className = `holes ${config.layout} skin-${skin.name}`;
  holesEl.style.setProperty('--cols', layout.columns);
  holesEl.style.setProperty('--rows', layout.rows);
  holesEl.innerHTML = Array.from({ length: layout.holes }, (_, i) =>
    `<div class="hole" data-i="${i}" data-btn="${layout.holeResponse[i]}" data-stim="">` +
      `<div class="art">${holeSVG(i, skin)}</div>` +
    `</div>`,
  ).join('');
}

/**
 * Draw the button labels under the board. One per button, aligned with the
 * column it controls. DECIDED (Rehaan Karnik, September 25, 2026): the
 * labels stay, in the scanner too.
 */
export function renderKeycaps(capsEl, config) {
  const layout = LAYOUTS[config.layout];
  capsEl.className = `keycaps ${config.layout}`;
  capsEl.style.setProperty('--cols', layout.columns);
  capsEl.innerHTML = config.keys.map((key) => `<span class="keycap">${key}</span>`).join('');
}

/** Show a target at visible fraction p (0 = fully down, 1 = fully up). */
export function setTarget(holesEl, i, p) {
  const h = holesEl.children[i];
  if (!h) return;
  h.querySelector('.target').setAttribute('transform', `translate(0 ${(TRAVEL * (1 - p)).toFixed(1)})`);
}

/** Select which picture is shown in a hole, or '' for none. */
export function setStimulus(holesEl, i, stim) {
  const h = holesEl.children[i];
  if (h) h.dataset.stim = stim || '';
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

/** Human description of the button mapping for instructions. */
export function keysDescription(config) {
  const layout = LAYOUTS[config.layout];
  if (layout.holeResponse.some((r, i) => r !== i)) {
    return `One button per column, left to right: ${config.keys.join(', ')}. ` +
      'The row does not matter, only the column.';
  }
  return `One button per hole: ${config.keys.join(', ')}.`;
}
