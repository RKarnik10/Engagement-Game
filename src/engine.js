/**
 * Run state machine and requestAnimationFrame loop (README 3.1, 4.1).
 *
 * The engine owns the clock (t = 0 at the trigger), puts moles up at their
 * scheduled times, resolves them through classify.js, and writes every event
 * to the logger. It never draws: the display subscribes through `onFrame`
 * and `onEvent` and only draws what the engine reports.
 *
 * A trial shows one mole, or two at once ("both" trials). Each mole resolves
 * on its own: a hit or commission takes it down; the rest go down at the end
 * of the window. The trial ends when its last mole is down.
 *
 * A "press" is a BUTTON index (a column in the 3x3 layout), not a hole.
 * `clock`, `raf`, and `caf` can be injected so the engine runs under a fake
 * clock in Node tests.
 */

import {
  classifyPress, classifyTimeout, classifyRunEnd, classifyTrial, trialCorrect,
  hasResponseTime, OUTCOME,
} from './classify.js';
import { runDurationMs } from './config.js';

const round1 = (x) => +x.toFixed(1);

/** A frame interval above this counts as "slow" in the frame statistics (README 4.5). */
export const SLOW_FRAME_MS = 20;

/**
 * Score deltas, kept for piloting only. DECIDED(Q6): the participant is
 * shown nothing, so this never reaches the screen unless showScore is on.
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
    ...t,
    targets: t.targets.map((x, i) => ({
      ...x, index: i + 1, outcome: null, rtMs: null, offsetMs: null, source: null,
    })),
    actualOnsetMs: null,
    offsetMs: null,
    outcome: null,
    correct: null,
    goodRtMs: null,
    presses: [],
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
    paused: false,
    pausedAtAbs: null,       // clock reading when the pause began
    pausedAtMs: null,        // run time (ms from trigger) when the pause began
    pauses: 0,
    pausedTotalMs: 0,
  };

  function emit(event, data, tMs, trial) {
    const record = logger.log(event, data, tMs);
    eventHook(record, trial || null);
    return record;
  }

  // Run time freezes while paused, so the schedule simply resumes where it stopped.
  const elapsed = () => (s.paused ? s.pausedAtMs : now() - s.t0);
  const upTargets = (a) => (a ? a.targets.filter((x) => !x.outcome) : []);
  const moleFields = (a, x) => ({
    trial: a.trial, type: a.type, target: x.index, valence: x.valence, stim: x.stim,
    hole: x.hole + 1, row: x.row, col: x.col, button: x.response + 1,
  });

  function resolveTarget(a, x, outcome, t, press) {
    x.outcome = outcome;
    x.offsetMs = t;
    const d = moleFields(a, x);
    if (press) {
      x.rtMs = press.rtMs;
      x.source = press.source;
      d.pressed_button = press.button + 1;
      d.rt_ms = round1(press.rtMs);
      d.source = press.source;
    }
    if (SCORE_DELTA[outcome]) s.score += SCORE_DELTA[outcome];
    emit(outcome, d, t, a);
  }

  function endTrial(a, t) {
    a.offsetMs = t;
    a.outcome = classifyTrial(a);
    a.correct = trialCorrect(a);
    const good = a.targets.find((x) => x.valence === 'good');
    a.goodRtMs = good && good.outcome === OUTCOME.HIT ? good.rtMs : null;
    s.active = null;
    emit('trial_end', { trial: a.trial, type: a.type, outcome: a.outcome, correct: a.correct }, t, a);
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

    // The window closes: every mole still up goes down unpressed.
    if (s.active && t - s.active.actualOnsetMs >= s.active.windowMs) {
      const a = s.active;
      for (const x of upTargets(a)) resolveTarget(a, x, classifyTimeout(x), t, null);
      endTrial(a, t);
    }

    // Next scheduled trial. The onset logged is this frame's time: the frame
    // on which the display first draws it (README 4.1).
    if (!s.active && s.next < records.length && t >= records[s.next].scheduledOnsetMs) {
      const a = records[s.next++];
      a.actualOnsetMs = t;
      s.active = a;
      for (const x of a.targets) {
        emit('target_on', {
          ...moleFields(a, x), scheduled_ms: a.scheduledOnsetMs, lag_ms: round1(t - a.scheduledOnsetMs),
        }, t, a);
      }
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
   * @returns {string|null}  The outcome code, or null if the run is not running.
   */
  function press(button, source) {
    if (s.phase !== 'running' || s.paused) return null;
    if (!Number.isInteger(button) || button < 0 || button >= nButtons) {
      throw new Error(`engine: button must be an integer in [0, ${nButtons}), got ${button}`);
    }
    const t = elapsed();
    const a = s.active;
    const up = upTargets(a);
    const { outcome, target } = classifyPress(up, button);
    if (a) a.presses.push({ button, rtMs: t - a.actualOnsetMs, source, outcome });

    if (target) {
      const p = { button, rtMs: t - a.actualOnsetMs, source };
      resolveTarget(a, target, outcome, t, hasResponseTime(outcome) ? p : null);
      if (!upTargets(a).length) endTrial(a, t);
    } else if (outcome === OUTCOME.WRONG_HOLE) {
      s.counts.wrong_hole++;
      emit(outcome, {
        trial: a.trial, type: a.type, pressed_button: button + 1,
        up_buttons: up.map((x) => x.response + 1), rt_ms: round1(t - a.actualOnsetMs), source,
      }, t, a);
    } else {
      s.counts.no_target_press++;
      emit(outcome, { pressed_button: button + 1, source }, t);
    }
    return outcome;
  }

  /** A real trigger pulse received while running (README 4.1). */
  function pulse(source) {
    if (s.phase !== 'running' || s.paused) return null;
    const t = elapsed();
    s.pulses++;
    return emit('volume', { volume: s.pulses, simulated: false, source }, t);
  }

  /**
   * Log something the engine cannot see itself, such as the display tab
   * being hidden. Only while running.
   */
  function note(event, data = {}) {
    if (s.phase !== 'running') return null;
    // While paused, run time is frozen at the pause.
    return emit(event, data, elapsed());
  }

  /**
   * Pause the run, for testing only. The run clock stops: the mole that is up
   * stays up, and when the run resumes every later trial starts that much
   * later. A real scanner does not pause, so a paused run is not usable for
   * fMRI; the pauses are logged so this is visible in the data.
   */
  function pause() {
    if (s.phase !== 'running' || s.paused) return false;
    const t = elapsed();
    cancelFrame(s.rafId);
    s.paused = true;
    s.pausedAtAbs = now();
    s.pausedAtMs = t;
    s.pauses++;
    emit('pause', { pause: s.pauses }, t);
    return true;
  }

  /** Resume after pause(). The time spent paused is removed from the run clock. */
  function resume() {
    if (s.phase !== 'running' || !s.paused) return false;
    const pausedFor = now() - s.pausedAtAbs;
    s.t0 += pausedFor;
    s.pausedTotalMs += pausedFor;
    s.paused = false;
    s.lastFrame = null;      // the paused stretch is not a slow frame
    emit('resume', { pause: s.pauses, paused_ms: round1(pausedFor) }, elapsed());
    s.rafId = requestFrame(tick);
    return true;
  }

  /** End the run. Any mole still up becomes `truncated`. Works while paused. */
  function end(reason) {
    if (s.phase !== 'running') return;
    const t = elapsed();
    cancelFrame(s.rafId);
    s.paused = false;
    const a = s.active;
    if (a) {
      for (const x of upTargets(a)) resolveTarget(a, x, classifyRunEnd(x), t, null);
      endTrial(a, t);
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
      paused: s.paused,
      pauses: s.pauses,
      pausedTotalMs: s.pausedTotalMs,
    };
  }

  return {
    start,
    press,
    pulse,
    note,
    pause,
    resume,
    stop: (reason = 'stopped') => end(reason),
    /** The live trial records (read them; do not modify). */
    trials: () => records,
    frameStats,
    getState,
    config,
  };
}
