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
import { runDurationMs, HEALTH_MAX } from './config.js';
import { scorePercent } from './summary.js';

// Times are logged at full precision (October 16, 2026); no rounding here.

/** A frame interval above this counts as "slow" in the frame statistics (README 4.5). */
export const SLOW_FRAME_MS = 20;

/**
 * Score (feedback relayed by Rehaan Karnik, October 13, 2026):
 *   points = happy moles hit x 1 - distractors hit x scorePenalty (3)
 *   due    = happy moles that could have been hit so far (each one counts once
 *            it is hit or goes down missed), so a perfect player is at 100%
 *   shown  = points / due, as a percentage (scorePercent in summary.js)
 * A percentage, not a count, so the score does not reveal how many trials
 * are left. Wrong-column presses cost nothing. It reaches the screen only
 * when showScore is on; DECIDED(Q6) keeps it off for real participants.
 */

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
    health: HEALTH_MAX,      // health bar (see config.gameStyle); never ends the run
    streak: 0,               // correct trials in a row, toward the next regeneration
    points: 0,               // score numerator
    due: 0,                  // score denominator: happy moles resolved so far
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
      d.rt_ms = press.rtMs;
      d.source = press.source;
    }
    // In a "both" trial, once the sad mole has been hit the trial counts only
    // as that error (Rehaan Karnik, October 26, 2026): the happy mole no longer
    // counts toward the score or health, whether it is then pressed (a hit) or
    // missed. Its raw outcome and press are still recorded in the data; only
    // the scoring ignores it. If the happy mole was hit BEFORE the sad one, it
    // had already counted and still does.
    const voided = x.valence === 'good'
      && a.targets.some((o) => o.valence === 'bad' && o.outcome === OUTCOME.COMMISSION);
    x.counted = !voided;
    if (voided) d.counted = false;
    if (outcome === OUTCOME.HIT && !voided) s.points += 1;
    if (outcome === OUTCOME.COMMISSION) s.points -= config.scorePenalty;
    if (x.valence === 'good' && (outcome === OUTCOME.HIT || outcome === OUTCOME.OMISSION) && !voided) s.due += 1;
    d.score_points = s.points;
    d.score_due = s.due;
    // Health: errors cost health at once. It stops at 0 (no game over).
    if (outcome === OUTCOME.COMMISSION) s.health = Math.max(0, s.health - config.healthSadHit);
    if (outcome === OUTCOME.OMISSION && !voided) s.health = Math.max(0, s.health - config.healthMiss);
    d.health = s.health;
    emit(outcome, d, t, a);
  }

  function endTrial(a, t) {
    a.offsetMs = t;
    a.outcome = classifyTrial(a);
    a.correct = trialCorrect(a);
    const good = a.targets.find((x) => x.valence === 'good');
    a.goodRtMs = good && good.outcome === OUTCOME.HIT ? good.rtMs : null;
    // Health regenerates after healthStreak correct trials in a row. A wrong
    // trial restarts the count; a trial cut off by the end of the run does
    // neither (correct is null).
    if (a.correct === 1) {
      s.streak += 1;
      if (s.streak >= config.healthStreak) {
        s.health = Math.min(HEALTH_MAX, s.health + config.healthRegen);
        s.streak = 0;
      }
    } else if (a.correct === 0) {
      s.streak = 0;
    }
    a.scorePoints = s.points;
    a.scoreDue = s.due;
    a.health = s.health;
    s.active = null;
    emit('trial_end', {
      trial: a.trial, type: a.type, outcome: a.outcome, correct: a.correct, health: s.health, health_streak: s.streak,
    }, t, a);
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
          ...moleFields(a, x), scheduled_ms: a.scheduledOnsetMs, lag_ms: t - a.scheduledOnsetMs,
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
        up_buttons: up.map((x) => x.response + 1), rt_ms: t - a.actualOnsetMs, source,
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
    emit('resume', { pause: s.pauses, paused_ms: pausedFor }, elapsed());
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
      score: s.points,
      scoreDue: s.due,
      scorePct: scorePercent(s.points, s.due),
      health: s.health,
      healthStreak: s.streak,
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
