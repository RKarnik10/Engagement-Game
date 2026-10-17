/**
 * A tiny fake browser page, just enough to run src/main.js and src/display.js
 * in Node. Not a browser: no layout, no drawing, no real audio. Each page
 * runs in its own worker thread, like its own tab; BroadcastChannel (built
 * into Node) connects them.
 */
const mkClassList = () => {
  const s = new Set();
  return {
    add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)),
    contains: (c) => s.has(c), toggle: (c, on) => { const v = on ?? !s.has(c); if (v) s.add(c); else s.delete(c); return v; },
  };
};

export function installDom({ formInputs = [], search = '', href = 'http://localhost:8000/' } = {}) {
  class El {
    constructor(tag, id) {
      Object.assign(this, {
        tagName: tag.toUpperCase(), id: id || '', attrs: {}, dataset: {}, classList: mkClassList(), childNodes: [],
        hidden: false, disabled: false, value: '', textContent: '', _inner: '', listeners: {}, parent: null,
        className: '', offsetWidth: 100, href: '', download: '',
      });
      this.style = { props: {}, setProperty(k, v) { this.props[k] = String(v); } };
    }
    get innerHTML() { return this._inner; }
    set innerHTML(v) {
      this._inner = v; this.textContent = v.replace(/<[^>]*>/g, ''); this.childNodes = [];
      if (this.id === 'holes' || this.id === 'keycaps') {
        const pat = this.id === 'holes' ? /class="hole"/g : /class="keycap"/g;
        const btns = [...v.matchAll(/data-btn="(\d+)"/g)].map((m) => m[1]);
        const n = (v.match(pat) || []).length;
        for (let i = 0; i < n; i++) {
          const h = new El('div'); h.dataset.i = String(i); h.dataset.btn = btns[i];
          const g = new El('g'); h.querySelector = () => g; h.closest = () => h; h.parent = this;
          this.childNodes.push(h);
        }
      }
    }
    get children() { return this.childNodes; }
    get lastChild() { return this.childNodes.at(-1) || null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
    removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
    dispatch(t, e = {}) { for (const fn of (this.listeners[t] || []).slice()) fn(e); }
    append(...n) { for (const x of n) { x.parent = this; this.childNodes.push(x); } }
    appendChild(n) { this.append(n); return n; }
    prepend(n) { n.parent = this; this.childNodes.unshift(n); }
    replaceChildren(...n) { this.childNodes = []; this.append(...n); }
    remove() { if (this.parent) this.parent.childNodes = this.parent.childNodes.filter((x) => x !== this); }
    querySelectorAll() { return this.id === 'settings' ? formInputs : []; }
    focus() {} select() {}
    click() { this.dispatch('click', {}); }
  }
  const registry = new Map();
  const docListeners = {};
  const created = [];
  const make = (id) => {
    const el = new El(id === 'settings' ? 'form' : 'div', id);
    if (id === 'hint') el.innerHTML = 'Experimenter keys';
    return el;
  };
  globalThis.document = {
    getElementById: (id) => { if (!registry.has(id)) registry.set(id, make(id)); return registry.get(id); },
    createElement: (tag) => { const el = new El(tag); created.push(el); return el; },
    addEventListener: (t, fn) => (docListeners[t] ||= []).push(fn),
    body: new El('body'), documentElement: new El('html'), fullscreenElement: null, hidden: false,
    execCommand: () => true,
  };
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  const url = new URL(search, href);
  globalThis.location = { search: url.search, href: url.href, hostname: url.hostname };
  let clip = null;
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'fake page (tests/pages)', clipboard: { writeText: async (t) => { clip = t; } } },
    configurable: true,
  });
  globalThis.FormData = class {
    constructor() { this.m = new Map(formInputs.filter((i) => i.checked !== false).map((i) => [i.name, i.value])); }
    get(k) { return this.m.has(k) ? this.m.get(k) : null; }
  };
  // A fake sound system: records each tone as 'good' (sine) or 'bad' (square)
  // so tests can count which sounds played. No real audio.
  const tones = [];
  globalThis.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createGain() { const p = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; return { gain: p, connect: (x) => x }; }
    createOscillator() {
      const o = { type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect: (x) => x, stop() {}, start() { tones.push(o.type === 'square' ? 'bad' : 'good'); } };
      return o;
    }
  };
  globalThis.URL.createObjectURL = () => 'blob:fake';
  globalThis.URL.revokeObjectURL = () => {};
  const keydown = (key, extra = {}) => {
    for (const fn of docListeners.keydown || []) {
      fn({ key, repeat: false, metaKey: false, ctrlKey: false, altKey: false, target: { tagName: 'DIV' }, preventDefault() {}, ...extra });
    }
  };
  return { $: (id) => document.getElementById(id), keydown, created, clipboard: () => clip, tones };
}

/** A fake 60 Hz clock and animation-frame loop for a page. */
export function installClock() {
  const c = { now: 0, pending: null };
  Object.defineProperty(performance, 'now', { value: () => c.now, configurable: true });
  globalThis.requestAnimationFrame = (fn) => { c.pending = fn; return 1; };
  globalThis.cancelAnimationFrame = () => { c.pending = null; };
  c.frame = () => { c.now += 1000 / 60; const fn = c.pending; c.pending = null; if (fn) fn(); };
  return c;
}
