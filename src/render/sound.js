/**
 * Feedback sounds for piloting (config.sound). Off by default: DECIDED(Q6)
 * says the participant gets no feedback, and README section 8 keeps sound
 * off for real sessions.
 *
 * The tones are synthesised with the Web Audio API, so there are no files.
 * A hit sounds like a "bonk" (a thump with a click); hitting a sad mole adds a
 * low buzz. With the hammer on, the bonk is timed to the hammer landing.
 * Browsers only allow audio after the person has pressed a key or clicked in
 * the page, so call unlock() from a key or pointer handler; the first press
 * in the display tab does this.
 *
 * Note: sound output adds its own small, unmeasured delay, and in the scanner
 * it would be drowned out unless played through MR-safe headphones.
 */

export function createSounds() {
  let ctx = null;

  /** Make or wake the audio context. Must run inside a key or pointer handler. */
  function unlock() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  /** One short tone with a quick fade in and out, so it does not click. */
  function tone({ freq, endFreq = freq, start = 0, dur, type = 'sine', gain = 0.2 }) {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A "bonk": a low thump whose pitch drops fast, with a short bright click on the front. */
  function bonk(start) {
    tone({ freq: 230, endFreq: 55, start, dur: 0.16, type: 'sine', gain: 0.5 });
    tone({ freq: 1500, endFreq: 260, start, dur: 0.035, type: 'triangle', gain: 0.22 });
  }

  /**
   * @param {'good'|'bad'} kind
   *   good: a bonk, the mole being whacked (feedback of October 26, 2026: it
   *         replaces the earlier bright "ding-ding", which felt too passive).
   *   bad:  the same bonk plus a low, falling buzz, so hitting a sad mole
   *         sounds like a mistake.
   * @param {number} [delayS]  Seconds to wait before it sounds. With the
   *   hammer on, this is the time the hammer takes to land, so the bonk is
   *   heard on the strike, not on the key press.
   */
  function play(kind, delayS = 0) {
    if (!ctx || ctx.state !== 'running') return false;
    bonk(delayS);
    if (kind !== 'good') {
      tone({ freq: 190, endFreq: 110, start: delayS + 0.05, dur: 0.24, type: 'square', gain: 0.07 });
    }
    return true;
  }

  return { unlock, play };
}
