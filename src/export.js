/**
 * Exports (README 4.5, 6.2, 6.3).
 *
 * Three files:
 *   1. run CSV      - the table Dr. Song asked for: which moles appeared (row
 *                     and column), what should have been pressed, what was
 *                     pressed, and the reaction time;
 *   2. events TSV   - BIDS-style, times in seconds, for the fMRI model;
 *   3. full JSON    - metadata, the trial table, and every raw event.
 *
 * The builders are pure and unit-tested. Only `downloadText` touches the DOM.
 */

const round1 = (x) => +x.toFixed(1);
const sec = (ms) => (ms / 1000).toFixed(3);
const NA = 'n/a';
const orNA = (v) => (v == null ? NA : v);

/** Column order of the run CSV. */
export const CSV_COLUMNS = Object.freeze([
  'trial', 'onset_s', 'trial_type',
  'good_row', 'good_col', 'bad_row', 'bad_col',
  'correct_action', 'expected_button', 'pressed_buttons', 'first_press_ms', 'good_hit_ms',
  'good_outcome', 'bad_outcome', 'outcome', 'correct',
  'scheduled_onset_s', 'onset_lag_ms', 'preceding_go',
]);

/** Column order of the BIDS-style events table. */
export const TSV_COLUMNS = Object.freeze([
  'onset', 'duration', 'trial_type', 'good_row', 'good_col', 'bad_row', 'bad_col',
  'expected_button', 'pressed_buttons', 'outcome', 'response_time', 'scheduled_onset', 'preceding_go',
]);

/** Trials that were actually shown (the run may end before the schedule does). */
export function shownTrials(trials) {
  return trials.filter((a) => a.actualOnsetMs != null);
}

const goodOf = (a) => a.targets.find((x) => x.valence === 'good') || null;
const badOf = (a) => a.targets.find((x) => x.valence === 'bad') || null;
const pressedList = (a) => (a.presses.length ? a.presses.map((p) => p.button + 1).join(' ') : NA);

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Run CSV: one row per trial shown. Reaction times are whole milliseconds.
 * `pressed_buttons` lists every button pressed while the trial's moles were
 * up, in order, separated by spaces.
 */
export function buildRunCSV(trials) {
  const rows = [CSV_COLUMNS.slice()];
  for (const a of shownTrials(trials)) {
    const g = goodOf(a);
    const b = badOf(a);
    rows.push([
      a.trial,
      sec(a.actualOnsetMs),
      a.type,
      g ? g.row : NA,
      g ? g.col : NA,
      b ? b.row : NA,
      b ? b.col : NA,
      g ? 'press' : 'withhold',
      g ? g.response + 1 : NA,
      pressedList(a),
      a.presses.length ? Math.round(a.presses[0].rtMs) : NA,
      a.goodRtMs != null ? Math.round(a.goodRtMs) : NA,
      g ? orNA(g.outcome) : NA,
      b ? orNA(b.outcome) : NA,
      orNA(a.outcome),
      orNA(a.correct),
      sec(a.scheduledOnsetMs),
      Math.round(a.actualOnsetMs - a.scheduledOnsetMs),
      orNA(a.precedingGo),
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/**
 * Events table, one row per trial shown, times in seconds from the trigger.
 * Duration runs from onset to when the last mole of the trial went down.
 */
export function buildEventsTSV(trials) {
  const rows = [TSV_COLUMNS.slice()];
  for (const a of shownTrials(trials)) {
    const g = goodOf(a);
    const b = badOf(a);
    rows.push([
      sec(a.actualOnsetMs),
      a.offsetMs != null ? sec(a.offsetMs - a.actualOnsetMs) : NA,
      a.type,
      g ? g.row : NA,
      g ? g.col : NA,
      b ? b.row : NA,
      b ? b.col : NA,
      g ? g.response + 1 : NA,
      pressedList(a),
      orNA(a.outcome),
      a.goodRtMs != null ? sec(a.goodRtMs) : NA,
      sec(a.scheduledOnsetMs),
      orNA(a.precedingGo),
    ]);
  }
  return rows.map((r) => r.join('\t')).join('\n') + '\n';
}

/** Trial table for the JSON log (README 6.2). 1-based holes and buttons. */
export function trialTable(trials) {
  return shownTrials(trials).map((a) => ({
    trial: a.trial,
    type: a.type,
    scheduled_onset_ms: a.scheduledOnsetMs,
    actual_onset_ms: round1(a.actualOnsetMs),
    offset_ms: a.offsetMs != null ? round1(a.offsetMs) : null,
    outcome: a.outcome || null,
    correct: a.correct,
    good_rt_ms: a.goodRtMs != null ? round1(a.goodRtMs) : null,
    preceding_go: a.precedingGo,
    targets: a.targets.map((x) => ({
      target: x.index,
      valence: x.valence,
      stimulus: x.stim,
      hole: x.hole + 1,
      row: x.row,
      col: x.col,
      button: x.response + 1,
      outcome: x.outcome || null,
      rt_ms: x.rtMs != null ? round1(x.rtMs) : null,
      offset_ms: x.offsetMs != null ? round1(x.offsetMs) : null,
      input: x.source || null,
    })),
    presses: a.presses.map((p) => ({
      button: p.button + 1, rt_ms: round1(p.rtMs), outcome: p.outcome, input: p.source || null,
    })),
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
      trial_mix: { good: config.goodShare, bad: config.badShare, both: config.bothShare },
      good_stimulus: 'mole_happy',
      bad_stimulus: config.badStim,
      clock: 'milliseconds from trigger, via performance.now() in the participant display',
      onset_note: 'actual onset = animation frame on which the moles were first drawn; display latency not measured',
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
