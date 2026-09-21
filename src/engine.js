/**
 * Run state machine and requestAnimationFrame loop (README 3.1, 4.1).
 *
 * The engine owns the clock (t = 0 at the trigger), starts targets at their
 * scheduled times, resolves them through classify.js, and writes every event
 * to the logger. It never draws: the renderer subscribes through `onFrame`
 * and `onEvent` and only draws what the engine reports.
 *
 * A "press" is a BUTTON index (a column in the 3x3 layout), not a hole.
 *
 * `clock`, `raf`, and `caf` can be injected so the engine runs under a fake
 * clock in Node tests.
 */

import {
  classifyPress, classifyTimeout, classifyRunEnd, endsTrial, hasResponseTime, OUTCOME,
} from './classify.js';
import { runDurationMs } from './config.js';

const round1 = (x) => +x.toFixed(1);

/** A frame interval above this counts as "slow" in the frame statistics (README 4.5). */
export const SLOW_FRAME_MS = 20;

/**
 * Score deltas, kept for piloting outside the scanner. DECIDED(Q6): the
 * participant is shown nothing, so this never reaches the screen unless
 * showScore is turned back on.
 */
const SCORE_DELTA = Object.freeze({ [OUTCOME.HIT]: 1, [OUTCOME.COMMISSION]: -1 });

