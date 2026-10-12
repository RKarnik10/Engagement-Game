/**
 * Feedback variants for piloting (score, rings, sound, hammer) and the
 * settings links for labmates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, feedbackVariant, DEFAULTS } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { exportFilename, buildFullLog } from '../src/export.js';
import { runSummaryText } from '../src/summary.js';
import { createDisplaySession } from '../src/session.js';
import { configFromQuery, configToQuery, hasQuerySettings, linkMatches } from '../src/query.js';
import { simulateRun } from './_sim.js';

test('variant names: none by default, joined in a fixed order otherwise', () => {
  assert.equal(feedbackVariant(resolveConfig()), 'none');
  assert.equal(resolveConfig({ showScore: true }).feedbackVariant, 'score');
  assert.equal(resolveConfig({ hammer: true, sound: true }).feedbackVariant, 'sound+hammer');
  assert.equal(resolveConfig({ hammer: true, hitRings: true, showScore: true, sound: true }).feedbackVariant, 'score+rings+sound+hammer');
});

test('variants never change the schedule: same seed, same trials', () => {
  const base = buildSchedule(resolveConfig({ nTrials: 60 }));
  for (const p of [{ showScore: true }, { hitRings: true }, { sound: true, hammer: true }]) {
    assert.deepEqual(buildSchedule(resolveConfig({ nTrials: 60, ...p })), base, JSON.stringify(p));
  }
});

test('the score counts happy moles hit, and a pressed distractor does not take points away', () => {
  const config = resolveConfig({ seed: 1234, nTrials: 60 });
  const schedule = buildSchedule(config);
  const goods = schedule.filter((t) => t.type === 'good').slice(0, 3);
  const bad = schedule.find((t) => t.type === 'bad');
  const presses = [
    ...goods.map((t) => ({ tMs: t.scheduledOnsetMs + 300, button: t.targets[0].response })),
    { tMs: bad.scheduledOnsetMs + 300, button: bad.targets[0].response },
  ];
  const { state, trials } = simulateRun({ config, trials: schedule, presses });
  assert.equal(trials.filter((t) => t.outcome === 'commission').length, 1);
  assert.equal(state.score, 3);
});

test('file names and the log say which variant a run used', () => {
  const d = new Date(2026, 9, 11, 9, 0, 0);
  assert.equal(exportFilename(resolveConfig({ seed: 5 }), 'run', d), 'engagement-game_20261011-090000_behavioral_seed5_run.csv');
  assert.equal(exportFilename(resolveConfig({ seed: 5, sound: true, hammer: true }), 'run', d),
    'engagement-game_20261011-090000_behavioral_seed5_sound+hammer_run.csv');
  const config = resolveConfig({ showScore: true, nTrials: 10 });
  const { trials, events } = simulateRun({ config, trials: buildSchedule(config) });
  const log = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  assert.equal(log.meta.feedback_variant, 'score');
  assert.match(runSummaryText({ config, trials, events }), /Feedback shown to the player: score\./);
  assert.doesNotMatch(runSummaryText({ config: resolveConfig({ nTrials: 10 }), trials, events }), /Feedback shown/);
});

test('the display hears about hits, pressed distractors, and wrong columns, and nothing else', () => {
  const channel = { postMessage() {}, addEventListener() {}, removeEventListener() {} };
  let now = 0;
  let pending = null;
  const fed = [];
  const session = createDisplaySession({
    channel, displayId: 'd', clock: () => now,
    raf: (fn) => { pending = fn; return 1; }, caf: () => { pending = null; },
    view: { feedback: (r) => fed.push(r.event) },
  });
  session.setConfig({ seed: 1234, nTrials: 60 });
  session.trigger('key t');
  const sched = session.engine().trials();
  const both = sched.find((t) => t.type === 'both');
  const third = [0, 1, 2].find((c) => !both.targets.some((x) => x.response === c));
  const plan = [
    { tMs: sched[0].scheduledOnsetMs + 300, button: sched[0].targets[0].response },
    { tMs: both.scheduledOnsetMs + 100, button: third },
    { tMs: both.scheduledOnsetMs + 200, button: both.targets[1].response },
    { tMs: 500, button: 0 },
  ].sort((a, b) => a.tMs - b.tMs);
  while (pending) {
    now += 10;
    while (plan.length && plan[0].tMs <= now) session.press(plan.shift().button, 'k');
    const fn = pending; pending = null; fn();
  }
  assert.deepEqual(fed, ['hit', 'wrong_hole', 'commission'], 'no feedback for a press with nothing up, or for misses');
});

test('links: settings round-trip, defaults are left out', () => {
  assert.equal(configToQuery(resolveConfig()), '');
  const c = resolveConfig({
    nTrials: 60, seed: 7, goodShare: 0.7, badShare: 0.2, bothShare: 0.1, badStim: 'molerat',
    setting: 'scanner', showScore: true, hitRings: true, sound: true, hammer: true,
  });
  const q = configToQuery(c);
  assert.equal(q, '?trials=60&seed=7&mix=70-20-10&distractor=molerat&setting=scanner&score=1&rings=1&sound=1&hammer=1');
  assert.ok(linkMatches(c, q));
  const back = resolveConfig(configFromQuery(q));
  for (const k of Object.keys(DEFAULTS)) assert.deepEqual(back[k], c[k], k);
});

test('links: results can be forced on, for labmates testing alone', () => {
  const q = configToQuery(resolveConfig({ showScore: true }), { showResultsOnDisplay: true });
  assert.equal(q, '?score=1&results=1');
  assert.equal(resolveConfig(configFromQuery(q)).showResultsOnDisplay, true);
});

test('links: reading is forgiving about what is not ours, strict about bad values', () => {
  assert.equal(hasQuerySettings(''), false);
  assert.equal(hasQuerySettings('?utm_source=email'), false, 'unknown parameters are ignored');
  assert.equal(hasQuerySettings('?trials=30'), true);
  assert.deepEqual(configFromQuery('?distractor=sad'), { badStim: 'mole_sad' });
  assert.deepEqual(configFromQuery('?score=0'), { showScore: false });
  assert.throws(() => resolveConfig(configFromQuery('?mix=80-10')), /goodShare/);
  assert.throws(() => resolveConfig(configFromQuery('?mix=80-10-20')), /add up to 1/);
  assert.throws(() => resolveConfig(configFromQuery('?trials=abc')), /nTrials/);
  assert.throws(() => resolveConfig(configFromQuery('?distractor=eggplant')), /badStim/);
});
