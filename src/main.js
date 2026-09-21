/**
 * Page wiring: config <- form, schedule -> engine -> logger, input -> engine,
 * engine events -> renderer, and exports as downloads.
 *
 * Nothing here decides an outcome or a schedule; it only connects modules.
 */

import { resolveConfig, runDurationMs, LAYOUTS } from './config.js';
import { buildSchedule } from './schedule.js';
import { createEngine } from './engine.js';
import { createLogger } from './logger.js';
import { attachInput } from './input.js';
import {
  buildRunCSV, buildEventsTSV, buildFullLogJSON, exportFilename, downloadText,
} from './export.js';
import {
  renderBoard, renderKeycaps, setTarget, setStimulus, rampVisibility, keysDescription,
} from './render/board.js';
import { moleSkin } from './render/skin-mole.js';
import { drawTrace, moveCursor, mean, sdev } from './render/trace.js';

/** Skin registry. Adding a neutral skin means adding one entry here. */
const SKINS = { mole: moleSkin };

const $ = (id) => document.getElementById(id);
const form = $('settings');
const holesEl = $('holes');
const capsEl = $('keycaps');
const overlay = $('overlay');
const ovTitle = $('ov-title');
const ovBody = $('ov-body');
const hudScore = $('hud-score');
const hudTime = $('hud-time');
const startBtn = $('start');
const stopBtn = $('stop');
const logEl = $('log');
const exportBox = $('export');
const chartData = $('chart-data');
const cursorEl = $('cursor');
const copyBtn = $('copy');
const copyStatus = $('copy-status');
const stage = $('stage');

const LABEL = {
  trigger: 'Trigger', volume: 'Trigger pulse', target_on: 'Mole up', hit: 'Hit', omission: 'Missed',
  commission: 'Pressed on skip', correct_rejection: 'Correct skip', wrong_hole: 'Wrong column',
  no_target_press: 'Press, no mole', truncated: 'Cut off', run_end: 'Run end',
};
const STIM_SHORT = { mole_happy: 'happy mole', mole_sad: 'sad mole', molerat: 'molerat' };
const TRIAL_END = new Set(['hit', 'commission', 'omission', 'correct_rejection', 'truncated']);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let run = null;
let idleConfig = null;
let exportMode = 'csv';

const isRunning = () => !!(run && run.engine.getState().running);

/* ---------- config from the console form ---------- */

function readConfig() {
  const f = new FormData(form);
  const num = (k, d) => { const v = parseFloat(f.get(k)); return Number.isFinite(v) ? v : d; };
  return resolveConfig({
    setting: f.get('setting') || 'behavioral',
    layout: f.get('layout') || 'grid3x3',
    onset: f.get('onset') || 'instant',
    goProb: clamp(num('goProb', 80), 50, 95) / 100,
    nTrials: Math.round(clamp(num('nTrials', 600), 10, 3000)),
    trialMs: Math.round(clamp(num('trialMs', 1000), 400, 4000)),
    holdMs: Math.round(clamp(num('holdMs', 800), 200, 3500)),
    trS: clamp(num('tr', 1), 0.3, 5),
    seed: Math.trunc(num('seed', 1234)),
  });
}

function showError(err) {
  ovTitle.textContent = 'Settings problem';
  ovBody.replaceChildren();
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = err && err.message ? err.message : String(err);
  ovBody.appendChild(p);
  overlay.hidden = false;
}

function setFormDisabled(v) {
  form.querySelectorAll('input').forEach((el) => { el.disabled = v; });
}

/* ---------- run lifecycle ---------- */

function startRun(source) {
  if (isRunning()) return;
  let config;
  try { config = readConfig(); } catch (err) { showError(err); return; }
  const skin = SKINS[config.skin];
  if (!skin) { showError(new Error(`The "${config.skin}" look is not built.`)); return; }

  renderBoard(holesEl, config, skin);
  renderKeycaps(capsEl, config);
  const trials = buildSchedule(config);
  const logger = createLogger();
  const engine = createEngine({ config, trials, logger, onFrame, onEvent });
  run = { config, skin, trials, logger, engine, created: null, exports: null };

  logEl.replaceChildren();
  exportBox.value = '';
  copyBtn.disabled = true;
  for (const id of ['dl-csv', 'dl-tsv', 'dl-json']) $(id).disabled = true;
  copyStatus.textContent = '';
  setFormDisabled(true);
  startBtn.disabled = true;
  stopBtn.disabled = false;
  overlay.hidden = true;
  hudScore.hidden = !config.showScore;
  cursorEl.setAttribute('visibility', 'visible');
  updateMeasures();
  redrawTrace();
  stage.focus({ preventScroll: true });

  engine.start({ source });
}