export function createEngine({ config, trials, logger, clock, raf, caf, onFrame, onEvent }) {
  if (!config || !Array.isArray(trials) || !logger) {
    throw new Error('engine: config, trials, and logger are required');
  }
  const now = clock || (() => performance.now());
  const requestFrame = raf || ((fn) => requestAnimationFrame(fn));
  const cancelFrame = caf || ((id) => cancelAnimationFrame(id));
  const frameHook = onFrame || (() => {});
  const eventHook = onEvent || (() => {});

  const records = trials.map((t) => ({
    ...t, actualOnsetMs: null, offsetMs: null, outcome: null, rtMs: null, source: null, pressed: null,
  }));
  const nButtons = config.keys.length;
  const durationMs = runDurationMs(config);
  const trMs = config.trS * 1000;

  const s = {
    phase: 'idle',           // idle -> running -> ended
    t0: null,
    tMs: 0,
    next: 0,
    active: null,
    score: 0,
    counts: { wrong_hole: 0, no_target_press: 0 },
    volumes: 0,              // simulated volumes (from trS)
    pulses: 0,               // real trigger pulses seen during the run
    lastFrame: null,
    frames: { n: 0, sum: 0, max: 0, slow: 0 },
    rafId: 0,
    endedMs: null,
    endReason: null,
  };

  function emit(event, data, tMs, trial) {
    const record = logger.log(event, data, tMs);
    eventHook(record, trial || null);
    return record;
  }

  const elapsed = () => now() - s.t0;

  function resolve(a, outcome, rtMs, t, source, pressed) {
    a.outcome = outcome;
    a.rtMs = rtMs;
    a.offsetMs = t;
    a.source = source;
    a.pressed = pressed == null ? null : pressed;
    s.active = null;
    const d = {
      trial: a.trial, hole: a.hole + 1, row: a.row, col: a.col,
      type: a.type, stim: a.stim, expected_button: a.response + 1,
    };
    if (pressed != null) d.pressed_button = pressed + 1;
    if (rtMs != null) d.rt_ms = round1(rtMs);
    if (source) d.source = source;
    if (SCORE_DELTA[outcome]) s.score += SCORE_DELTA[outcome];
    emit(outcome, d, t, a);
  }

  function tick() {
    if (s.phase !== 'running') return;
    const abs = now();
    const t = abs - s.t0;
    s.tMs = t;

    // Frame-interval statistics: a cheap health check for late onsets (README 4.5).
    if (s.lastFrame !== null) {
      const d = abs - s.lastFrame;
      const f = s.frames;
      f.n++;
      f.sum += d;
      if (d > f.max) f.max = d;
      if (d > SLOW_FRAME_MS) f.slow++;
    }
    s.lastFrame = abs;

    // Simulated scanner volumes on the TR grid (README 4.1). TODO(Q4): TR.
    while ((s.volumes + 1) * trMs <= t) {
      s.volumes++;
      emit('volume', { volume: s.volumes, simulated: true }, s.volumes * trMs);
    }

    // Active target reaches the end of its window.
    if (s.active) {
      const el = t - s.active.actualOnsetMs;
      if (el >= s.active.windowMs) resolve(s.active, classifyTimeout(s.active), null, t, null, null);
    }

    // Next scheduled target. The onset logged is this frame's time: the frame
    // on which the renderer first draws it (README 4.1).
    if (!s.active && s.next < records.length && t >= records[s.next].scheduledOnsetMs) {
      const a = records[s.next++];
      a.actualOnsetMs = t;
      s.active = a;
      emit('target_on', {
        trial: a.trial, hole: a.hole + 1, row: a.row, col: a.col,
        type: a.type, stim: a.stim, expected_button: a.response + 1,
        scheduled_ms: a.scheduledOnsetMs, lag_ms: round1(t - a.scheduledOnsetMs),
      }, t, a);
    }

    frameHook({
      tMs: t,
      active: s.active,
      elapsedMs: s.active ? t - s.active.actualOnsetMs : null,
    });

    if (t >= durationMs) { end('completed'); return; }
    s.rafId = requestFrame(tick);
  }

  /** Start the run. Sets t = 0 and logs the trigger. */
  function start(opts = {}) {
    if (s.phase !== 'idle') throw new Error('engine: start() can only be called once');
    s.phase = 'running';
    s.t0 = now();
    s.tMs = 0;
    emit('trigger', { volume: 0, source: opts.source || 'button', setting: config.setting }, 0);
    s.rafId = requestFrame(tick);
  }

  /**
   * A button press (a column in the 3x3 layout).
   * @param {number} button  0-based button index.
   * @param {string} source  e.g. "key 2" or "pointer".
   * @returns {string|null}  The outcome code, or null if the run is not running.
   */
  function press(button, source) {
    if (s.phase !== 'running') return null;
    if (!Number.isInteger(button) || button < 0 || button >= nButtons) {
      throw new Error(`engine: button must be an integer in [0, ${nButtons}), got ${button}`);
    }
    const t = elapsed();
    const a = s.active;
    const outcome = classifyPress(a, button);
    if (endsTrial(outcome)) {
      resolve(a, outcome, hasResponseTime(outcome) ? t - a.actualOnsetMs : null, t, source, button);
    } else if (outcome === OUTCOME.WRONG_HOLE) {
      s.counts.wrong_hole++;
      emit(outcome, {
        trial: a.trial, hole: a.hole + 1, row: a.row, col: a.col,
        expected_button: a.response + 1, pressed_button: button + 1,
        rt_ms: round1(t - a.actualOnsetMs), source,
      }, t, a);
    } else {
      s.counts.no_target_press++;
      emit(outcome, { pressed_button: button + 1, source }, t);
    }
    return outcome;
  }

  /**
   * A real trigger pulse received while running (README 4.1: every later
   * pulse is logged as a `volume` event). Distinct from simulated volumes.
   */
  function pulse(source) {
    if (s.phase !== 'running') return null;
    const t = elapsed();
    s.pulses++;
    return emit('volume', { volume: s.pulses, simulated: false, source }, t);
  }

  /** End the run. A target that is still up becomes `truncated`. */
  function end(reason) {
    if (s.phase !== 'running') return;
    const t = elapsed();
    cancelFrame(s.rafId);
    const a = s.active;
    const outcome = classifyRunEnd(a);
    if (outcome) {
      a.outcome = outcome;
      a.offsetMs = t;
      s.active = null;
      emit(outcome, {
        trial: a.trial, hole: a.hole + 1, row: a.row, col: a.col,
        type: a.type, stim: a.stim, expected_button: a.response + 1,
      }, t, a);
    }
    s.phase = 'ended';
    s.endedMs = t;
    s.endReason = reason;
    emit('run_end', { reason }, t);
  }

  /** Frame-interval statistics for the JSON metadata, or null before any frame. */
  function frameStats() {
    const f = s.frames;
    if (!f.n) return null;
    return {
      frames: f.n,
      mean_interval_ms: +(f.sum / f.n).toFixed(2),
      max_interval_ms: +f.max.toFixed(1),
      intervals_over_20ms: f.slow,
    };
  }

  function getState() {
    return {
      phase: s.phase,
      running: s.phase === 'running',
      tMs: s.tMs,
      score: s.score,
      counts: { ...s.counts },
      volumes: s.volumes,
      pulses: s.pulses,
      nextTrial: s.next,
      active: s.active,
      endedMs: s.endedMs,
      endReason: s.endReason,
    };
  }

  return {
    start,
    press,
    pulse,
    stop: (reason = 'stopped') => end(reason),
    /** The live trial records (read them; do not modify). */
    trials: () => records,
    frameStats,
    getState,
    config,
  };
}
