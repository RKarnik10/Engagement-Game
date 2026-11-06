/**
 * Mole skin (README 3.6).
 *
 * Decided September 21, 2026: no eggplants. The good mole (press) is a happy
 * mole. The bad mole (hold back) is a sad mole. (A molerat alternative was
 * removed in November 2026.)
 *
 * Fixed September 25, 2026: the sad mole's brows slanted down toward the
 * middle, which read as angry; they now rise toward the middle.
 *
 * A skin only changes drawings. It exports one SVG fragment per stimulus,
 * which board.js places inside a 120x120 hole, plus the instruction text.
 * Colors are inline so adding or swapping a skin needs no stylesheet change.
 *
 * Go and no-go differ by SHAPE, not colour alone (README 3.6), so the task
 * still works for colour-blind participants: the happy mole's mouth curves
 * up, the sad mole's curves down.
 *
 * Matched for size and average brightness (README 3.6): the happy and sad
 * moles are the same drawing apart from the face, so they cover the same area
 * and have the same colours. Notes: docs/stimuli.md.
 */

const C = {
  body: '#6A4A33',
  muzzle: '#9C7A5E',
  nose: '#D9938A',
  eye: '#17110D',
};

/** Shared mole body and face, with the mouth path supplied per mood. */
function mole(mouth, browLeft, browRight) {
  return (
    `<path fill="${C.body}" d="M28 118 V56 C28 34 42 22 60 22 C78 22 92 34 92 56 V118 Z"/>` +
    `<ellipse fill="${C.muzzle}" cx="60" cy="68" rx="18" ry="14"/>` +
    `<path fill="none" stroke="${C.eye}" stroke-width="2.6" stroke-linecap="round" d="${browLeft}"/>` +
    `<path fill="none" stroke="${C.eye}" stroke-width="2.6" stroke-linecap="round" d="${browRight}"/>` +
    `<circle fill="${C.eye}" cx="49" cy="48" r="3.6"/><circle fill="${C.eye}" cx="71" cy="48" r="3.6"/>` +
    `<ellipse fill="${C.nose}" cx="60" cy="60" rx="7" ry="5"/>` +
    `<path fill="none" stroke="${C.eye}" stroke-width="2.8" stroke-linecap="round" d="${mouth}"/>` +
    `<ellipse fill="${C.muzzle}" cx="42" cy="88" rx="9" ry="6"/>` +
    `<ellipse fill="${C.muzzle}" cx="78" cy="88" rx="9" ry="6"/>`
  );
}

export const moleSkin = Object.freeze({
  name: 'mole',
  label: 'Moles',

  /** Which picture goes with each stimulus name from schedule.js. */
  art: Object.freeze({
    // Go: press this column's button. Mouth curves up, brows relaxed.
    mole_happy: `<g class="mole-art">${mole(
      'M51 72 Q60 80 69 72',
      'M44 41 Q49 38 54 40',
      'M66 40 Q71 38 76 41',
    )}</g>`,

    // Bad: hold back. Same mole, mouth curves down, inner brow ends raised.
    mole_sad: `<g class="mole-art">${mole(
      'M51 77 Q60 69 69 77',
      'M44 43 Q49 42 54 37',
      'M66 37 Q71 42 76 43',
    )}</g>`,

  }),

  /** Plain names for the instructions. */
  names: Object.freeze({ mole_happy: 'happy mole', mole_sad: 'sad mole' }),

  /**
   * Participant instructions.
   * @param {string} keysText  From board.js keysDescription().
   * @param {object} config    Resolved config (bothShare).
   */
  instructions(keysText, config) {
    const bad = this.names.mole_sad;
    const both = config.bothShare > 0
      ? `Sometimes a happy mole and a ${bad} pop up together: press only for the happy one. `
      : '';
    return `Press the button for the column a happy mole pops up in. Do nothing for a ${bad}. ${both}` +
      `${keysText} The screen will not react to your presses; that is expected.`;
  },
});

export default moleSkin;
