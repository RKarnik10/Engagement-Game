/**
 * The health bar game style (October 26, 2026): -3 for a sad mole hit, -1 for
 * a missed happy mole, +5 after 5 correct trials in a row, between 0 and 100.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, HEALTH_MAX } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { buildRunCSV } from '../src/export.js';
import { runSummaryText } from '../src/summary.js';
import { configFromQuery, configToQuery } from '../src/query.js';
import { simulateRun } from './_sim.js';

const cfg = (p = {}) => resolveConfig({ seed: 1234, nTrials: 60, gameStyle: 'health', ...p });
const hit = (t) => ({ tMs: t.scheduledOnsetMs + 300, button: t.targets[0].response });
const goodTrials = (schedule) => schedule.filter((t) => t.type === 'good');

test('health: the defaults, the style, and what is allowed', () => {
  const c = resolveConfig();
  assert.equal(c.gameStyle, 'score', 'the percentage score stays the default style');
  assert.deepEqual([c.healthSadHit, c.healthMiss, c.healthStreak, c.healthRegen], [10, 3, 5, 5]);
  assert.equal(HEALTH_MAX, 100);
  assert.equal(resolveConfig({ gameStyle: 'health' }).feedbackVariant, 'health+rings+sound+hammer', 'named health in files and logs');
  assert.equal(resolveConfig({ gameStyle: 'health', showScore: false, hitRings: false, sound: false, hammer: false }).feedbackVariant, 'none');
  assert.throws(() => resolveConfig({ gameStyle: 'lives' }), /gameStyle must be one of/);
  assert.throws(() => resolveConfig({ healthSadHit: -1 }), /healthSadHit/);
  assert.throws(() => resolveConfig({ healthStreak: 0 }), /healthStreak/);
  assert.throws(() => resolveConfig({ healthRegen: 101 }), /healthRegen/);
});

test('health: starts at 100 and a perfect run stays at 100', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const presses = schedule.filter((t) => t.type !== 'bad').map(hit);
  const { state, trials } = simulateRun({ config, trials: schedule, presses });
  assert.equal(state.health, 100);
  assert.ok(trials.every((t) => t.health === 100));
});

test('health: a sad mole hit costs 10, a missed happy mole costs 3', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const [g1, g2] = goodTrials(schedule);
  const bad = schedule.find((t) => t.type === 'bad');
  // Miss the first two happy moles (-3 each), and hit the first sad mole (-10).
  const presses = [{ tMs: bad.scheduledOnsetMs + 300, button: bad.targets[0].response }];
  const { trials, events } = simulateRun({ config, trials: schedule, presses });
  const byTrial = (n) => trials[n - 1];
  assert.equal(byTrial(g1.trial).health, 97, 'one miss: 97');
  assert.equal(byTrial(g2.trial).health, 94, 'two misses: 94');
  // Every later trial is a miss or a correct skip; check the sad mole's own step.
  const before = trials[bad.trial - 2].health;
  assert.equal(before - byTrial(bad.trial).health, 10, 'a sad mole hit costs exactly 10');
  const ev = events.find((e) => e.event === 'commission');
  assert.equal(ev.health, before - 10, 'the event carries the new health');
});

test('health: five correct trials in a row give back 5, up to 100', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  // Miss the first happy mole (-3 -> 97), then answer everything right.
  const presses = schedule.filter((t) => t.type !== 'bad').slice(1).map(hit);
  const { trials, events } = simulateRun({ config, trials: schedule, presses });
  assert.equal(trials[0].health, 97);
  // Trials 2 to 6 are five correct trials in a row: 97 + 5 = 102, capped at 100.
  assert.equal(trials[1].health, 97);
  assert.equal(trials[4].health, 97);
  assert.equal(trials[5].health, 100, 'regenerated +5 on the fifth correct trial, capped at 100');
  const end = events.find((e) => e.event === 'trial_end' && e.trial === 6);
  assert.deepEqual([end.health, end.health_streak], [100, 0], 'the streak restarts after a regeneration');
});

test('health: after a sad mole hit (-10), five correct trials in a row give back exactly 5', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const bad = schedule.find((t) => t.type === 'bad' && t.trial >= 6);
  const presses = [
    ...schedule.filter((t) => t.trial < bad.trial && t.type !== 'bad').map(hit),
    { tMs: bad.scheduledOnsetMs + 300, button: bad.targets[0].response },
    ...schedule.filter((t) => t.trial > bad.trial && t.type !== 'bad').map(hit),
  ];
  const { trials } = simulateRun({ config, trials: schedule, presses });
  assert.equal(trials[bad.trial - 1].health, 90, 'a sad mole hit at 100 costs 10');
  const after = trials.slice(bad.trial);          // every trial from here on is answered correctly
  assert.equal(after[3].health, 90, 'four correct in a row: nothing yet');
  assert.equal(after[4].health, 95, 'five correct in a row: +5');
  assert.equal(after[9].health, 100, 'ten correct in a row: +10 in all, capped at 100');
});

test('health: regeneration needs an unbroken streak, and one mistake restarts the count', () => {
  const config = cfg({ healthStreak: 3, healthRegen: 10, healthSadHit: 20 });
  const schedule = buildSchedule(config);
  const bad = schedule.find((t) => t.type === 'bad' && t.trial >= 6);
  const before = schedule.filter((t) => t.trial < bad.trial && t.type !== 'bad');
  const presses = [
    ...before.map(hit),
    { tMs: bad.scheduledOnsetMs + 300, button: bad.targets[0].response },   // -20 at the sad mole
    ...schedule.filter((t) => t.trial > bad.trial && t.type !== 'bad').map(hit),
  ];
  const { trials } = simulateRun({ config, trials: schedule, presses });
  const hurt = trials[bad.trial - 1].health;
  assert.equal(hurt, 80, 'a sad mole hit at 100 costs 20');
  // The two trials after it are correct but not yet three in a row; the third regenerates.
  const after = trials.slice(bad.trial);
  assert.equal(after[0].health, 80);
  assert.equal(after[1].health, 80);
  assert.equal(after[2].health, 90, 'three correct in a row: +10');
});

test('health: stops at 0 and the run carries on (no game over)', () => {
  const config = cfg({ healthSadHit: 100, healthMiss: 100 });
  const schedule = buildSchedule(config);
  const { trials, events, state } = simulateRun({ config, trials: schedule });   // misses everything
  assert.equal(state.health, 0);
  assert.ok(trials.every((t) => t.health >= 0), 'never below zero');
  assert.equal(events.at(-1).event, 'run_end');
  assert.equal(events.at(-1).reason, 'completed', 'the run was not cut short');
  assert.equal(trials.filter((t) => t.actualOnsetMs != null).length, 60, 'every trial was still shown');
});

test('health: a trial cut off by the end of the run changes nothing', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const stopAt = schedule[2].scheduledOnsetMs + 200;
  const { trials, state } = simulateRun({ config, trials: schedule, stopAt, presses: [hit(schedule[0]), hit(schedule[1])] });
  assert.equal(trials[2].outcome, 'truncated');
  assert.equal(state.health, 100);
  assert.equal(state.healthStreak, 2, 'the truncated trial neither counted nor broke the streak');
});

test('health is recorded in the run table and the summary whichever style is shown', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const { trials, events } = simulateRun({ config, trials: schedule });
  const rows = buildRunCSV(trials, config).trim().split('\n').map((l) => l.split(','));
  const col = rows[0].indexOf('health');
  assert.ok(col > 0, 'a health column exists');
  assert.equal(rows[1][col], '97', 'trial 1: one missed happy mole');
  assert.match(runSummaryText({ config, trials, events }), /Health at the end: \d+ of 100\./);
  assert.doesNotMatch(runSummaryText({ config: resolveConfig({ nTrials: 60 }), trials, events }), /Health at the end/);
  // The percentage-score style still records health, so the data is complete.
  const scoreStyle = resolveConfig({ seed: 1234, nTrials: 60 });
  const r2 = simulateRun({ config: scoreStyle, trials: buildSchedule(scoreStyle) });
  assert.ok(r2.trials.every((t) => Number.isFinite(t.health)));
});

test('links carry the game style and the health numbers', () => {
  const c = resolveConfig({ gameStyle: 'health', healthSadHit: 5, healthMiss: 2, healthStreak: 4, healthRegen: 8 });
  const q = configToQuery(c);
  assert.equal(q, '?hsad=5&hmiss=2&hstreak=4&hregen=8&style=health');
  const back = resolveConfig(configFromQuery(q));
  for (const k of ['gameStyle', 'healthSadHit', 'healthMiss', 'healthStreak', 'healthRegen']) assert.deepEqual(back[k], c[k], k);
  assert.equal(configToQuery(resolveConfig()), '', 'defaults stay out of links');
});
