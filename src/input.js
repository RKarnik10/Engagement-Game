/**
 * Keyboard and pointer input -> hole index; trigger detection (README 4.2).
 *
 * `interpretKey` is pure and unit-tested. `attachInput` wires it to the DOM.
 * Actions returned:
 *   { action: 'trigger', source }          idle: the trigger key starts a run
 *   { action: 'press', hole, source }      running: a mapped hole key
 *   { action: 'pulse', source }            running: a further trigger pulse
 *   { action: 'stop' }                     running: Escape ends the run early
 *   null                                   ignore
 *
 * Held keys (e.repeat) are ignored (README 3.3).
 */

function isTriggerKey(key, triggerKey) {
  return typeof key === 'string' && key.toLowerCase() === triggerKey.toLowerCase();
}

/**
 * @param {{key: string, repeat?: boolean, metaKey?: boolean, ctrlKey?: boolean,
 *          altKey?: boolean, typing?: boolean}} evt
 *        `typing` is true when the event target is a text field.
 * @param {object} config   Resolved config (keys, triggerKey).
 * @param {boolean} running
 */
export function interpretKey(evt, config, running) {
  const modifier = !!(evt.metaKey || evt.ctrlKey || evt.altKey);
  if (!running) {
    if (!evt.typing && !modifier && isTriggerKey(evt.key, config.triggerKey)) {
      return { action: 'trigger', source: `key ${evt.key}`, preventDefault: true };
    }
    return null;
  }
  if (evt.key === 'Escape') return { action: 'stop', preventDefault: false };
  if (evt.repeat) return null;
  if (isTriggerKey(evt.key, config.triggerKey)) {
    return { action: 'pulse', source: `key ${evt.key}`, preventDefault: true };
  }
  const hole = config.keys.indexOf(evt.key);
  if (hole < 0) return null;
  return { action: 'press', hole, source: `key ${evt.key}`, preventDefault: true };
}

/**
 * Bind keyboard and pointer listeners.
 * @param {object} opts
 * @param {EventTarget} [opts.target]   Keyboard target; default document.
 * @param {Element} opts.holesEl        Board container; each hole has data-i.
 * @param {() => object} opts.getConfig
 * @param {() => boolean} opts.isRunning
 * @param {(action: object) => void} opts.onAction
 * @returns {() => void} detach
 */
export function attachInput({ target = document, holesEl, getConfig, isRunning, onAction }) {
  const onKey = (e) => {
    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const action = interpretKey(
      { key: e.key, repeat: e.repeat, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, typing },
      getConfig(), isRunning(),
    );
    if (!action) return;
    if (action.preventDefault) e.preventDefault();
    onAction(action);
  };
  const onPointer = (e) => {
    const h = e.target.closest ? e.target.closest('.hole') : null;
    if (!h || !isRunning()) return;
    e.preventDefault();
    onAction({ action: 'press', hole: Number(h.dataset.i), source: 'pointer' });
  };
  target.addEventListener('keydown', onKey);
  holesEl.addEventListener('pointerdown', onPointer);
  return () => {
    target.removeEventListener('keydown', onKey);
    holesEl.removeEventListener('pointerdown', onPointer);
  };
}
