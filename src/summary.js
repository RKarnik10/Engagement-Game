/**
 * Run summary: the numbers shown after a run, on the console and (when
 * testing) on the display. PURE; the analysis proper is Phase 3.
 */

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sdev = (a) => {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
};

/**
 * The score shown to the player: points as a percentage of the points a
 * perfect player would have so far. Null before any happy mole has counted.
 * Can go below zero, since a hit distractor costs scorePenalty (3) points.
 */
export function scorePercent(points, due) {
  return due > 0 ? (100 * points) / due : null;
}

/**
 * Rough band of the score: low below 50%, mid 50 to 75%, high from 75%.
 * Kept as a label on the bar (data-band) for tests and screen readers; the
 * colour itself comes from scoreColor.
 */
export const SCORE_BANDS = Object.freeze({ yellowFrom: 50, greenFrom: 75 });
export function scoreBand(pct) {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct >= SCORE_BANDS.greenFrom) return 'high';
  if (pct >= SCORE_BANDS.yellowFrom) return 'mid';
  return 'low';
}

/**
 * The bar's colour slides smoothly with the score (Rehaan Karnik, October 17,
 * 2026): dark red, red, orange, yellow through the 50s to the low 70s, light
 * green, then green at 100%. Colours between stops are blended evenly.
 */
export const SCORE_GRADIENT = Object.freeze([
  [0, '#7A1414'],    // dark red
  [30, '#D64541'],   // red
  [45, '#F0892A'],   // orange
  [55, '#F2C230'],   // yellow
  [72, '#EAD23E'],   // still yellow
  [85, '#9FD46A'],   // light green
  [100, '#3FA34D'],  // green
]);

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** Colour for a score, as "#RRGGBB". Below 0 is dark red, above 100 green. */
export function scoreColor(pct) {
  const stops = SCORE_GRADIENT;
  if (pct == null || !Number.isFinite(pct) || pct <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    if (pct <= p1) {
      const [p0, c0] = stops[i - 1];
      const f = (pct - p0) / (p1 - p0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return rgbToHex(a.map((v, k) => v + (b[k] - v) * f));
    }
  }
  return stops[stops.length - 1][1];
}

/** How full the bar is, 0 to 100. A negative score shows an empty bar. */
export function scoreFill(pct) {
  if (pct == null || !Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

/** Score as text, e.g. "92%", or "–" before it means anything. */
export function scoreText(points, due) {
  const p = scorePercent(points, due);
  return p == null ? '–' : `${Math.round(p)}%`;
}

/**
 * @param {Array} trials  Trial records that have an outcome.
 */
export function summarize(trials) {
  const done = trials.filter((t) => t.outcome);
  const moles = done.flatMap((t) => t.targets).filter((x) => x.outcome && x.outcome !== 'truncated');
  const good = moles.filter((x) => x.valence === 'good');
  const bad = moles.filter((x) => x.valence === 'bad');
  const both = done.filter((t) => t.type === 'both' && t.correct != null);
  const rts = done.map((t) => t.goodRtMs).filter((r) => r != null);
  const m = mean(rts);
  const s = sdev(rts);
  return {
    trials: done.length,
    hits: good.filter((x) => x.outcome === 'hit').length,
    goodShown: good.length,
    com: bad.filter((x) => x.outcome === 'commission').length,
    badShown: bad.length,
    bothRight: both.filter((t) => t.correct === 1).length,
    bothShown: both.length,
    rts,
    meanRt: m,
    sdRt: s,
    cv: rts.length > 1 ? s / m : NaN,
  };
}

/** Counts of the logged events that are not tied to a trial outcome. */
export function eventCounts(events) {
  const n = (name) => events.filter((e) => e.event === name).length;
  const resumes = events.filter((e) => e.event === 'resume');
  return {
    wrongColumn: n('wrong_hole'),
    noMole: n('no_target_press'),
    hidden: n('display_hidden'),
    pauses: n('pause'),
    pausedMs: resumes.reduce((sum, e) => sum + (e.paused_ms || 0), 0),
  };
}

/** One paragraph describing a finished run. */
export function runSummaryText(run) {
  const s = summarize(run.trials);
  const c = eventCounts(run.events);
  const end = run.events.at(-1);
  const how = end && end.reason === 'completed' ? 'finished' : 'ended early';
  const parts = [
    `Run ${how} after ${s.trials} of ${run.config.nTrials} trials.`,
    `${s.hits} of ${s.goodShown} happy moles hit, ${s.com} of ${s.badShown} distractors pressed,`
      + ` ${s.bothRight} of ${s.bothShown} happy + distractor trials fully right.`,
  ];
  if (s.rts.length) parts.push(`Mean reaction time ${Math.round(s.meanRt)} ms${s.rts.length > 1 ? `, variability (SD ÷ mean) ${s.cv.toFixed(2)}` : ''}.`);
  const last = [...run.trials].reverse().find((t) => t.scoreDue != null);
  if (last && last.scoreDue > 0) {
    parts.push(`Score ${scoreText(last.scorePoints, last.scoreDue)} (${last.scorePoints} points out of ${last.scoreDue}; `
      + `a hit distractor costs ${run.config.scorePenalty}).`);
  }
  const variant = run.config.feedbackVariant;
  if (variant && variant !== 'none') parts.push(`Feedback shown to the player: ${variant}.`);
  if (c.pauses) parts.push(`Paused ${c.pauses} time(s), ${(c.pausedMs / 1000).toFixed(1)} s in total: fine for testing, not usable for scanning.`);
  if (c.hidden) parts.push(`Warning: the display was hidden ${c.hidden} time(s); timing in those stretches is not valid.`);
  return parts.join(' ');
}
