/**
 * Experimenter console. Sends settings and start/stop to the participant
 * display (another tab), mirrors what it shows, keeps live measures, and
 * builds the three export files when a run finishes.
 *
 * The game does not run here; see session.js for why.
 */

import { resolveConfig, runDurationMs, LAYOUTS } from './config.js';
import { trialCounts } from './schedule.js';
import { CHANNEL, createConsoleLink } from './link.js';
import {
  buildRunCSV, buildEventsTSV, buildFullLogJSON, exportFilename, downloadText,
} from './export.js';
import { renderBoard, renderKeycaps, setTarget, setStimulus } from './render/board.js';
import { moleSkin } from './render/skin-mole.js';
import { drawTrace, moveCursor } from './render/trace.js';
import { summarize, eventCounts, runSummaryText } from './summary.js';

const SKINS = { mole: moleSkin };

const $ = (id) => document.getElementById(id);
const form = $('settings');
const holesEl = $('holes');
const capsEl = $('keycaps');
const overlay = $('overlay');
const ovTitle = $('ov-title');
const ovBody = $('ov-body');
const startBtn = $('start');
const pauseBtn = $('pause');
const stopBtn = $('stop');
const logEl = $('log');
const exportBox = $('export');
const chartData = $('chart-data');
const cursorEl = $('cursor');
const copyBtn = $('copy');
const copyStatus = $('copy-status');
const linkStatus = $('link-status');
const settingsError = $('settings-error');

const LABEL = {
  trigger: 'Trigger', volume: 'Trigger pulse', target_on: 'Mole up', hit: 'Hit', omission: 'Missed',
  commission: 'Pressed bad mole', correct_rejection: 'Left bad mole', wrong_hole: 'Wrong column',
  no_target_press: 'Press, no mole', truncated: 'Cut off', run_end: 'Run end',
  display_hidden: 'DISPLAY HIDDEN', display_visible: 'Display visible again',
  pause: 'Paused (testing)', resume: 'Resumed',
};
const MOLE_DOWN = new Set(['hit', 'commission', 'omission', 'correct_rejection', 'truncated']);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let config = null;          // settings from the form (null while invalid)
let shown = null;           // the run on screen, live or finished (see beginRun)
let exportMode = 'csv';

/* ---------- link to the participant display ---------- */

const link = createConsoleLink({
  channel: new BroadcastChannel(CHANNEL),
  onChange: renderLinkState,
  onEvent,
  onRun,
  onError: (message) => showSettingsError(`The display rejected the settings: ${message}`),
});

function renderLinkState(st) {
  const running = st.phase === 'running';
  if (!st.connected) linkStatus.textContent = 'Participant display: not open.';
  else if (st.displayCount > 1) linkStatus.textContent = `Warning: ${st.displayCount} participant displays are open. Close all but one.`;
  else linkStatus.textContent = `Participant display: connected, ${running ? (st.paused ? 'paused' : 'running') : st.phase === 'ended' ? 'run finished' : 'ready'}.`;
  linkStatus.classList.toggle('warn', st.displayCount > 1);
  startBtn.disabled = !st.connected || running || !config;
  stopBtn.disabled = !running;
  pauseBtn.disabled = !running;
  pauseBtn.textContent = running && st.paused ? 'Resume' : 'Pause';
  if (running && shown && !shown.finished) {
    // The mirror shows the pause the way the display does.
    overlay.hidden = !st.paused;
    if (st.paused) { ovTitle.textContent = 'Paused'; ovBody.innerHTML = '<p>The run clock is stopped.</p>'; }
  }
  setFormDisabled(running);
  // Setup steps until a display connects; the mirror after.
  $('connect-card').hidden = st.connected;
  for (const id of ['mirror-title', 'stage', 'mirror-caption']) $(id).hidden = !st.connected;
  if (!running) mirrorIdle(st);
}

// "Open participant display" is a plain link (index.html), so it opens the
// display tab even if this script failed to load.
startBtn.addEventListener('click', () => link.start());
stopBtn.addEventListener('click', () => link.stop());
pauseBtn.addEventListener('click', () => (link.state().paused ? link.resume() : link.pause()));

/* ---------- settings ---------- */

function readConfig() {
  const f = new FormData(form);
  const num = (k, d) => { const v = parseFloat(f.get(k)); return Number.isFinite(v) ? v : d; };
  return resolveConfig({
    setting: f.get('setting') || 'behavioral',
    layout: f.get('layout') || 'grid3x3',
    onset: f.get('onset') || 'instant',
    goodShare: clamp(num('goodPct', 80), 0, 100) / 100,
    badShare: clamp(num('badPct', 10), 0, 100) / 100,
    bothShare: clamp(num('bothPct', 10), 0, 100) / 100,
    badStim: f.get('badStim') || 'mole_sad',
    nTrials: Math.round(clamp(num('nTrials', 600), 10, 3000)),
    trialMs: Math.round(clamp(num('trialMs', 1000), 400, 4000)),
    holdMs: Math.round(clamp(num('holdMs', 800), 200, 3500)),
    trS: clamp(num('tr', 1), 0.3, 5),
    seed: Math.trunc(num('seed', 1234)),
    showResultsOnDisplay: f.get('showResultsOnDisplay') === 'on',
  });
}

