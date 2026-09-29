/**
 * The link between the experimenter console and the participant display,
 * which run in separate browser tabs or windows (decided September 21, 2026:
 * "Experimenter and Participant Room" screens).
 *
 * The two pages talk over a BroadcastChannel, which connects pages of the
 * same site in the same browser. The game itself runs in the participant
 * display: that is where frames are drawn and where the participant's (and
 * the scanner's) key presses arrive. The console only sends settings and
 * start/stop, and receives every logged event plus the finished run.
 *
 * DOM-free, so it runs in Node tests (Node has BroadcastChannel built in).
 *
 * Messages carry `from` ("console" or a display id) and, for commands meant
 * for one display, `to`.
 *   console -> display: config, start, stop, pause, resume, hello
 *   display -> console: status, event, run, error, bye
 */

export const CHANNEL = 'engagement-game';
export const CONSOLE_ID = 'console';

export const MSG = Object.freeze({
  CONFIG: 'config',
  START: 'start',
  STOP: 'stop',
  PAUSE: 'pause',
  RESUME: 'resume',
  HELLO: 'hello',
  STATUS: 'status',
  EVENT: 'event',
  RUN: 'run',
  ERROR: 'error',
  BYE: 'bye',
});

/** A display id: unique among open tabs; not used for anything random in the task. */
export function newDisplayId() {
  return `display-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Console side of the link.
 *
 * @param {object} opts
 * @param {BroadcastChannel} opts.channel
 * @param {(state: object) => void} [opts.onChange]  Displays connected or their phase changed.
 * @param {(record: object, trial: object|null, runId: string) => void} [opts.onEvent]
 * @param {(run: object) => void} [opts.onRun]       A finished run arrived.
 * @param {(message: string) => void} [opts.onError] A display rejected the settings.
 */
export function createConsoleLink({ channel, onChange = () => {}, onEvent = () => {}, onRun = () => {}, onError = () => {} }) {
  const displays = new Map();   // id -> { phase, runId, hasRun }
  let current = null;           // the display commands go to
  let config = null;
  const post = (msg) => channel.postMessage({ from: CONSOLE_ID, ...msg });

  function state() {
    const d = current ? displays.get(current) : null;
    return {
      connected: !!d,
      displayCount: displays.size,
      current,
      phase: d ? d.phase : null,
      paused: d ? d.paused : false,
      runId: d ? d.runId : null,
      config: d ? d.config : null,
    };
  }

  function onMessage(e) {
    const m = e.data;
    if (!m || typeof m !== 'object' || !m.from || m.from === CONSOLE_ID) return;
    switch (m.type) {
      case MSG.STATUS: {
        const isNew = !displays.has(m.from);
        displays.set(m.from, { phase: m.phase, paused: !!m.paused, runId: m.runId, hasRun: m.hasRun, config: m.config || null });
        if (!current || isNew) current = m.from;
        // A display that just opened gets the current settings.
        if (isNew && config && m.phase !== 'running') post({ type: MSG.CONFIG, to: m.from, config });
        onChange(state());
        break;
      }
      case MSG.BYE:
        displays.delete(m.from);
        if (current === m.from) current = [...displays.keys()].pop() || null;
        onChange(state());
        break;
      case MSG.EVENT:
        if (m.from === current) onEvent(m.record, m.trial || null, m.runId);
        break;
      case MSG.RUN:
        if (m.from === current) onRun(m.run);
        break;
      case MSG.ERROR:
        onError(m.message);
        break;
      default:
        break;
    }
  }
  channel.addEventListener('message', onMessage);

  return {
    /** Send settings to every open display. Displays ignore them while running. */
    setConfig(c) {
      config = c;
      post({ type: MSG.CONFIG, config: c });
    },
    /** Start a run on the connected display. Returns false when none is connected. */
    start() {
      if (!current) return false;
      post({ type: MSG.START, to: current });
      return true;
    },
    stop() {
      if (!current) return false;
      post({ type: MSG.STOP, to: current });
      return true;
    },
    /** Pause or resume the run on the connected display (testing only). */
    pause() {
      if (!current) return false;
      post({ type: MSG.PAUSE, to: current });
      return true;
    },
    resume() {
      if (!current) return false;
      post({ type: MSG.RESUME, to: current });
      return true;
    },
    /** Ask every display to report in, and to resend its last finished run. */
    hello() {
      post({ type: MSG.HELLO });
    },
    state,
    close() {
      channel.removeEventListener('message', onMessage);
    },
  };
}
