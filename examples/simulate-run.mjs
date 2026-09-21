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
   variance time course has something to show. Rates are in the range a
   healthy adult typically gives on an 80/20 go/no-go task. */
const rnd = mulberry32(seed ^ 0x5eed);
const gauss = () => {
  const u = Math.max(rnd(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};
const P_OMISSION = 0.04;      // happy moles missed
const P_COMMISSION = 0.26;    // presses on skip trials
const P_WRONG_COLUMN = 0.015; // right timing, wrong column

const plan = [];
for (const t of schedule) {
  const minute = t.scheduledOnsetMs / 60000;
  // Slow drift plus a wandering stretch in the second half of the run.
  const drift = 30 * Math.sin(minute * 1.7) + (minute > 6 ? 45 : 0);
  const spread = 55 + (minute > 6 ? 35 : 0);
  const rt = Math.round(Math.max(120, 400 + drift + gauss() * spread));
  if (rt >= config.holdMs) continue;                       // too slow: the mole is gone
  if (t.type === 'go') {
    if (rnd() < P_OMISSION) continue;
    const button = rnd() < P_WRONG_COLUMN
      ? (t.response + 1 + Math.floor(rnd() * 2)) % config.keys.length
      : t.response;
    plan.push({ tMs: t.scheduledOnsetMs + rt, button });
  } else if (rnd() < P_COMMISSION) {
    plan.push({ tMs: t.scheduledOnsetMs + rt, button: t.response });
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

const count = (o) => trials.filter((t) => t.outcome === o).length;
const rts = trials.filter((t) => t.outcome === 'hit').map((t) => t.rtMs);
const mean = rts.reduce((a, b) => a + b, 0) / rts.length;
const sd = Math.sqrt(rts.reduce((s, r) => s + (r - mean) ** 2, 0) / (rts.length - 1));
const lags = trials.map((t) => t.actualOnsetMs - t.scheduledOnsetMs);
console.log(`trials shown      ${trials.filter((t) => t.actualOnsetMs != null).length} of ${config.nTrials}`);
console.log(`run length        ${(engine.getState().endedMs / 60000).toFixed(2)} min, ${frames} frames`);
console.log(`hits              ${count('hit')} / ${count('hit') + count('omission')} happy moles`);
console.log(`presses on skips  ${count('commission')} / ${count('commission') + count('correct_rejection')}`);
console.log(`wrong column      ${engine.getState().counts.wrong_hole}`);
console.log(`press, no mole    ${engine.getState().counts.no_target_press}`);
console.log(`reaction time     mean ${mean.toFixed(0)} ms, SD ${sd.toFixed(0)} ms, CV ${(sd / mean).toFixed(2)}`);
console.log(`onset lag         max ${Math.max(...lags).toFixed(1)} ms`);
console.log(`files             ${Object.keys(files).join(', ')} in ${path.resolve(outDir)}`);