function showSettingsError(message) {
  settingsError.textContent = message;
  settingsError.hidden = !message;
}

function setFormDisabled(v) {
  form.querySelectorAll('input').forEach((el) => { el.disabled = v; });
}

function syncSettings() {
  try {
    config = readConfig();
  } catch (err) {
    config = null;
    showSettingsError(err.message.replace('Invalid config:', 'Fix these settings:'));
    startBtn.disabled = true;
    return;
  }
  showSettingsError('');
  const c = trialCounts(config.nTrials, config);
  $('mix-note').textContent = `${c.good} happy moles, ${c.bad} distractors, ${c.both} happy + distractor.`;
  $('run-length').textContent =
    `Run length ${(runDurationMs(config) / 60000).toFixed(1)} minutes (${config.nTrials} trials every ` +
    `${config.trialMs} ms, plus a ${config.firstOnsetMs} ms lead-in). ${LAYOUTS[config.layout].label}.`;
  if (!(shown && !shown.finished)) mirrorIdle(link.state());
  link.setConfig(config);
  renderLinkState(link.state());
}

form.addEventListener('input', syncSettings);
form.addEventListener('submit', (e) => e.preventDefault());

/* ---------- mirror of the participant display ---------- */

function mirrorIdle(st) {
  const c = config || resolveConfig({});
  renderBoard(holesEl, c, SKINS[c.skin] || moleSkin);
  renderKeycaps(capsEl, c);
  if (!st.connected) {
    ovTitle.textContent = 'Not connected';
    ovBody.innerHTML = '<p>Open the participant display to start.</p>';
  } else if (st.phase === 'ended') {
    ovTitle.textContent = 'Run finished';
    ovBody.innerHTML = '<p>The display is thanking the participant. Change a setting or start again for the next run.</p>';
  } else {
    ovTitle.textContent = 'Ready';
    ovBody.innerHTML = '<p>The display is showing the instructions and waiting for the start signal.</p>';
  }
  overlay.hidden = false;
}

/* ---------- the run on screen ----------
   `shown` is the run whose results are on this page: live while it runs,
   then the finished copy from the display. It stays until a new run starts,
   however the last one ended (time ran out, End run, or Esc). */

function freshRun(runId, runConfig) {
  return {
    runId, config: runConfig, trials: new Map(), events: [], finished: false, created: null, exports: null,
  };
}

function beginRun(runId) {
  // Prefer the settings the display is actually running with.
  const runConfig = link.state().config || config;
  shown = freshRun(runId, runConfig);
  renderBoard(holesEl, runConfig, SKINS[runConfig.skin] || moleSkin);
  renderKeycaps(capsEl, runConfig);
  overlay.hidden = true;
  logEl.replaceChildren();
  exportBox.value = '';
  $('run-summary').textContent = '';
  for (const id of ['dl-csv', 'dl-tsv', 'dl-json', 'copy']) $(id).disabled = true;
  copyStatus.textContent = '';
  cursorEl.setAttribute('visibility', 'visible');
  updateMeasures();
  redrawTrace();
}

function onEvent(record, trial, runId) {
  // A different run: start fresh. Stray messages for a run already finished are ignored.
  if (!shown || shown.runId !== runId) beginRun(runId);
  if (shown.finished) return;
  shown.events.push(record);
  const ev = record.event;
  if (ev === 'target_on') {
    setStimulus(holesEl, record.hole - 1, record.stim);
    setTarget(holesEl, record.hole - 1, 1);
  } else if (MOLE_DOWN.has(ev)) {
    setTarget(holesEl, record.hole - 1, 0);
    setStimulus(holesEl, record.hole - 1, '');
  } else if (ev === 'trial_end') {
    shown.trials.set(trial.trial, trial);
    redrawTrace();
  }
  updateMeasures();
  if (ev === 'volume' && record.simulated) {
    moveCursor(cursorEl, record.t_ms, shown.config.durationS);
    return;
  }
  if (ev !== 'trial_end') appendLogRow(record);
}

