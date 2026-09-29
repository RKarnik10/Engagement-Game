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
  if (c.pauses) parts.push(`Paused ${c.pauses} time(s), ${(c.pausedMs / 1000).toFixed(1)} s in total: fine for testing, not usable for scanning.`);
  if (c.hidden) parts.push(`Warning: the display was hidden ${c.hidden} time(s); timing in those stretches is not valid.`);
  return parts.join(' ');
}
