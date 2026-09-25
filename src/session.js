/**
 * Participant-display session: runs the game in the display tab and reports
 * to the experimenter console over the link (see link.js).
 *
 * DOM-free. The display page passes a `view` object that does the drawing;
 * Node tests pass a fake clock and a fake view.
 *
 * Why the game runs here and not in the console: browsers pause animation
 * frames in a hidden tab, and key presses go to the window in front. The
 * participant's window is the one that is visible and focused, so it must
 * own the clock, the frames, and the input.
 *
 * The session keeps its last finished run and resends it when the console
 * says hello, so reloading the console does not lose data.
 */

import { resolveConfig } from './config.js';
import { buildSchedule } from './schedule.js';
import { createEngine } from './engine.js';
import { createLogger } from './logger.js';
import { MSG, CONSOLE_ID } from './link.js';

/** Per-mole outcomes: the mole goes down when one of these is logged. */
const MOLE_DOWN = new Set(['hit', 'commission', 'omission', 'correct_rejection', 'truncated']);

/**
 * @param {object} opts
 * @param {BroadcastChannel} opts.channel
 * @param {string} opts.displayId
 * @param {object} [opts.view]   { idle(config), running(config), frame(info),
 *                                 moleUp(hole, stim), moleDown(hole), ended(reason), error(message) }
 * @param {() => number} [opts.clock]
 * @param {(fn: Function) => any} [opts.raf]
 * @param {(id: any) => void} [opts.caf]
 * @param {string} [opts.userAgent]
 * @param {() => Date} [opts.now]  Wall clock, only for the "created" stamp.
 */
export function createDisplaySession({
  channel, displayId, view = {}, clock, raf, caf, userAgent = 'unknown', now = () => new Date(),
}) {
  const v = {
    idle() {}, running() {}, frame() {}, moleUp() {}, moleDown() {}, ended() {}, error() {}, ...view,
  };
  let config = resolveConfig({});
  let engine = null;
  let logger = null;
  let runId = null;
  let runCount = 0;
  let lastRun = null;

  const post = (msg) => channel.postMessage({ from: displayId, ...msg });
  const isRunning = () => !!(engine && engine.getState().running);
  const phase = () => (engine ? engine.getState().phase : 'idle');

  function status() {
    post({ type: MSG.STATUS, phase: phase(), runId, hasRun: !!lastRun, config });
  }

  function setConfig(raw) {
    if (isRunning()) return false;
    try {
      config = resolveConfig(raw);
    } catch (err) {
      v.error(err.message);
      post({ type: MSG.ERROR, message: err.message });
      return false;
    }
    engine = null;              // back to idle, ready for the next run
    v.idle(config);
    status();
    return true;
  }

  function onEvent(record, trial) {
    if (record.event === 'target_on') v.moleUp(record.hole - 1, record.stim);
    else if (MOLE_DOWN.has(record.event)) v.moleDown(record.hole - 1);
    // The trial itself only travels with trial_end, when it is complete.
    post({ type: MSG.EVENT, runId, record, trial: record.event === 'trial_end' ? trial : null });
    if (record.event === 'run_end') finish(record.reason);
  }

  function finish(reason) {
    lastRun = {
      runId,
      displayId,
      config,
      trials: engine.trials(),
      events: logger.toArray(),
      frameStats: engine.frameStats(),
      userAgent,
      created: now().toISOString(),
    };
    post({ type: MSG.RUN, run: lastRun });
    v.ended(reason);
    status();
  }

  /** The trigger key (or the console's Start button). A trigger during a run is a volume pulse. */
  function trigger(source) {
    if (isRunning()) return engine.pulse(source);
    logger = createLogger();
    engine = createEngine({
      config, trials: buildSchedule(config), logger, clock, raf, caf,
      onFrame: (info) => v.frame(info),
      onEvent,
    });
    runId = `${displayId}-run${++runCount}`;
    v.running(config);
    engine.start({ source });
    status();
    return null;
  }

  function onMessage(e) {
    const m = e.data;
    if (!m || typeof m !== 'object' || m.from !== CONSOLE_ID) return;
    if (m.to && m.to !== displayId) return;
    switch (m.type) {
      case MSG.CONFIG: setConfig(m.config); break;
      case MSG.START: if (!isRunning()) trigger('console'); break;
      case MSG.STOP: if (isRunning()) engine.stop('stopped'); break;
      case MSG.HELLO:
        status();
        if (lastRun && !isRunning()) post({ type: MSG.RUN, run: lastRun });
        break;
      default: break;
    }
  }
  channel.addEventListener('message', onMessage);

  v.idle(config);
  status();

  return {
    displayId,
    trigger,
    press: (button, source) => (isRunning() ? engine.press(button, source) : null),
    pulse: (source) => (isRunning() ? engine.pulse(source) : null),
    stop: () => { if (isRunning()) engine.stop('stopped'); },
    /** Log the display tab being hidden or shown; hidden tabs stop drawing. */
    visibility: (hidden) => (isRunning() ? engine.note(hidden ? 'display_hidden' : 'display_visible') : null),
    setConfig,
    isRunning,
    config: () => config,
    lastRun: () => lastRun,
    engine: () => engine,
    /** The display tab is closing. */
    bye() {
      post({ type: MSG.BYE });
      channel.removeEventListener('message', onMessage);
    },
  };
}
