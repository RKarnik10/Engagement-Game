/**
 * Attention trace: a simplified variance time course (README 5) drawn as SVG
 * for the experimenter view. Only draws. The real measures are computed
 * offline in analysis/ (Phase 3).
 */

export const CH = Object.freeze({ W: 1000, L: 44, R: 14, base: 118, height: 100 });

export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
export const sdev = (a) => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
};
export const median = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};

/** Gaussian smoothing over trial index (not time). Edge-normalized. */
export function smooth(arr, sigma) {
  const n = arr.length;
  const out = new Array(n);
  const rad = Math.ceil(sigma * 3);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let w = 0;
    for (let k = -rad; k <= rad; k++) {
      const j = i + k;
      if (j < 0 || j >= n) continue;
      const g = Math.exp(-(k * k) / (2 * sigma * sigma));
      s += g * arr[j];
      w += g;
    }
    out[i] = s / w;
  }
  return out;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Map a time (ms) onto the chart's x axis. */
export function traceX(tMs, durationS) {
  const dur = durationS * 1000;
  return CH.L + (clamp(tMs, 0, dur) / dur) * (CH.W - CH.L - CH.R);
}

export function moveCursor(cursorEl, tMs, durationS) {
  const x = traceX(tMs, durationS).toFixed(1);
  cursorEl.setAttribute('x1', x);
  cursorEl.setAttribute('x2', x);
}

/**
 * Redraw the trace into an SVG group.
 * @param {Element} groupEl
 * @param {object} config   durationS, trS.
 * @param {Array}  trials   Engine trial records.
 */
export function drawTrace(groupEl, config, trials) {
  const dur = config.durationS * 1000;
  const x = (t) => traceX(t, config.durationS);
  let s = `<line class="axisline" x1="${CH.L}" x2="${CH.W - CH.R}" y1="${CH.base}" y2="${CH.base}"/>`;
  s += `<text class="axis" x="${CH.L}" y="11">Higher means less stable responding</text>`;

  const trMs = config.trS * 1000;
  for (let k = 0; k * trMs <= dur + 1; k++) {
    const xx = x(k * trMs).toFixed(1);
    s += `<line class="tr" x1="${xx}" x2="${xx}" y1="162" y2="${k % 10 === 0 ? 176 : 169}"/>`;
  }
  const stepS = config.durationS > 150 ? 30 : 10;
  for (let sec = 0; sec <= config.durationS; sec += stepS) {
    s += `<text class="axis" x="${x(sec * 1000).toFixed(1)}" y="194" text-anchor="middle">${sec} s</text>`;
  }

  for (const a of trials) {
    if (a.outcome === 'commission') {
      const xx = x(a.actualOnsetMs);
      s += `<path class="mk-com" d="M${(xx - 5).toFixed(1)} 150 L${(xx + 5).toFixed(1)} 150 L${xx.toFixed(1)} 140 Z"/>`;
    } else if (a.outcome === 'omission') {
      s += `<circle class="mk-om" cx="${x(a.actualOnsetMs).toFixed(1)}" cy="145" r="4.2"/>`;
    }
  }

  const hits = trials.filter((a) => a.outcome === 'hit');
  if (hits.length >= 3) {
    const rts = hits.map((a) => a.rtMs);
    const m = mean(rts);
    const sd = sdev(rts) || 1;
    const sm = smooth(rts.map((r) => Math.abs(r - m) / sd), 1.5);
    const top = Math.max(1.5, ...sm);
    const y = (v) => CH.base - (v / top) * CH.height;
    const med = y(median(sm)).toFixed(1);
    s += `<line class="median" x1="${CH.L}" x2="${CH.W - CH.R}" y1="${med}" y2="${med}"/>`;
    s += `<polyline class="vtc" points="${hits.map((a, j) => `${x(a.actualOnsetMs).toFixed(1)},${y(sm[j]).toFixed(1)}`).join(' ')}"/>`;
    hits.forEach((a, j) => {
      s += `<circle class="vtc-dot" cx="${x(a.actualOnsetMs).toFixed(1)}" cy="${y(sm[j]).toFixed(1)}" r="2.6"/>`;
    });
  } else {
    s += `<text class="axis" x="${(CH.W + CH.L) / 2}" y="72" text-anchor="middle">The trace appears after three hits.</text>`;
  }
  groupEl.innerHTML = s;
}
