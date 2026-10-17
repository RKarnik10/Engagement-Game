/**
 * Board: hole layout and drawing helpers shared by all skins (README 3.6).
 *
 * Only draws. Never decides outcomes.
 *
 * Decided September 21, 2026 (Q6): the board gives the participant NO
 * feedback; moles only pop in and out. For piloting variations (October 11,
 * 2026) it can draw a ring around a hole (config.hitRings) and swing a hammer
 * onto a pressed mole (config.hammer). Both are off by default, and the
 * display only calls them when they are on.
 */

import { LAYOUTS } from '../config.js';

/** Fixed mid-grey stimulus background (README 4.3). Must not change with theme. */
export const STIMULUS_BACKGROUND = '#808080';

/** Hole colors, identical in every skin and theme. */
// Hole colours come from styles.css (.mound, .pit, .lip), so each scene can
// colour them: brown earth in the garden scene, muted grey-brown on plain grey.

/** Vertical travel of the target group inside its clip, in SVG units. */
const TRAVEL = 84;

/**
 * Hammer, drawn in its "landed" pose: the head's striking face rests on the
 * top of a raised mole (y = 22) and the handle runs off to the right. It
 * swings down from above, pivoting on the handle's end (styles.css).
 * A plain cartoon mallet; no impact effect.
 */
const HAMMER =
  `<g class="hammer" aria-hidden="true">` +
    `<rect fill="#A8763E" stroke="#5E3F1E" stroke-width="1.5" x="70" y="4" width="50" height="8" rx="4"/>` +
    `<rect fill="#4A4F57" stroke="#22252A" stroke-width="1.5" x="45" y="-8" width="27" height="30" rx="5"/>` +
    `<rect fill="#6B717B" x="45.8" y="1" width="25.4" height="5"/>` +
  `</g>`;

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
      `<ellipse class="mound" cx="60" cy="95" rx="57" ry="19"/>` +
      `<ellipse class="pit" cx="60" cy="92" rx="45" ry="12"/>` +
      `<g clip-path="url(#clip-${i})"><g class="target" transform="translate(0 ${TRAVEL})">${arts}</g></g>` +
      `<path class="lip" fill="none" stroke-width="5" stroke-linecap="round" d="M15 92 A45 12 0 0 0 105 92"/>` +
      // Feedback ring: only the front arc, below the hole's rim, so it never
      // crosses a mole that is still up (October 17, 2026).
      `<path class="fx" stroke-linecap="round" d="M7 92 A53 17 0 0 0 113 92"/>` +
      HAMMER +
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

/** Restart a short CSS animation on a hole by toggling a class. */
function replay(holesEl, i, cls, others, ms) {
  const h = holesEl.children[i];
  if (!h) return;
  h.classList.remove(cls, ...others);
  void h.offsetWidth; // force a reflow so the animation starts again
  h.classList.add(cls);
  clearTimeout(h[`_${cls}`]);
  h[`_${cls}`] = setTimeout(() => h.classList.remove(cls), ms);
}

/**
 * Ring around a hole (config.hitRings): white for a hit, red for a
 * distractor pressed.
 * @param {'hit'|'commission'} kind
 */
export function flashRing(holesEl, i, kind) {
  const cls = kind === 'hit' ? 'fx-hit' : 'fx-com';
  replay(holesEl, i, cls, ['fx-hit', 'fx-com'], 260);
}

/**
 * Hammer timing, in ms from the press. The hammer lands at HAMMER_LAND_MS;
 * the mole it hits waits for it, gets squashed, and sinks by
 * HAMMER_SINK_DONE_MS. Must match the keyframes in styles.css.
 */
export const HAMMER_LAND_MS = 90;
export const HAMMER_SINK_DONE_MS = 300;

/** Swing the hammer onto a hole (config.hammer). */
export function swingHammer(holesEl, i) {
  replay(holesEl, i, 'swing', [], 300);
}

/**
 * With the hammer on, a hit mole stays up until the hammer lands, then gets
 * squashed and sinks (October 17, 2026). Display only: the data records the
 * hit at the moment of the press, as always. `done` runs once it is down.
 */
export function sinkStruck(holesEl, i, done) {
  const h = holesEl.children[i];
  if (!h) { done(); return; }
  h.classList.remove('struck');
  void h.offsetWidth; // restart the animation
  h.classList.add('struck');
  clearTimeout(h._sink);
  h._sink = setTimeout(() => {
    h.classList.remove('struck');
    h._sink = null;
    done();
  }, HAMMER_SINK_DONE_MS);
}

/** Stop a pending sink, e.g. if a new mole needs the hole. */
export function cancelSink(holesEl, i) {
  const h = holesEl.children[i];
  if (!h || !h._sink) return false;
  clearTimeout(h._sink);
  h._sink = null;
  h.classList.remove('struck');
  return true;
}

/** Put the scene on the stage: `scene-garden` or `scene-grey` (styles.css). */
export function applyScene(stageEl, config) {
  stageEl.classList.toggle('scene-garden', config.scene === 'garden');
  stageEl.classList.toggle('scene-grey', config.scene !== 'garden');
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
