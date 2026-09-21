/**
 * Exports (README 4.5, 6.2, 6.3).
 *
 * Three files:
 *   1. run CSV      - the table Dr. Song asked for on September 21, 2026:
 *                     which mole appeared (row and column), what should have
 *                     been pressed, what was pressed, and the reaction time;
 *   2. events TSV   - BIDS-style, times in seconds, for the fMRI model;
 *   3. full JSON    - metadata, the trial table, and every raw event.
 *
 * The builders are pure and unit-tested. Only `downloadText` touches the DOM.
 */

const round1 = (x) => +x.toFixed(1);
const sec = (ms) => (ms / 1000).toFixed(3);
const NA = 'n/a';

/** Human-readable stimulus names for the run CSV. */
export const STIM_LABEL = Object.freeze({
  mole_happy: 'happy mole',
  mole_sad: 'sad mole',
  molerat: 'molerat',
});

/** Outcomes that count as a correct response. */
const CORRECT = new Set(['hit', 'correct_rejection']);

/** Column order of the run CSV. */
export const CSV_COLUMNS = Object.freeze([
  'trial', 'onset_s', 'stimulus', 'trial_type', 'mole_row', 'mole_col', 'hole',
  'expected_button', 'pressed_button', 'response_time_ms', 'outcome', 'correct',
  'scheduled_onset_s', 'onset_lag_ms', 'preceding_go',
]);

/** Column order of the BIDS-style events table. */
export const TSV_COLUMNS = Object.freeze([
  'onset', 'duration', 'trial_type', 'stimulus', 'hole', 'mole_row', 'mole_col',
  'expected_button', 'pressed_button', 'outcome', 'response_time', 'scheduled_onset', 'preceding_go',
]);

/** Trials that were actually shown (the run may end before the schedule does). */
export function shownTrials(trials) {
  return trials.filter((a) => a.actualOnsetMs != null);
}

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Run CSV: one row per shown trial, in the order Dr. Song asked for.
 * Reaction time is in milliseconds here because that is how it is read.
 */
export function buildRunCSV(trials) {
  const rows = [CSV_COLUMNS.slice()];
  for (const a of shownTrials(trials)) {
    rows.push([
      a.trial,
      sec(a.actualOnsetMs),
      STIM_LABEL[a.stim] || a.stim,
      a.type,
      a.row,
      a.col,
      a.hole + 1,
      a.response + 1,
      a.pressed != null ? a.pressed + 1 : NA,
      a.rtMs != null ? Math.round(a.rtMs) : NA,
      a.outcome || NA,
      a.outcome === 'truncated' || !a.outcome ? NA : (CORRECT.has(a.outcome) ? 1 : 0),
      sec(a.scheduledOnsetMs),
      Math.round(a.actualOnsetMs - a.scheduledOnsetMs),
      a.precedingGo != null ? a.precedingGo : NA,
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/**
 * Events table, one row per shown trial, times in seconds from the trigger.
 * Missing values are "n/a".
 */
export function buildEventsTSV(trials) {
  const rows = [TSV_COLUMNS.slice()];
  for (const a of shownTrials(trials)) {
    rows.push([
      sec(a.actualOnsetMs),
      a.offsetMs != null ? sec(a.offsetMs - a.actualOnsetMs) : NA,
      a.type,
      a.stim,
      a.hole + 1,
      a.row,
      a.col,
      a.response + 1,
      a.pressed != null ? a.pressed + 1 : NA,
      a.outcome || NA,
      a.rtMs != null ? sec(a.rtMs) : NA,
      sec(a.scheduledOnsetMs),
      a.precedingGo != null ? a.precedingGo : NA,
    ]);
  }
  return rows.map((r) => r.join('\t')).join('\n') + '\n';
}

/** Trial table for the JSON log (README 6.2). 1-based hole and buttons. */
export function trialTable(trials) {
  return shownTrials(trials).map((a) => ({
    trial: a.trial,
    type: a.type,
    stimulus: a.stim,
    hole: a.hole + 1,
    row: a.row,
    col: a.col,
    expected_button: a.response + 1,
    pressed_button: a.pressed != null ? a.pressed + 1 : null,
    scheduled_onset_ms: a.scheduledOnsetMs,
    actual_onset_ms: round1(a.actualOnsetMs),
    offset_ms: a.offsetMs != null ? round1(a.offsetMs) : null,
    outcome: a.outcome || null,
    rt_ms: a.rtMs != null ? round1(a.rtMs) : null,
    preceding_go: a.precedingGo,
    input: a.source || null,
  }));
}

/** Full log object (README 4.5 item 2). Serialize with JSON.stringify. */
export function buildFullLog({ config, trials, events, frameStats, userAgent, created }) {
  return {
    meta: {
      task: 'whac-a-mole go/no-go',
      version: config.version,
      created,
      setting: config.setting,
      in_scanner: config.setting === 'scanner' ? 1 : 0,
      clock: 'milliseconds from trigger, via performance.now()',
      onset_note: 'actual onset = animation frame on which the target was first drawn; display latency not measured',
      response_note: 'a button is a column: three buttons cover nine holes, so the row does not change the correct button',
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

/** Stamp shared by the files of one run. */
export function exportStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/**
 * File name for an export.
 * @param {'run'|'events'|'log'} kind
 */
export function exportFilename(config, kind, date = new Date()) {
  const ext = { run: 'run.csv', events: 'events.tsv', log: 'log.json' }[kind];
  if (!ext) throw new Error(`export: unknown file kind "${kind}"`);
  return `engagement-game_${exportStamp(date)}_${config.setting}_seed${config.seed}_${ext}`;
}

/** Download text as a file via a Blob URL and a temporary <a download>. */
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
