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

/**
 * Times are written at full precision, exactly as the clock gave them
 * (feedback of October 16, 2026). Nothing is rounded, so analysis can round
 * later if it wants to. The browser's clock is itself coarsened (about
 * 0.1 ms in Chrome; coarser in some browsers), and the screen only changes
 * every frame (about 16.7 ms), so digits past the first decimal are mostly
 * noise; they are kept anyway, because they cost nothing.
 */
const ms = (x) => String(x);
const sec = (x) => String(x / 1000);

/**
 * Up to this many presses per trial get their own button and time columns
 * (press_1_button, press_1_ms, ...). Missing ones are n/a, which pandas
 * reads as NaN. A trial with more presses still lists them all in the full
 * log, and n_presses gives the true count.
 */
export const PRESS_COLUMNS = 5;
const pressHeaders = (unit) => Array.from({ length: PRESS_COLUMNS }, (_, i) => [`press_${i + 1}_button`, `press_${i + 1}_${unit}`]).flat();
const NA = 'n/a';
const orNA = (v) => (v == null ? NA : v);

/** Column order of the run CSV. */
export const CSV_COLUMNS = Object.freeze([
  'participant', 'run', 'trial', 'onset_s', 'trial_type',
  'good_row', 'good_col', 'bad_row', 'bad_col',
  'correct_action', 'expected_button', 'n_presses', ...pressHeaders('ms'), 'first_press_ms', 'good_hit_ms',
  'good_outcome', 'bad_outcome', 'outcome', 'correct', 'score_points', 'score_pct', 'health',
  'scheduled_onset_s', 'onset_lag_ms', 'preceding_go',
]);

/** Column order of the BIDS-style events table. */
export const TSV_COLUMNS = Object.freeze([
  'onset', 'duration', 'trial_type', 'good_row', 'good_col', 'bad_row', 'bad_col',
  'expected_button', 'n_presses', ...pressHeaders('time'), 'outcome', 'response_time', 'scheduled_onset', 'preceding_go',
]);

/** Trials that were actually shown (the run may end before the schedule does). */
export function shownTrials(trials) {
  return trials.filter((a) => a.actualOnsetMs != null);
}

const goodOf = (a) => a.targets.find((x) => x.valence === 'good') || null;
const badOf = (a) => a.targets.find((x) => x.valence === 'bad') || null;
/** The first PRESS_COLUMNS presses as [button, time] pairs, n/a where there was none. */
const pressCells = (a, fmt) => Array.from({ length: PRESS_COLUMNS }, (_, i) => {
  const p = a.presses[i];
  return p ? [p.button + 1, fmt(p.rtMs)] : [NA, NA];
}).flat();
const pctText = (a) => (a.scoreDue > 0 ? (100 * a.scorePoints / a.scoreDue).toFixed(1) : NA);

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Run CSV: one row per trial shown. Times are milliseconds at full
 * precision. Each of the first PRESS_COLUMNS presses gets a button column
 * and a time column, in the order pressed; n_presses gives the count.
 */
export function buildRunCSV(trials, config = {}) {
  const rows = [CSV_COLUMNS.slice()];
  // Who and which run, on every row, so run tables can be stacked for analysis.
  const who = config.participant ? config.participant : NA;
  const run = config.run ?? NA;
  for (const a of shownTrials(trials)) {
    const g = goodOf(a);
    const b = badOf(a);
    rows.push([
      who,
      run,
      a.trial,
      sec(a.actualOnsetMs),
      a.type,
      g ? g.row : NA,
      g ? g.col : NA,
      b ? b.row : NA,
      b ? b.col : NA,
      g ? 'press' : 'withhold',
      g ? g.response + 1 : NA,
      a.presses.length,
      ...pressCells(a, ms),
      a.presses.length ? ms(a.presses[0].rtMs) : NA,
      a.goodRtMs != null ? ms(a.goodRtMs) : NA,
      g ? orNA(g.outcome) : NA,
      b ? orNA(b.outcome) : NA,
      orNA(a.outcome),
      orNA(a.correct),
      a.scoreDue != null ? a.scorePoints : NA,
      a.scoreDue != null ? pctText(a) : NA,
      a.health != null ? a.health : NA,
      sec(a.scheduledOnsetMs),
      ms(a.actualOnsetMs - a.scheduledOnsetMs),
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
      a.presses.length,
      ...pressCells(a, sec),
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
    actual_onset_ms: a.actualOnsetMs,
    offset_ms: a.offsetMs != null ? a.offsetMs : null,
    outcome: a.outcome || null,
    correct: a.correct,
    good_rt_ms: a.goodRtMs != null ? a.goodRtMs : null,
    score_points: a.scoreDue != null ? a.scorePoints : null,
    score_due: a.scoreDue != null ? a.scoreDue : null,
    health: a.health != null ? a.health : null,
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
      counted: x.counted !== false,   // false: a happy mole in a both trial after the sad mole was hit; scoring ignores it
      rt_ms: x.rtMs != null ? x.rtMs : null,
      offset_ms: x.offsetMs != null ? x.offsetMs : null,
      input: x.source || null,
    })),
    presses: a.presses.map((p) => ({
      button: p.button + 1, rt_ms: p.rtMs, outcome: p.outcome, input: p.source || null,
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
      participant: config.participant || null,
      run: config.run ?? null,
      schedule_seed: config.scheduleSeed ?? config.seed,
      in_scanner: config.setting === 'scanner' ? 1 : 0,
      feedback_variant: config.feedbackVariant || 'none',
      game_style: config.gameStyle,
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
  const variant = config.feedbackVariant && config.feedbackVariant !== 'none' ? `_${config.feedbackVariant}` : '';
  const seed = config.scheduleSeed ?? config.seed;
  // With a participant ID, BIDS-style labels come first, so a participant's
  // files sort together: sub-01_task-whacamole_run-02_...
  const who = config.participant
    ? `sub-${config.participant}_task-whacamole_run-${String(config.run).padStart(2, '0')}`
    : 'engagement-game';
  return `${who}_${exportStamp(date)}_${config.setting}_seed${seed}${variant}_${ext}`;
}

/**
 * The three files of a finished run, as { name, text, mime }. Pure.
 * @param {object} run  { config, trials, events, frameStats, userAgent, created }
 */
export function runFiles(run) {
  const date = new Date(run.created);
  return [
    { name: exportFilename(run.config, 'run', date), text: buildRunCSV(run.trials, run.config), mime: 'text/csv' },
    { name: exportFilename(run.config, 'events', date), text: buildEventsTSV(run.trials), mime: 'text/tab-separated-values' },
    { name: exportFilename(run.config, 'log', date), text: buildFullLogJSON(run), mime: 'application/json' },
  ];
}

/**
 * Save all three files of a run (auto-save, Phase 2). The downloads are
 * spaced out a little, because browsers handle several downloads at once
 * badly. The first time, a browser may ask whether this site may download
 * several files; allowing it once is enough. Browser only.
 * @returns {string[]} the file names
 */
export function downloadRun(run, spacingMs = 400) {
  const files = runFiles(run);
  files.forEach((f, i) => setTimeout(() => downloadText(f.name, f.text, f.mime), i * spacingMs));
  return files.map((f) => f.name);
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
