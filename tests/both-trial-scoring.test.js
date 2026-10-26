/**
 * Scoring in a "both" trial (October 26, 2026): once the sad mole has been
 * hit, the trial counts only as that error. The happy mole no longer counts
 * toward the score or health, whether it is then pressed or missed. A happy
 * mole hit BEFORE the sad one had already counted, and still does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { buildFullLog } from '../src/export.js';
import { simulateRun } from './_sim.js';

const cfg = () => resolveConfig({ seed: 1234, nTrials: 60 });

/** Play the first both trial with the given presses (ms after onset, which mole), and return its score and health steps. */
function playBoth(presses) {
  const config = cfg();
  const schedule = buildSchedule(config);
  const t = schedule.find((x) => x.type === 'both');
  const [g, b] = t.targets;
  const btn = { good: g.response, bad: b.response };
  const { trials, events } = simulateRun({
    config, trials: schedule,
    presses: presses.map(([ms, who]) => ({ tMs: t.scheduledOnsetMs + ms, button: btn[who] })),
  });
  const a = trials[t.trial - 1];
  const prev = trials[t.trial - 2];
  return {
    a, events, config, trials,
    points: a.scorePoints - prev.scorePoints,
    due: a.scoreDue - prev.scoreDue,
    health: a.health - prev.health,
  };
}

test('both trial, sad mole hit then the happy mole hit: counts only as the sad mole', () => {
  const r = playBoth([[200, 'bad'], [400, 'good']]);
  assert.equal(r.a.outcome, 'commission');
  assert.equal(r.points, -3, 'only the sad-mole penalty: no +1 for the happy hit');
  assert.equal(r.due, 0, 'the happy mole is not counted in the score denominator');
  assert.equal(r.health, -10, 'only the sad-mole cost');
  // The data still says what happened.
  assert.deepEqual(r.a.targets.map((x) => [x.valence, x.outcome, x.counted]), [['good', 'hit', false], ['bad', 'commission', true]]);
  assert.ok(Math.abs(r.a.goodRtMs - 400) < 1e-9, 'the happy press and its time are still recorded');
  const hit = r.events.find((e) => e.event === 'hit' && e.trial === r.a.trial);
  assert.equal(hit.counted, false, 'the event says it did not count');
});

test('both trial, sad mole hit and the happy mole missed: counts only as the sad mole', () => {
  const r = playBoth([[200, 'bad']]);
  assert.equal(r.a.outcome, 'commission');
  assert.equal(r.points, -3);
  assert.equal(r.due, 0, 'a missed happy mole is not added to the denominator');
  assert.equal(r.health, -10, 'no extra -3 for the miss: -10, not -13');
  assert.deepEqual(r.a.targets.map((x) => [x.outcome, x.counted]), [['omission', false], ['commission', true]]);
});

test('both trial, the happy mole hit first and then the sad one: the happy hit had already counted', () => {
  const r = playBoth([[200, 'good'], [400, 'bad']]);
  assert.equal(r.a.outcome, 'commission');
  assert.equal(r.points, 1 - 3, '+1 for the happy hit, then the sad-mole penalty');
  assert.equal(r.due, 1);
  assert.equal(r.health, -10);
  assert.deepEqual(r.a.targets.map((x) => x.counted), [true, true]);
});

test('both trial answered right, or not answered at all: unchanged', () => {
  const right = playBoth([[250, 'good']]);
  assert.equal(right.points, 1);
  assert.equal(right.due, 1);
  assert.deepEqual(right.a.targets.map((x) => x.counted), [true, true]);
  const none = playBoth([]);
  assert.equal(none.points, 0);
  assert.equal(none.due, 1, 'a missed happy mole still counts when the sad mole was left alone');
  assert.equal(none.health, -3, 'and costs the default 3 health');
});

test('single-mole trials are never voided', () => {
  const config = cfg();
  const schedule = buildSchedule(config);
  const { trials } = simulateRun({ config, trials: schedule });
  const single = trials.filter((t) => t.type !== 'both').flatMap((t) => t.targets);
  assert.ok(single.every((x) => x.counted === true));
});

test('the JSON log marks which moles counted', () => {
  const r = playBoth([[200, 'bad'], [400, 'good']]);
  const log = buildFullLog({ config: r.config, trials: r.trials, events: r.events, frameStats: null, userAgent: 'x', created: 'c' });
  const row = log.trials.find((t) => t.trial === r.a.trial);
  assert.deepEqual(row.targets.map((x) => [x.valence, x.counted]), [['good', false], ['bad', true]]);
  assert.ok(log.trials.filter((t) => t.trial !== r.a.trial).every((t) => t.targets.every((x) => x.counted === true)));
});
