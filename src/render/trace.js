/**
 * Attention trace: a simplified variance time course (README 5) drawn as SVG
 * for the experimenter view. Only draws. The real measures are computed
 * offline in analysis/ (Phase 3).
 *
 * WHAT THE CHART SHOWS
 *   x axis      time in seconds from the start pulse.
 *   black line  one dot per happy mole that was hit. Its height is how far
 *               that reaction time was from this run's average, smoothed over
 *               neighbouring hits. Higher = less steady responding.
 *   dashed line the median of the curve (the "in the zone / out of the zone"
 *               split of Esterman et al. 2013).
 *   red mark    a triangle where a sad mole was pressed, a ring where a happy
 *               mole was missed.
 *   yellow tick one per simulated scan volume (one per TR).
 *
 * HOW THE CURVE IS BUILT (drawTrace, steps 5 to 8)
 *   1. take the reaction time of every hit on a happy mole (goodRtMs);
 *   2. express each as |RT - mean| / SD, so "how unusual for this run";
 *   3. smooth that series with a Gaussian over neighbouring hits;
 *   4. scale it to the chart's height and draw a dot and a line per hit.
 *
 * KNOWN SIMPLIFICATIONS (the offline analysis will do these properly)
 *   - missed moles are not filled in by interpolation; the line just joins
 *     the dots on either side;
 *   - the smoothing width (sigma = 1.5 hits) is a placeholder, not the value
 *     from Esterman et al.;
 *   - smoothing runs over hit number, not over time;
 *   - hits from "both" trials (slower, since the player must choose) are
 *     included alongside hits from single-mole trials.
 */

/**
 * Chart geometry in SVG units (the chart's viewBox is 1000 wide, 198 tall).
 *   W      total width         L, R   left and right margins
 *   base   y of the baseline   height how tall the curve can be above it
 */
export const CH = Object.freeze({ W: 1000, L: 44, R: 14, base: 118, height: 100 });

// ---- small statistics helpers (also used by the console's live measures) ----

/** Average. NaN for an empty list. */
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
/** Sample standard deviation (divides by n - 1). NaN with fewer than two values. */
export const sdev = (a) => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
};
/** Middle value; the mean of the two middle values for an even count. */
export const median = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};

/**
 * Gaussian smoothing over trial index (not time). Edge-normalized.
 * Each output value is a weighted average of the input values around it:
 * the value itself counts most, and neighbours count less the farther away
 * they are (a bell curve whose width is `sigma`, in positions). Weights are
 * divided by their total, so values near the ends of the series are not
 * pulled toward zero.
 */