/** Called by the engine on every animation frame: draw what is up. */
function onFrame({ tMs, active, elapsedMs }) {
  const { config } = run;
  if (active) setTarget(holesEl, active.hole, rampVisibility(elapsedMs, active.windowMs, config));
  hudTime.textContent = `${Math.max(0, Math.ceil(config.durationS - tMs / 1000))} s`;
  moveCursor(cursorEl, tMs, config.durationS);
}

/**
 * Called by the engine after each logged event.
 * The participant display never reacts to a press: only `target_on` and the
 * trial-ending outcomes change what is drawn.
 */
function onEvent(record, trial) {
  const ev = record.event;
  if (ev === 'target_on') {
    setStimulus(holesEl, trial.hole, trial.stim);
  } else if (TRIAL_END.has(ev)) {
    setTarget(holesEl, trial.hole, 0);
    setStimulus(holesEl, trial.hole, '');
    updateMeasures();
    redrawTrace();
  } else if (ev === 'wrong_hole' || ev === 'no_target_press') {
    updateMeasures();
  } else if (ev === 'run_end') {
    finishRun(record);
  }
  if (!(ev === 'volume' && record.simulated)) appendLogRow(record);
}

function finishRun(record) {
  const { engine, config, logger } = run;
  const state = engine.getState();
  setFormDisabled(false);
  startBtn.disabled = false;
  stopBtn.disabled = true;

  run.created = new Date();
  run.exports = {
    csv: buildRunCSV(engine.trials()),
    tsv: buildEventsTSV(engine.trials()),
    json: buildFullLogJSON({
      config,
      trials: engine.trials(),
      events: logger.toArray(),
      frameStats: engine.frameStats(),
      userAgent: navigator.userAgent,
      created: run.created.toISOString(),
    }),
  };

  const s = summarize(engine.trials());
  ovTitle.textContent = record.reason === 'completed' ? 'Run finished' : 'Run ended early';
  ovBody.innerHTML =
    `<p>${s.hits} of ${s.hits + s.om} happy moles hit, ${s.com} presses on ${s.com + s.cr} skip trials` +
    (s.rts.length ? `, mean reaction time ${Math.round(s.m)} ms.` : '.') + '</p>' +
    '<p>The attention trace and the run table are below. Press <kbd>T</kbd> or select Start run to play again.</p>';
  overlay.hidden = false;

  updateMeasures();
  redrawTrace();
  moveCursor(cursorEl, state.endedMs, config.durationS);
  showExport();
  copyBtn.disabled = false;
  for (const id of ['dl-csv', 'dl-tsv', 'dl-json']) $(id).disabled = false;
}

/* ---------- experimenter view ---------- */

function summarize(trials) {
  const done = trials.filter((x) => x.outcome && x.outcome !== 'truncated');
  const c = (o) => done.filter((x) => x.outcome === o).length;
  const rts = done.filter((x) => x.outcome === 'hit').map((x) => x.rtMs);
  return { hits: c('hit'), om: c('omission'), com: c('commission'), cr: c('correct_rejection'), rts, m: mean(rts), s: sdev(rts) };
}

function updateMeasures() {
  if (!run) return;
  const s = summarize(run.engine.trials());
  const counts = run.engine.getState().counts;
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
  $('m-hit').textContent = `${s.hits} / ${s.hits + s.om}`;
  $('m-hitrate').textContent = pct(s.hits, s.hits + s.om);
  $('m-com').textContent = `${s.com} / ${s.com + s.cr}`;
  $('m-wrong').textContent = counts.wrong_hole;
  $('m-early').textContent = counts.no_target_press;
  $('m-rt').textContent = s.rts.length ? `${Math.round(s.m)} ms` : '–';
  $('m-cv').textContent = s.rts.length > 1 ? (s.s / s.m).toFixed(2) : '–';
}

