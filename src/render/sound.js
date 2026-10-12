/**
 * Feedback sounds for piloting (config.sound). Off by default: DECIDED(Q6)
 * says the participant gets no feedback, and README section 8 keeps sound
 * off for real sessions.
 *
 * The tones are synthesised with the Web Audio API, so there are no files.
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

  /**
   * @param {'good'|'bad'} kind
   *   good: two quick rising notes (a bright "ding-ding").
   *   bad:  a short, low, falling buzz.
   */
  function play(kind) {
    if (!ctx || ctx.state !== 'running') return false;
    if (kind === 'good') {
      tone({ freq: 880, dur: 0.08, gain: 0.18 });
      tone({ freq: 1320, start: 0.07, dur: 0.12, gain: 0.18 });
    } else {
      tone({ freq: 190, endFreq: 110, dur: 0.22, type: 'square', gain: 0.07 });
    }
    return true;
  }

  return { unlock, play };
}
