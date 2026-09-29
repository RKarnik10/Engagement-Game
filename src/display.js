/**
 * Participant display page: draws the moles, owns the clock, and takes the
 * participant's (and the scanner's) key presses. Controlled by the
 * experimenter console in another tab through session.js and link.js.
 */

import { CHANNEL, newDisplayId } from './link.js';
import { createDisplaySession } from './session.js';
import { interpretKey } from './input.js';
import {
  renderBoard, renderKeycaps, setTarget, setStimulus, rampVisibility, keysDescription,
} from './render/board.js';
import { moleSkin } from './render/skin-mole.js';
import { drawTrace } from './render/trace.js';
import { runSummaryText } from './summary.js';
import {
  buildRunCSV, buildEventsTSV, buildFullLogJSON, exportFilename, downloadText,
} from './export.js';

const SKINS = { mole: moleSkin };

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const holesEl = $('holes');
const capsEl = $('keycaps');
const overlay = $('overlay');
const ovTitle = $('ov-title');
const ovBody = $('ov-body');
const hint = $('hint');
const results = $('results');
const HINT_HTML = hint.innerHTML;

let config = null;
let finishedRun = null;

function showOverlay(title, html) {
  ovTitle.textContent = title;
  ovBody.innerHTML = html;
  overlay.hidden = false;
}

const view = {
  idle(c) {
    config = c;
    const skin = SKINS[c.skin] || moleSkin;
    renderBoard(holesEl, c, skin);
    renderKeycaps(capsEl, c);
    showOverlay('Ready', `<p>${skin.instructions(keysDescription(c), c)}</p><p>Please wait for the task to start.</p>`);
    results.hidden = true;
    hint.innerHTML = HINT_HTML;
    hint.hidden = false;
  },
  running() {
    overlay.hidden = true;
    results.hidden = true;
    hint.hidden = true;
    stage.focus({ preventScroll: true });
  },
  paused(on) {
    if (on) showOverlay('Paused', '<p>Press <kbd>P</kbd> to continue, or <kbd>Esc</kbd> to end the run.</p>');
    else overlay.hidden = true;
  },
  frame({ active, elapsedMs }) {
    if (!active || config.onset !== 'gradual') return;
    const p = rampVisibility(elapsedMs, active.windowMs, config);
    for (const t of active.targets) if (!t.outcome) setTarget(holesEl, t.hole, p);
  },
  moleUp(hole, stim) {
    setStimulus(holesEl, hole, stim);
    setTarget(holesEl, hole, config.onset === 'gradual' ? 0 : 1);
  },
  moleDown(hole) {
    setTarget(holesEl, hole, 0);
    setStimulus(holesEl, hole, '');
  },
  ended(reason, run) {
    finishedRun = run;
    if (run && run.config.showResultsOnDisplay) {
      // Testing only: results and downloads on this screen as well.
      overlay.hidden = true;
      $('results-title').textContent = reason === 'completed' ? 'Run finished' : 'Run ended early';
      $('results-summary').textContent = runSummaryText(run);
      drawTrace($('chart-data'), run.config, run.trials.filter((t) => t.outcome));
      results.hidden = false;
      hint.hidden = true;
      return;
    }
    // DECIDED(Q6): no feedback, so no score or summary for the participant.
    showOverlay('Finished', '<p>Thank you. Please stay still; the experimenter will be with you shortly.</p>');
    hint.textContent = 'Results, the reaction-time trace, and the downloads are in the experimenter console tab.';
    hint.hidden = false;
  },
  error(message) {
    showOverlay('Settings problem', '');
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = message;
    ovBody.appendChild(p);
  },
};

const session = createDisplaySession({
  channel: new BroadcastChannel(CHANNEL),
  displayId: newDisplayId(),
  view,
  userAgent: navigator.userAgent,
});

/* ---------- full screen ---------- */

function toggleFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    return;
  }
  // Safari before 16.4 only has the webkit-prefixed version.
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (request) Promise.resolve(request.call(el)).catch(() => {});
}

/* ---------- input ---------- */

document.addEventListener('keydown', (e) => {
  const running = session.isRunning();
  const action = interpretKey(
    { key: e.key, repeat: e.repeat, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, typing: false },
    config, running,
  );
  if (!action) {
    const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (!running && (e.key === 'f' || e.key === 'F') && plain) toggleFullscreen();
    // Testing only: P pauses and resumes. Presses are ignored while paused.
    if (running && (e.key === 'p' || e.key === 'P') && plain && !e.repeat) session.togglePause();
    return;
  }
  if (action.preventDefault) e.preventDefault();
  if (action.action === 'trigger' || action.action === 'pulse') session.trigger(action.source);
  else if (action.action === 'press') session.press(action.button, action.source);
  else if (action.action === 'stop') session.stop();
});

holesEl.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.hole');
  if (!h || !session.isRunning()) return;
  e.preventDefault();
  session.press(Number(h.dataset.btn), 'pointer');
});

/* ---------- downloads (testing results panel) ---------- */

const KIND = { csv: 'run', tsv: 'events', json: 'log' };
const MIME = { csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json' };
const BUILD = { csv: (r) => buildRunCSV(r.trials), tsv: (r) => buildEventsTSV(r.trials), json: (r) => buildFullLogJSON(r) };
for (const m of ['csv', 'tsv', 'json']) {
  $(`dl-${m}`).addEventListener('click', () => {
    if (!finishedRun) return;
    downloadText(exportFilename(finishedRun.config, KIND[m], new Date(finishedRun.created)), BUILD[m](finishedRun), MIME[m]);
  });
}

// Everything loaded: hide the "code has not loaded" warning.
$('load-check').hidden = true;

// A hidden tab stops drawing, so timing breaks. Log it so the data shows it.
document.addEventListener('visibilitychange', () => session.visibility(document.hidden));
window.addEventListener('pagehide', () => session.bye());