export function smooth(arr, sigma) {
  const n = arr.length;
  const out = new Array(n);
  const rad = Math.ceil(sigma * 3);   // beyond 3 sigma the weight is negligible
  for (let i = 0; i < n; i++) {
    let s = 0;   // running sum of weight x value
    let w = 0;   // running sum of weights
    for (let k = -rad; k <= rad; k++) {
      const j = i + k;
      if (j < 0 || j >= n) continue;          // off either end: skip
      const g = Math.exp(-(k * k) / (2 * sigma * sigma));   // bell-curve weight at distance k
      s += g * arr[j];
      w += g;
    }
    out[i] = s / w;
  }
  return out;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Map a time (ms from the start pulse) onto the chart's x axis, inside the margins. */
export function traceX(tMs, durationS) {
  const dur = durationS * 1000;
  return CH.L + (clamp(tMs, 0, dur) / dur) * (CH.W - CH.L - CH.R);
}

/** Move the vertical "now" line to a time (ms). Used while a run is going. */
export function moveCursor(cursorEl, tMs, durationS) {
  const x = traceX(tMs, durationS).toFixed(1);
  cursorEl.setAttribute('x1', x);
  cursorEl.setAttribute('x2', x);
}

/**
 * Redraw the whole trace into an SVG group. Called again after every trial,
 * so it rebuilds everything from scratch each time.
 * @param {Element} groupEl
 * @param {object} config   durationS, trS.
 * @param {Array}  trials   Engine trial records.
 */
export function drawTrace(groupEl, config, trials) {
  const dur = config.durationS * 1000;
  const x = (t) => traceX(t, config.durationS);   // time (ms) -> x position

  // Step 1. Baseline and the "higher = less stable" label.
  let s = `<line class="axisline" x1="${CH.L}" x2="${CH.W - CH.R}" y1="${CH.base}" y2="${CH.base}"/>`;
  s += `<text class="axis" x="${CH.L}" y="11">Higher means less stable responding</text>`;

  // Step 2. Yellow ticks along the bottom, one per simulated scan volume
  // (every TR). A taller tick marks every tenth volume.
  const trMs = config.trS * 1000;
  for (let k = 0; k * trMs <= dur + 1; k++) {
    const xx = x(k * trMs).toFixed(1);
    s += `<line class="tr" x1="${xx}" x2="${xx}" y1="162" y2="${k % 10 === 0 ? 176 : 169}"/>`;
  }
  // Step 3. Time labels under the axis: every 10 s, or every 30 s for long runs.
  const stepS = config.durationS > 150 ? 30 : 10;
  for (let sec = 0; sec <= config.durationS; sec += stepS) {
    s += `<text class="axis" x="${x(sec * 1000).toFixed(1)}" y="194" text-anchor="middle">${sec} s</text>`;
  }

  // Step 4. Error marks, placed at the time the trial started: a red triangle
  // where a sad mole was pressed (commission), a red ring where a happy mole
  // was missed (omission). Trials with any other outcome get no mark.
  for (const a of trials) {
    if (a.outcome === 'commission') {
      const xx = x(a.actualOnsetMs);
      s += `<path class="mk-com" d="M${(xx - 5).toFixed(1)} 150 L${(xx + 5).toFixed(1)} 150 L${xx.toFixed(1)} 140 Z"/>`;
    } else if (a.outcome === 'omission') {
      s += `<circle class="mk-om" cx="${x(a.actualOnsetMs).toFixed(1)}" cy="145" r="4.2"/>`;
    }
  }

  // Step 5. Collect the hits: trials where a happy mole was hit have a
  // reaction time (goodRtMs). Misses and sad-mole trials have none.
  const hits = trials.filter((a) => a.goodRtMs != null);
  if (hits.length >= 3) {          // fewer than three points make no useful curve
    const rts = hits.map((a) => a.goodRtMs);

    // Step 6. "How unusual was this reaction time for this run?" Distance
    // from the run's average, in units of the run's own spread (a z-score,
    // made positive). Fast and slow outliers both come out high. If every RT
    // were identical the spread is 0, so fall back to 1 to avoid dividing by 0.
    const m = mean(rts);
    const sd = sdev(rts) || 1;

    // Step 7. Smooth over neighbouring hits (sigma = 1.5 hits, a placeholder)
    // so the line shows a trend rather than trial-to-trial jitter.
    const sm = smooth(rts.map((r) => Math.abs(r - m) / sd), 1.5);

    // Step 8. Scale to the chart. The top of the chart is the largest
    // smoothed value, but never less than 1.5, so a very steady run is not
    // stretched to fill the chart. y() turns a value into a height above the
    // baseline.
    const top = Math.max(1.5, ...sm);
    const y = (v) => CH.base - (v / top) * CH.height;

    // Dashed median line: points above it are "less stable", below "steadier".
    const med = y(median(sm)).toFixed(1);
    s += `<line class="median" x1="${CH.L}" x2="${CH.W - CH.R}" y1="${med}" y2="${med}"/>`;
    // The curve itself: a line through all the points, then a dot on each hit.
    // x is the time the trial started, y is the smoothed value.
    s += `<polyline class="vtc" points="${hits.map((a, j) => `${x(a.actualOnsetMs).toFixed(1)},${y(sm[j]).toFixed(1)}`).join(' ')}"/>`;
    hits.forEach((a, j) => {
      s += `<circle class="vtc-dot" cx="${x(a.actualOnsetMs).toFixed(1)}" cy="${y(sm[j]).toFixed(1)}" r="2.6"/>`;
    });
  } else {
    // Not enough hits yet (the start of a run, or a run with few presses).
    s += `<text class="axis" x="${(CH.W + CH.L) / 2}" y="72" text-anchor="middle">The trace appears after three hits.</text>`;
  }
  // Put it all on the page in one go.
  groupEl.innerHTML = s;
}