function onRun(run) {
  // The authoritative copy of the run: rebuild everything from it.
  if (!shown || shown.runId !== run.runId) {
    beginRun(run.runId);          // e.g. this console was reloaded after the run
    for (const e of run.events) if (!(e.event === 'volume' && e.simulated) && e.event !== 'trial_end') appendLogRow(e);
  }
  shown.config = run.config;
  shown.trials = new Map(run.trials.filter((t) => t.outcome).map((t) => [t.trial, t]));
  shown.events = run.events;
  shown.finished = true;
  shown.created = new Date(run.created);
  shown.exports = {
    csv: buildRunCSV(run.trials),
    tsv: buildEventsTSV(run.trials),
    json: buildFullLogJSON(run),
  };
  shown.run = run;
  $('run-summary').textContent = `${runSummaryText(run)} (${shown.created.toLocaleTimeString()})`;
  updateMeasures();
  redrawTrace();
  const end = run.events.at(-1);
  if (end) moveCursor(cursorEl, end.t_ms, run.config.durationS);
  showExport();
  for (const id of ['dl-csv', 'dl-tsv', 'dl-json', 'copy']) $(id).disabled = false;
  mirrorIdle({ ...link.state(), phase: 'ended' });
}

/* ---------- measures ---------- */

function updateMeasures() {
  if (!shown) return;
  const s = summarize([...shown.trials.values()]);
  const c = eventCounts(shown.events);
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
  $('m-hit').textContent = `${s.hits} / ${s.goodShown}`;
  $('m-hitrate').textContent = pct(s.hits, s.goodShown);
  $('m-com').textContent = `${s.com} / ${s.badShown}`;
  $('m-both').textContent = `${s.bothRight} / ${s.bothShown}`;
  $('m-wrong').textContent = c.wrongColumn;
  $('m-early').textContent = c.noMole;
  $('m-hidden').textContent = c.hidden ? `${c.hidden} time(s)` : 'no';
  $('m-pauses').textContent = c.pauses ? `${c.pauses} (${(c.pausedMs / 1000).toFixed(1)} s)` : 'none';
  $('m-rt').textContent = s.rts.length ? `${Math.round(s.meanRt)} ms` : '–';
  $('m-cv').textContent = s.rts.length > 1 ? s.cv.toFixed(2) : '–';
}

function redrawTrace() {
  if (!shown) return;
  drawTrace(chartData, shown.config, [...shown.trials.values()].sort((a, b) => a.trial - b.trial));
}

function appendLogRow(record) {
  const detail = [];
  if (record.trial) detail.push(`trial ${record.trial}${record.type ? ` (${record.type})` : ''}`);
  if (record.valence) detail.push(`${record.valence} mole, row ${record.row}, col ${record.col}`);
  if (record.pressed_button != null) detail.push(`pressed ${record.pressed_button}`);
  if (record.up_buttons) detail.push(`moles in column ${record.up_buttons.join(' and ')}`);
  if (record.rt_ms != null) detail.push(`${Math.round(record.rt_ms)} ms`);
  if (record.lag_ms != null && record.lag_ms > 20) detail.push(`late by ${Math.round(record.lag_ms)} ms`);
  if (record.reason) detail.push(record.reason);
  if (record.event === 'volume') detail.push(`pulse ${record.volume}`);
  const li = document.createElement('li');
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = `${(record.t_ms / 1000).toFixed(2)} s`;
  const ev = document.createElement('span');
  ev.className = `ev ev-${record.event}`;
  ev.textContent = LABEL[record.event] || record.event;
  const d = document.createElement('span');
  d.textContent = detail.join(', ');
  li.append(t, ev, d);
  logEl.prepend(li);
  while (logEl.children.length > 80) logEl.lastChild.remove();
}

/* ---------- exports ---------- */

function showExport() {
  if (!shown || !shown.exports) return;
  exportBox.value = shown.exports[exportMode];
  for (const m of ['csv', 'tsv', 'json']) $(`fmt-${m}`).setAttribute('aria-pressed', String(exportMode === m));
}

for (const m of ['csv', 'tsv', 'json']) {
  $(`fmt-${m}`).addEventListener('click', () => { exportMode = m; showExport(); });
}
const MIME = { csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json' };
const KIND = { csv: 'run', tsv: 'events', json: 'log' };
for (const m of ['csv', 'tsv', 'json']) {
  $(`dl-${m}`).addEventListener('click', () => {
    if (!shown || !shown.exports) return;
    downloadText(exportFilename(shown.run.config, KIND[m], shown.created), shown.exports[m], MIME[m]);
  });
}
copyBtn.addEventListener('click', async () => {
  exportBox.focus();
  exportBox.select();
  let ok = false;
  try { await navigator.clipboard.writeText(exportBox.value); ok = true; } catch (_) {
    try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
  }
  copyStatus.textContent = ok ? 'Copied.' : 'Copying is blocked here. The text is selected, so press Ctrl+C or ⌘C.';
});

/* ---------- start ---------- */

syncSettings();
// Find any display already open, and recover its last run if this tab was reloaded.
link.hello();
// Everything loaded: hide the "code has not loaded" warning.
$('load-check').hidden = true;
