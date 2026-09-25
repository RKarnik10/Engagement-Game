/**
 * Generate an example export without a browser.
 *
 * Plays the real engine under a fake 60 Hz clock, with a simulated
 * participant whose attention drifts, so the three output files have
 * realistic presses and timing. Deterministic: same seed, same files.
 *
 *   node examples/simulate-run.mjs [outDir] [seed]
 *
 * This is a demo generator, not part of the task. No human data here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { createEngine } from '../src/engine.js';
import { createLogger } from '../src/logger.js';
import { mulberry32 } from '../src/rng.js';
import { buildRunCSV, buildEventsTSV, buildFullLogJSON } from '../src/export.js';

const outDir = process.argv[2] || path.join(import.meta.dirname, '.');
const seed = Number(process.argv[3] || 1234);
const config = resolveConfig({ seed, setting: 'behavioral' });
const schedule = buildSchedule(config);

/* ---- a simulated participant ----
   Reaction times drift slowly over the run and jitter trial to trial, so the
   variance time course has something to show. "Both" trials are slower,
   because the participant has to pick the right mole. Rates are in the range
   a healthy adult typically gives on this kind of task. */
const rnd = mulberry32(seed ^ 0x5eed);
const gauss = () => {
  const u = Math.max(rnd(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};
const P_OMISSION = 0.04;       // good moles missed
const P_WRONG_COLUMN = 0.02;   // right timing, empty column
const P_CORRECTS = 0.6;        // ...then presses the right column
const P_COMMISSION = 0.26;     // bad-only trials pressed
const P_BOTH_WRONG_MOLE = 0.12;// both trials: pressed the bad mole instead of the good one
const P_BOTH_TWICE = 0.08;     // both trials: pressed the good one, then the bad one too

const plan = [];
for (const t of schedule) {
  const minute = t.scheduledOnsetMs / 60000;
  const drift = 30 * Math.sin(minute * 1.7) + (minute > 6 ? 45 : 0);
  const spread = 55 + (minute > 6 ? 35 : 0);
  const rtFor = (extra = 0) => Math.round(Math.max(120, 400 + extra + drift + gauss() * spread));
  const good = t.targets.find((x) => x.valence === 'good');
  const bad = t.targets.find((x) => x.valence === 'bad');
  const at = (rt, button) => { if (rt < config.holdMs) plan.push({ tMs: t.scheduledOnsetMs + rt, button }); };

  if (t.type === 'good') {
    if (rnd() < P_OMISSION) continue;
    const empty = [0, 1, 2].filter((c) => c !== good.response);
    const rt = rtFor();
    if (rnd() < P_WRONG_COLUMN) {
      at(rt, empty[Math.floor(rnd() * empty.length)]);
      if (rnd() < P_CORRECTS) at(rt + 170, good.response);   // notices and corrects
    } else {
      at(rt, good.response);
    }
  } else if (t.type === 'bad') {
    if (rnd() < P_COMMISSION) at(rtFor(), bad.response);
  } else {
    const r = rnd();
    if (r < P_BOTH_WRONG_MOLE) at(rtFor(60), bad.response);
    else if (r < P_BOTH_WRONG_MOLE + P_OMISSION) continue;
    else {
      const rt = rtFor(60);
      at(rt, good.response);
      if (rnd() < P_BOTH_TWICE) at(Math.min(rt + 150, config.holdMs - 20), bad.response);
    }
  }
}
// A few stray presses when nothing is up.
for (let i = 0; i < 5; i++) {
  plan.push({ tMs: Math.round(500 + rnd() * (config.durationS * 1000 - 1000)), button: Math.floor(rnd() * 3) });
}
plan.sort((a, b) => a.tMs - b.tMs);

/* ---- run the real engine under a fake 60 Hz clock ---- */
const FRAME_MS = 1000 / 60;
let now = 0;
let pending = null;
const logger = createLogger();
const engine = createEngine({
  config, trials: schedule, logger,
  clock: () => now,
  raf: (fn) => { pending = fn; return 1; },
  caf: () => { pending = null; },
});
engine.start({ source: 'simulated' });

const queue = plan.slice();
let frames = 0;
while (pending) {
  const next = now + FRAME_MS;
  while (queue.length && queue[0].tMs <= next) {
    const p = queue.shift();
    if (p.tMs > now) now = p.tMs;
    engine.press(p.button, `key ${config.keys[p.button]}`);
  }
  now = next;
  frames++;
  const fn = pending;
  pending = null;
  fn();
}

/* ---- write the three files ---- */
const trials = engine.trials();
const created = new Date('2026-09-21T15:00:00.000Z');
const files = {
  'example_run.csv': buildRunCSV(trials),
  'example_events.tsv': buildEventsTSV(trials),
  'example_log.json': buildFullLogJSON({
    config, trials, events: logger.toArray(), frameStats: engine.frameStats(),
    userAgent: 'simulated participant (examples/simulate-run.mjs), not a real browser',
    created: created.toISOString(),
  }),
};
fs.mkdirSync(outDir, { recursive: true });
for (const [name, text] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), text);
}

const moles = trials.flatMap((t) => t.targets);
const goodMoles = moles.filter((x) => x.valence === 'good');
const badMoles = moles.filter((x) => x.valence === 'bad');
const n = (list, o) => list.filter((x) => x.outcome === o).length;
const byType = (type) => trials.filter((t) => t.type === type);
const rts = trials.map((t) => t.goodRtMs).filter((r) => r != null);
const mean = rts.reduce((a, b) => a + b, 0) / rts.length;
const sd = Math.sqrt(rts.reduce((s2, r) => s2 + (r - mean) ** 2, 0) / (rts.length - 1));
const lags = trials.map((t) => t.actualOnsetMs - t.scheduledOnsetMs);
console.log(`trials shown      ${trials.filter((t) => t.actualOnsetMs != null).length} of ${config.nTrials}` +
  ` (${byType('good').length} good, ${byType('bad').length} bad, ${byType('both').length} both)`);
console.log(`run length        ${(engine.getState().endedMs / 60000).toFixed(2)} min, ${frames} frames`);
console.log(`good moles hit    ${n(goodMoles, 'hit')} / ${goodMoles.length}`);
console.log(`bad moles pressed ${n(badMoles, 'commission')} / ${badMoles.length}`);
console.log(`both trials right ${byType('both').filter((t) => t.correct === 1).length} / ${byType('both').length}`);
console.log(`wrong column      ${engine.getState().counts.wrong_hole}`);
console.log(`press, no mole    ${engine.getState().counts.no_target_press}`);
console.log(`reaction time     mean ${mean.toFixed(0)} ms, SD ${sd.toFixed(0)} ms, CV ${(sd / mean).toFixed(2)}`);
console.log(`onset lag         max ${Math.max(...lags).toFixed(1)} ms`);
console.log(`files             ${Object.keys(files).join(', ')} in ${path.resolve(outDir)}`);
