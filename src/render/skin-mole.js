/**
 * Mole skin (README 3.6).
 *
 * Decided September 21, 2026: no eggplants. The go target is a happy mole;
 * the two no-go targets are a sad mole and a molerat.
 *
 * A skin only changes drawings. It exports one SVG fragment per stimulus,
 * which board.js places inside a 120x120 hole, plus the instruction text.
 * Colors are inline so adding or swapping a skin needs no stylesheet change.
 *
 * Go and no-go differ by SHAPE, not colour alone (README 3.6), so the task
 * still works for colour-blind participants: the happy mole's mouth curves
 * up, the sad mole's curves down, and the molerat has a bald head, big ears,
 * and two front teeth.
 *
 * TODO(Q8): the three drawings are not yet matched for size and average
 * brightness. That matching is required before scanning (README 3.6).
 */

const C = {
  body: '#6A4A33',
  muzzle: '#9C7A5E',
  nose: '#D9938A',
  eye: '#17110D',
  ratBody: '#B08C88',
  ratMuzzle: '#D8BDB6',
  ratTooth: '#F2EBDD',
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

    // No-go: hold back. Same mole, mouth curves down, brows slanted inward.
    mole_sad: `<g class="mole-art">${mole(
      'M51 77 Q60 69 69 77',
      'M44 38 Q49 42 54 43',
      'M66 43 Q71 42 76 38',
    )}</g>`,

    // No-go: hold back. A different animal: bald head, big ears, two teeth.
    molerat: `<g class="mole-art">` +
      `<ellipse fill="${C.ratBody}" cx="34" cy="44" rx="9" ry="10"/>` +
      `<ellipse fill="${C.ratBody}" cx="86" cy="44" rx="9" ry="10"/>` +
      `<path fill="${C.ratBody}" d="M30 118 V58 C30 38 43 26 60 26 C77 26 90 38 90 58 V118 Z"/>` +
      `<ellipse fill="${C.ratMuzzle}" cx="60" cy="72" rx="20" ry="15"/>` +
      `<circle fill="${C.eye}" cx="50" cy="52" r="2.8"/><circle fill="${C.eye}" cx="70" cy="52" r="2.8"/>` +
      `<ellipse fill="${C.eye}" cx="60" cy="64" rx="5" ry="3.5"/>` +
      `<rect fill="${C.ratTooth}" stroke="${C.eye}" stroke-width="1.2" x="55" y="75" width="4.2" height="13" rx="1"/>` +
      `<rect fill="${C.ratTooth}" stroke="${C.eye}" stroke-width="1.2" x="60.8" y="75" width="4.2" height="13" rx="1"/>` +
    `</g>`,
  }),

  /**
   * Participant instructions.
   * @param {string} keysText  From board.js keysDescription().
   */
  instructions(keysText) {
    return 'Press the button for the column a happy mole pops up in. ' +
      'Do nothing for a sad mole or a molerat. ' +
      `${keysText} The screen will not react to your presses; that is expected.`;
  },
});

export default moleSkin;
