/**
 * Exports (README 4.5, 6.2, 6.3): BIDS-style events TSV and the full JSON log.
 *
 * The builders are pure and unit-tested. Only `downloadText` touches the DOM.
 */

const round1 = (x) => +x.toFixed(1);
const sec = (ms) => (ms / 1000).toFixed(3);

/** Column order of the events table. TODO: check names beyond onset/duration against the BIDS spec. */
export const TSV_COLUMNS = Object.freeze([
  'onset', 'duration', 'trial_type', 'hole', 'key', 'outcome', 'response_time', 'scheduled_onset', 'preceding_go',
]);

/** Trials that were actually shown (the run may end before the schedule does). */
export function shownTrials(trials) {
  return trials.filter((a) => a.actualOnsetMs != null);
}

/**
 * Events table, one row per shown trial, times in seconds from the trigger.
 * Missing values are "n/a".
 * @param {Array} trials  Engine trial records.
 * @param {string[]} keys Key-to-hole mapping (config.keys).
 */
export function buildEventsTSV(trials, keys) {
  const rows = [TSV_COLUMNS.slice()];
  for (const a of shownTrials(trials)) {
    rows.push([
      sec(a.actualOnsetMs),
      a.offsetMs != null ? sec(a.offsetMs - a.actualOnsetMs) : 'n/a',
      a.type,
      a.hole + 1,
      keys[a.hole],
      a.outcome || 'n/a',
      a.rtMs != null ? sec(a.rtMs) : 'n/a',
      sec(a.scheduledOnsetMs),
      a.precedingGo != null ? a.precedingGo : 'n/a',
    ]);
  }
  return rows.map((r) => r.join('\t')).join('\n') + '\n';
}

/** Trial table for the JSON log (README 6.2). 1-based hole. */
export function trialTable(trials) {
  return shownTrials(trials).map((a) => ({
    trial: a.trial,
    type: a.type,
    hole: a.hole + 1,
    scheduled_onset_ms: a.scheduledOnsetMs,
    actual_onset_ms: round1(a.actualOnsetMs),
    offset_ms: a.offsetMs != null ? round1(a.offsetMs) : null,
    outcome: a.outcome || null,
    rt_ms: a.rtMs != null ? round1(a.rtMs) : null,
    preceding_go: a.precedingGo,
    input: a.source || null,
  }));
}

/**
 * Full log object (README 4.5 item 2). Serialize with JSON.stringify.
 * @param {object} run
 * @param {object} run.config
 * @param {Array}  run.trials      Engine trial records.
 * @param {Array}  run.events      Logger records.
 * @param {object|null} run.frameStats
 * @param {string} run.userAgent
 * @param {string} run.created     ISO timestamp.
 */
export function buildFullLog({ config, trials, events, frameStats, userAgent, created }) {
  return {
    meta: {
      task: 'whac-a-mole go/no-go',
      version: config.version,
      created,
      clock: 'milliseconds from trigger, via performance.now()',
      onset_note: 'actual onset = animation frame on which the target was first drawn; display latency not measured',
      user_agent: userAgent,
      frame_stats: frameStats || null,
      config,
    },
    trials: trialTable(trials),
    events,
  };
}

/** Pretty JSON text for the full log. */
export function buildFullLogJSON(run) {
  return JSON.stringify(buildFullLog(run), null, 2);
}

/**
 * File name for an export, e.g. engagement-game_20260918-140502_seed1234_events.tsv
 * @param {object} config
 * @param {'events'|'log'} kind
 * @param {Date} [date]
 */
export function exportFilename(config, kind, date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  const ext = kind === 'events' ? 'events.tsv' : 'log.json';
  return `engagement-game_${stamp}_seed${config.seed}_${ext}`;
}

/**
 * Download text as a file via a Blob URL and a temporary <a download>.
 * Browser only.
 */
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