function redrawTrace() {
  if (!run) return;
  drawTrace(chartData, run.config, run.engine.trials());
}

function appendLogRow(record) {
  const detail = [];
  if (record.trial) detail.push(`trial ${record.trial}`);
  if (record.row != null) detail.push(`row ${record.row}, col ${record.col}`);
  if (record.stim) detail.push(STIM_SHORT[record.stim] || record.stim);
  if (record.expected_button != null) detail.push(`expect ${record.expected_button}`);
  if (record.pressed_button != null) detail.push(`pressed ${record.pressed_button}`);
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
  if (!run || !run.exports) return;
  exportBox.value = run.exports[exportMode];
  for (const m of ['csv', 'tsv', 'json']) {
    $(`fmt-${m}`).setAttribute('aria-pressed', String(exportMode === m));
  }
}

for (const m of ['csv', 'tsv', 'json']) {
  $(`fmt-${m}`).addEventListener('click', () => { exportMode = m; showExport(); });
}
const MIME = { csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json' };
const KIND = { csv: 'run', tsv: 'events', json: 'log' };
for (const m of ['csv', 'tsv', 'json']) {
  $(`dl-${m}`).addEventListener('click', () => {
    if (!run || !run.exports) return;
    downloadText(exportFilename(run.config, KIND[m], run.created), run.exports[m], MIME[m]);
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

/* ---------- participant display ---------- */

$('participant-view').addEventListener('click', () => {
  document.body.classList.add('participant-view');
  if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
  stage.focus({ preventScroll: true });
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('participant-view');
});

/* ---------- idle state and controls ---------- */

function setIdleOverlay(config, skin) {
  ovTitle.textContent = 'Ready';
  ovBody.innerHTML =
    `<p>${skin.instructions(keysDescription(config))}</p>` +
    `<p>Press <kbd>${config.triggerKey.toUpperCase()}</kbd> or select Start run. ` +
    `${config.triggerKey.toUpperCase()} stands in for the scanner’s trigger pulse, and every timestamp is measured from it.</p>`;
  overlay.hidden = false;
}

function syncIdle() {
  if (isRunning()) return;
  let config;
  try { config = readConfig(); } catch (err) { showError(err); return; }
  idleConfig = config;
  const nogo = Math.round(config.nTrials * (1 - config.goProb));
  const sad = Math.round(nogo * config.nogoSadShare);
  $('goProb-out').textContent = `${Math.round(config.goProb * 100)}%`;
  $('mix-note').textContent =
    `${config.nTrials - nogo} happy moles, ${sad} sad moles, ${nogo - sad} molerats.`;
  const mins = runDurationMs(config) / 60000;
  $('run-length').textContent =
    `Run length ${mins.toFixed(1)} minutes (${config.nTrials} trials every ${config.trialMs} ms, ` +
    `plus a ${config.firstOnsetMs} ms lead-in). ${LAYOUTS[config.layout].label}.`;
  const skin = SKINS[config.skin] || moleSkin;
  renderBoard(holesEl, config, skin);
  renderKeycaps(capsEl, config);
  setIdleOverlay(config, skin);
  hudScore.hidden = !config.showScore;
  hudTime.textContent = `${Math.round(config.durationS)} s`;
}

form.addEventListener('input', syncIdle);
form.addEventListener('submit', (e) => e.preventDefault());
startBtn.addEventListener('click', () => startRun('button'));
stopBtn.addEventListener('click', () => { if (isRunning()) run.engine.stop('stopped'); });

attachInput({
  holesEl,
  getConfig: () => (isRunning() ? run.config : idleConfig) || resolveConfig({}),
  isRunning,
  onAction: (a) => {
    if (a.action === 'trigger') startRun(a.source);
    else if (!isRunning()) return;
    else if (a.action === 'press') run.engine.press(a.button, a.source);
    else if (a.action === 'pulse') run.engine.pulse(a.source);
    else if (a.action === 'stop') run.engine.stop('stopped');
  },
});

syncIdle();
