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

const SKINS = { mole: moleSkin };

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const holesEl = $('holes');
const capsEl = $('keycaps');
const overlay = $('overlay');
const ovTitle = $('ov-title');
const ovBody = $('ov-body');
const hint = $('hint');

let config = null;

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
    hint.hidden = false;
  },
  running() {
    overlay.hidden = true;
    hint.hidden = true;
    stage.focus({ preventScroll: true });
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
  ended() {
    // DECIDED(Q6): no feedback, so no score or summary for the participant.
    showOverlay('Finished', '<p>Thank you. Please stay still; the experimenter will be with you shortly.</p>');
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
    if (!running && (e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) toggleFullscreen();
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

// Everything loaded: hide the "code has not loaded" warning.
$('load-check').hidden = true;

// A hidden tab stops drawing, so timing breaks. Log it so the data shows it.
document.addEventListener('visibilitychange', () => session.visibility(document.hidden));
window.addEventListener('pagehide', () => session.bye());
