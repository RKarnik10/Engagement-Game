/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * Byte-for-byte the same algorithm as the v0.1 prototype (index.html), so a
 * seed produces the same random stream here as it does there. Pure: no DOM,
 * no clock.
 *
 * @param {number} seed  Any number; coerced to a 32-bit integer.
 * @returns {() => number}  Function returning floats in [0, 1).
 */
export function mulberry32(seed) {
  let a = seed | 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
