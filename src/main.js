/**
 * Page wiring: config <- form, schedule -> engine -> logger, input -> engine,
 * engine events -> renderer, and exports as downloads.
 *
 * Nothing here decides an outcome or a schedule; it only connects modules.
 */

import { resolveConfig } from './config.js';
import { buildSchedule } from './schedule.js';
import { createEngine } from './engine.js';
import { createLogger } from './logger.js';
import { attachInput } from './input.js';
import { buildEventsTSV, buildFullLogJSON, exportFilename, downloadText } from './export.js';
import { renderBoard, setTarget, setTargetType, flash, rampVisibility, keysDescription } from './render/board.js';
import { moleSkin } from './render/skin-mole.js';
import { drawTrace, moveCursor, mean, sdev } from './render/trace.js';

/** Skin registry. Phase 2: add the neutral skin here; nothing else changes. */
const SKINS = { mole: moleSkin };

const $ = (id) => document.getElementById(id);
const form = $('settings');
const holesEl = $('holes');
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
const dlTsv = $('dl-tsv');
const dlJson = $('dl-json');
const copyBtn = $('copy');
const copyStatus = $('copy-status');
const stage = $('stage');

const LABEL = {
  trigger: 'Trigger', volume: 'Trigger pulse', target_on: 'Target up', hit: 'Hit', omission: 'Missed',
  commission: 'False press', correct_rejection: 'Correct skip', wrong_hole: 'Wrong hole',
  no_target_press: 'Press, no target', truncated: 'Cut off', run_end: 'Run end',
};
const TRIAL_END = new Set(['hit', 'commission', 'omission', 'correct_rejection', 'truncated']);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let run = null;          // { config, skin, trials, logger, engine, created, exports }
let idleConfig = null;   // config read from the form while idle (for the trigger key)
let exportMode = 'tsv';

const isRunning = () => !!(run && run.engine.getState().running);

/* ---------- config from the console form ---------- */

function readConfig() {
  const f = new FormData(form);
  const num = (k, d) => { const v = parseFloat(f.get(k)); return Number.isFinite(v) ? v : d; };
  let lo = num('isiMin', 500);
  let hi = num('isiMax', 1200);
  if (hi < lo) [lo, hi] = [hi, lo];
  return resolveConfig({
    skin: f.get('skin') || 'mole',
    layout: f.get('layout') || 'row4',
    onset: f.get('onset') || 'instant',
    goProb: clamp(num('goProb', 80), 60, 95) / 100,
    holdMs: Math.round(clamp(num('holdMs', 900), 300, 3000)),
    isiMinMs: Math.round(clamp(lo, 100, 5000)),
    isiMaxMs: Math.round(clamp(hi, 100, 5000)),
    durationS: clamp(num('duration', 60), 15, 600),
    trS: clamp(num('tr', 1), 0.3, 5),
    showScore: f.get('showScore') === 'on',
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
  form.querySelectorAll('input').forEach((el) => { if (!el.hasAttribute('data-locked')) el.disabled = v; });
}

/* ---------- run lifecycle ---------- */

function startRun(source) {
  if (isRunning()) return;
  let config;
  try { config = readConfig(); } catch (err) { showError(err); return; }
  const skin = SKINS[config.skin];
  if (!skin) { showError(new Error(`The "${config.skin}" look is not built yet.`)); return; }

  renderBoard(holesEl, config, skin);
  const trials = buildSchedule(config);
  const logger = createLogger();
  const engine = createEngine({ config, trials, logger, onFrame, onEvent });
  run = { config, skin, trials, logger, engine, created: null, exports: null };

  logEl.replaceChildren();
  exportBox.value = '';
  copyBtn.disabled = true;
  dlTsv.disabled = true;
  dlJson.disabled = true;
  copyStatus.textContent = '';
  setFormDisabled(true);
  startBtn.disabled = true;
  stopBtn.disabled = false;
  overlay.hidden = true;
  hudScore.hidden = !config.showScore; // TODO(Q6)
  hudScore.textContent = 'Score 0';
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

/** Called by the engine after each logged event. */
function onEvent(record, trial) {
  const ev = record.event;
  if (ev === 'target_on') {
    setTargetType(holesEl, trial.hole, trial.type);
  } else if (TRIAL_END.has(ev)) {
    setTarget(holesEl, trial.hole, 0);
    if (ev === 'hit') flash(holesEl, trial.hole, 'hit');
    if (ev === 'commission') flash(holesEl, trial.hole, 'commission');
    hudScore.textContent = `Score ${run.engine.getState().score}`;
    updateMeasures();
    redrawTrace();
  } else if (ev === 'wrong_hole') {
    flash(holesEl, record.hole - 1, 'wrong');
    updateMeasures();
  } else if (ev === 'no_target_press') {
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
    tsv: buildEventsTSV(engine.trials(), config.keys),
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
    `<p>${s.hits} of ${s.hits + s.om} go targets hit, ${s.com} false presses on ${s.com + s.cr} no-go targets` +
    (s.rts.length ? `, mean reaction time ${Math.round(s.m)} ms.` : '.') + '</p>' +
    '<p>The attention trace and full data are below. Press <kbd>T</kbd> or select Start run to play again.</p>';
  overlay.hidden = false;

  updateMeasures();
  redrawTrace();
  moveCursor(cursorEl, state.endedMs, config.durationS);
  showExport();
  copyBtn.disabled = false;
  dlTsv.disabled = false;
  dlJson.disabled = false;
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
  if (record.hole != null) detail.push(`hole ${record.hole}`);
  if (record.type) detail.push(record.type === 'go' ? 'go' : 'no-go');
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
  exportBox.value = exportMode === 'tsv' ? run.exports.tsv : run.exports.json;
  $('fmt-tsv').setAttribute('aria-pressed', String(exportMode === 'tsv'));
  $('fmt-json').setAttribute('aria-pressed', String(exportMode === 'json'));
}

$('fmt-tsv').addEventListener('click', () => { exportMode = 'tsv'; showExport(); });
$('fmt-json').addEventListener('click', () => { exportMode = 'json'; showExport(); });
dlTsv.addEventListener('click', () => {
  if (!run || !run.exports) return;
  downloadText(exportFilename(run.config, 'events', run.created), run.exports.tsv, 'text/tab-separated-values');
});
dlJson.addEventListener('click', () => {
  if (!run || !run.exports) return;
  downloadText(exportFilename(run.config, 'log', run.created), run.exports.json, 'application/json');
});
copyBtn.addEventListener('click', async () => {
  exportBox.focus();
  exportBox.select();
  let ok = false;
  try { await navigator.clipboard.writeText(exportBox.value); ok = true; } catch (_) {
    try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
  }
  copyStatus.textContent = ok ? 'Copied.' : 'Copying is blocked here. The text is selected, so press Ctrl+C or ⌘C.';
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
  $('goProb-out').textContent = `${Math.round(config.goProb * 100)}%`;
  const skin = SKINS[config.skin] || moleSkin;
  renderBoard(holesEl, config, skin);
  setIdleOverlay(config, skin);
  hudScore.hidden = !config.showScore;
  hudTime.textContent = `${config.durationS} s`;
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
    else if (a.action === 'press') run.engine.press(a.hole, a.source);
    else if (a.action === 'pulse') run.engine.pulse(a.source);
    else if (a.action === 'stop') run.engine.stop('stopped');
  },
});

syncIdle();
