/**
 * Mole skin (README 3.6): go target = mole, no-go target = eggplant.
 *
 * A skin only changes drawings. It exports SVG fragments that board.js places
 * inside a 120x120 hole, plus the participant instruction text. All colors are
 * inline so no stylesheet change is needed to add or swap a skin.
 *
 * TODO(Q8): a neutral skin (round light / diamond) with the same interface goes
 * in skin-neutral.js (Phase 2). Size and luminance matching across skins is
 * not done yet (README 3.6).
 */

const C = {
  body: '#6A4A33',
  muzzle: '#9C7A5E',
  nose: '#D9938A',
  eye: '#17110D',
  egg: '#5E3D7E',
  leaf: '#4C7A3A',
};

export const moleSkin = Object.freeze({
  name: 'mole',
  label: 'Moles and eggplants',
  goName: 'mole',
  nogoName: 'eggplant',

  /** Go target: a mole. Drawn in the target group's coordinates (see board.js). */
  goArt:
    `<g class="mole-art">` +
      `<path fill="${C.body}" d="M28 118 V56 C28 34 42 22 60 22 C78 22 92 34 92 56 V118 Z"/>` +
      `<ellipse fill="${C.muzzle}" cx="60" cy="66" rx="17" ry="13"/>` +
      `<circle fill="${C.eye}" cx="49" cy="47" r="3.6"/><circle fill="${C.eye}" cx="71" cy="47" r="3.6"/>` +
      `<ellipse fill="${C.nose}" cx="60" cy="59" rx="7" ry="5"/>` +
      `<ellipse fill="${C.muzzle}" cx="42" cy="86" rx="9" ry="6"/><ellipse fill="${C.muzzle}" cx="78" cy="86" rx="9" ry="6"/>` +
    `</g>`,

  /** No-go target: an eggplant (from the original research task's variant). */
  nogoArt:
    `<g class="mole-art">` +
      `<ellipse fill="${C.egg}" cx="60" cy="70" rx="23" ry="33"/>` +
      `<path fill="${C.leaf}" d="M40 44 Q60 28 80 44 Q70 40 60 47 Q50 40 40 44 Z"/>` +
      `<rect fill="${C.leaf}" x="57" y="24" width="6" height="14" rx="2"/>` +
    `</g>`,

  /**
   * Participant instructions.
   * @param {string} keysText  From board.js keysDescription(), e.g. "keys 1 to 4".
   */
  instructions(keysText) {
    return `Whack each mole by pressing its key. Leave the eggplants alone. Use ${keysText}.`;
  },
});

export default moleSkin;
