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

test('variant names: score by default, none with everything off, joined in a fixed order otherwise', () => {
  assert.equal(feedbackVariant(resolveConfig()), 'score');
  assert.equal(resolveConfig({ showScore: false }).feedbackVariant, 'none');
  assert.equal(resolveConfig({ showScore: false, hammer: true, sound: true }).feedbackVariant, 'sound+hammer');
  assert.equal(resolveConfig({ hammer: true, hitRings: true, showScore: true, sound: true }).feedbackVariant, 'score+rings+sound+hammer');
});

test('variants never change the schedule: same seed, same trials', () => {
  const base = buildSchedule(resolveConfig({ nTrials: 60 }));
  for (const p of [{ showScore: true }, { hitRings: true }, { sound: true, hammer: true }]) {
    assert.deepEqual(buildSchedule(resolveConfig({ nTrials: 60, ...p })), base, JSON.stringify(p));
  }
});

test('the score: +1 per happy mole hit, -3 per distractor hit (default), over the happy moles so far', () => {
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
  assert.equal(state.score, 3 - 3, 'points');
  const goodMoles = trials.flatMap((t) => t.targets).filter((x) => x.valence === 'good' && x.outcome !== 'truncated');
  assert.equal(state.scoreDue, goodMoles.length, 'every happy mole counts once, hit or missed');
  assert.equal(state.scorePct, 0);
  // Each trial carries the running score at its end.
  const t1 = trials[0];
  assert.deepEqual([t1.scorePoints, t1.scoreDue], [1, 1], 'after one hit: 100%');
});

test('file names and the log say which variant a run used', () => {
  const d = new Date(2026, 9, 11, 9, 0, 0);
  assert.equal(exportFilename(resolveConfig({ seed: 5, showScore: false }), 'run', d), 'engagement-game_20261011-090000_behavioral_seed5_run.csv');
  assert.equal(exportFilename(resolveConfig({ seed: 5 }), 'run', d), 'engagement-game_20261011-090000_behavioral_seed5_score_run.csv');
  assert.equal(exportFilename(resolveConfig({ seed: 5, showScore: false, sound: true, hammer: true }), 'run', d),
    'engagement-game_20261011-090000_behavioral_seed5_sound+hammer_run.csv');
  const config = resolveConfig({ showScore: true, nTrials: 10 });
  const { trials, events } = simulateRun({ config, trials: buildSchedule(config) });
  const log = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  assert.equal(log.meta.feedback_variant, 'score');
  assert.match(runSummaryText({ config, trials, events }), /Feedback shown to the player: score\./);
  assert.doesNotMatch(runSummaryText({ config: resolveConfig({ nTrials: 10, showScore: false }), trials, events }), /Feedback shown/);
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
  assert.equal(q, '?trials=60&seed=7&mix=70-20-10&distractor=molerat&setting=scanner&rings=1&sound=1&hammer=1', 'score is the default, so it is left out');
  assert.ok(linkMatches(c, q));
  const back = resolveConfig(configFromQuery(q));
  for (const k of Object.keys(DEFAULTS)) assert.deepEqual(back[k], c[k], k);
});

test('links: results can be forced on, for labmates testing alone', () => {
  const q = configToQuery(resolveConfig({ hitRings: true }), { showResultsOnDisplay: true });
  assert.equal(q, '?rings=1&results=1');
  assert.equal(configToQuery(resolveConfig({ showScore: false })), '?score=0', 'turning the default score off');
  assert.equal(resolveConfig(configFromQuery('?score=0')).showScore, false);
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

test('score: the percentage, its text, and the penalty setting', async () => {
  const { scorePercent, scoreText } = await import('../src/summary.js');
  assert.equal(scorePercent(0, 0), null, 'nothing to score yet');
  assert.equal(scoreText(0, 0), '–');
  assert.equal(scoreText(9, 10), '90%');
  assert.equal(scoreText(-11, 20), '-55%', 'a hit distractor can push it below zero');
  assert.equal(resolveConfig().scorePenalty, 3);
  assert.equal(resolveConfig(configFromQuery('?penalty=10')).scorePenalty, 10);
  assert.equal(configToQuery(resolveConfig({ scorePenalty: 0 })), '?penalty=0');
  assert.throws(() => resolveConfig({ scorePenalty: -1 }), /scorePenalty/);
  const config = resolveConfig({ seed: 1234, nTrials: 40, scorePenalty: 7 });
  const schedule = buildSchedule(config);
  const bad = schedule.find((t) => t.type === 'bad');
  const { state } = simulateRun({ config, trials: schedule, presses: [{ tMs: bad.scheduledOnsetMs + 200, button: bad.targets[0].response }] });
  assert.equal(state.score, -7);
});

test('score: a wrong column costs nothing, a missed happy mole only grows the denominator', () => {
  const config = resolveConfig({ seed: 1234, nTrials: 20 });
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  const other = (t1.targets[0].response + 1) % 3;
  const { trials } = simulateRun({ config, trials: schedule, presses: [{ tMs: t1.scheduledOnsetMs + 100, button: other }] });
  assert.deepEqual([trials[0].scorePoints, trials[0].scoreDue], [0, 1], 'wrong column then missed: 0 of 1');
});

test('score bar: red below 50%, yellow 50 to 75%, green from 75%; fill stays within 0 to 100', async () => {
  const { scoreBand, scoreFill } = await import('../src/summary.js');
  const cases = [[null, null], [-120, 'low'], [0, 'low'], [49.9, 'low'], [50, 'mid'], [62, 'mid'], [74.9, 'mid'], [75, 'high'], [100, 'high']];
  for (const [pct, band] of cases) assert.equal(scoreBand(pct), band, `band at ${pct}`);
  assert.deepEqual([null, -50, 0, 37.5, 100].map(scoreFill), [0, 0, 0, 37.5, 100]);
});

test('score bar colour: a smooth scale from dark red through orange and yellow to green', async () => {
  const { scoreColor, SCORE_GRADIENT } = await import('../src/summary.js');
  for (const [pct, hex] of SCORE_GRADIENT) assert.equal(scoreColor(pct), hex, `stop at ${pct}`);
  assert.equal(scoreColor(-40), '#7A1414', 'below zero stays dark red');
  assert.equal(scoreColor(null), '#7A1414');
  assert.equal(scoreColor(130), '#3FA34D');
  assert.equal(scoreColor(15), '#A82D2B', 'halfway between dark red and red');
  // Smooth: no jump bigger than a small step between neighbouring percentages.
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let p = 0; p < 100; p++) {
    const a = rgb(scoreColor(p)); const b = rgb(scoreColor(p + 1));
    assert.ok(a.every((x, k) => Math.abs(x - b[k]) <= 12), `jump between ${p}% and ${p + 1}%`);
  }
});

test('scene: garden by default, plain grey on request, carried in links', async () => {
  const { SCENES } = await import('../src/config.js');
  assert.deepEqual([...SCENES], ['garden', 'grey']);
  assert.equal(resolveConfig().scene, 'garden');
  assert.equal(resolveConfig({ scene: 'grey' }).scene, 'grey');
  assert.throws(() => resolveConfig({ scene: 'beach' }), /scene must be one of/);
  assert.equal(configToQuery(resolveConfig({ scene: 'grey' })), '?scene=grey');
  assert.equal(resolveConfig(configFromQuery('?scene=grey')).scene, 'grey');
  assert.equal(configToQuery(resolveConfig()), '', 'the default scene is left out of links');
});
