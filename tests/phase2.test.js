/**
 * Phase 2: participant and run labels, per-run schedules, and auto-save files.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig, scheduleSeed } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { exportFilename, buildRunCSV, buildFullLog, runFiles } from '../src/export.js';
import { configFromQuery, configToQuery } from '../src/query.js';
import { simulateRun } from './_sim.js';

test('participant and run: defaults, and what is allowed', () => {
  const c = resolveConfig();
  assert.equal(c.participant, '');
  assert.equal(c.run, 1);
  assert.equal(c.seedFromIds, false);
  assert.equal(c.autoSave, true);
  assert.doesNotThrow(() => resolveConfig({ participant: 'P07', run: 12 }));
  for (const bad of ['sub-01', 'with space', 'a_b', 'x'.repeat(33)]) {
    assert.throws(() => resolveConfig({ participant: bad }), /participant must be/, bad);
  }
  for (const bad of [0, 100, 1.5]) assert.throws(() => resolveConfig({ run: bad }), /run must be/, String(bad));
});

test('file names: BIDS-style labels first when there is a participant ID', () => {
  const d = new Date(2026, 9, 17, 9, 30, 0);
  const plain = resolveConfig({ seed: 5, showScore: false, hitRings: false, sound: false, hammer: false });
  assert.equal(exportFilename(plain, 'events', d), 'engagement-game_20261017-093000_behavioral_seed5_events.tsv');
  const labelled = resolveConfig({ seed: 5, showScore: false, hitRings: false, sound: false, hammer: false, participant: '07', run: 2 });
  assert.equal(exportFilename(labelled, 'events', d), 'sub-07_task-whacamole_run-02_20261017-093000_behavioral_seed5_events.tsv');
  assert.equal(exportFilename(resolveConfig({ participant: 'A', run: 11, seed: 5 }), 'run', d),
    'sub-A_task-whacamole_run-11_20261017-093000_behavioral_seed5_score+rings+sound+hammer_run.csv');
});

test('per-run schedules: off, every run gets the seed; on, each participant and run gets its own, reproducibly', () => {
  const base = { seed: 1234, nTrials: 60 };
  assert.equal(resolveConfig({ ...base, participant: '01', run: 1 }).scheduleSeed, 1234, 'off: the seed itself');
  assert.deepEqual(buildSchedule(resolveConfig({ ...base, participant: '01' })), buildSchedule(resolveConfig({ ...base, participant: '02' })),
    'off: everyone gets the same schedule');

  const on = (p) => resolveConfig({ ...base, seedFromIds: true, ...p });
  const a = on({ participant: '01', run: 1 });
  assert.equal(a.scheduleSeed, on({ participant: '01', run: 1 }).scheduleSeed, 'reproducible');
  assert.deepEqual(buildSchedule(a), buildSchedule(on({ participant: '01', run: 1 })));
  const seeds = new Set();
  for (const participant of ['01', '02', '03', '10', 'P1']) {
    for (let run = 1; run <= 6; run++) seeds.add(on({ participant, run }).scheduleSeed);
  }
  assert.equal(seeds.size, 30, 'thirty participant-run pairs, thirty different seeds');
  assert.notDeepEqual(buildSchedule(a), buildSchedule(on({ participant: '01', run: 2 })), 'run 2 differs from run 1');
  assert.ok(Number.isInteger(a.scheduleSeed));
  assert.equal(scheduleSeed({ seed: 9, seedFromIds: false }), 9);
});

test('per-run schedules still follow every rule (80/10/10, lead-in, no two bad in a row)', () => {
  for (const participant of ['01', '02', 'P9']) {
    for (let run = 1; run <= 4; run++) {
      const t = buildSchedule(resolveConfig({ seedFromIds: true, participant, run }));
      const n = (type) => t.filter((x) => x.type === type).length;
      assert.deepEqual([n('good'), n('bad'), n('both')], [480, 60, 60]);
      assert.ok(t.slice(0, 3).every((x) => x.type === 'good'));
      for (let i = 1; i < t.length; i++) assert.ok(!(t[i].type === 'bad' && t[i - 1].type === 'bad'));
    }
  }
});

test('the run table and the log say who and which run', () => {
  const config = resolveConfig({ nTrials: 10, participant: '07', run: 3, seedFromIds: true });
  const { trials, events } = simulateRun({ config, trials: buildSchedule(config) });
  const rows = buildRunCSV(trials, config).trim().split('\n').map((l) => l.split(','));
  assert.deepEqual(rows[0].slice(0, 3), ['participant', 'run', 'trial']);
  assert.ok(rows.slice(1).every((r) => r[0] === '07' && r[1] === '3'));
  const unlabelled = buildRunCSV(trials).trim().split('\n')[1].split(',');
  assert.deepEqual(unlabelled.slice(0, 2), ['n/a', 'n/a'], 'without settings: n/a');
  const log = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  assert.equal(log.meta.participant, '07');
  assert.equal(log.meta.run, 3);
  assert.equal(log.meta.schedule_seed, config.scheduleSeed);
  assert.notEqual(log.meta.schedule_seed, config.seed);
});

test('auto-save: the three files of a run, named for the participant and run', () => {
  const config = resolveConfig({ nTrials: 10, participant: '07', run: 2 });
  const { trials, events } = simulateRun({ config, trials: buildSchedule(config) });
  const files = runFiles({ config, trials, events, frameStats: null, userAgent: 'x', created: '2026-10-17T13:00:00.000Z' });
  assert.equal(files.length, 3);
  assert.deepEqual(files.map((f) => f.name.split('_').at(-1)), ['run.csv', 'events.tsv', 'log.json']);
  assert.ok(files.every((f) => f.name.startsWith('sub-07_task-whacamole_run-02_')));
  assert.deepEqual(files.map((f) => f.mime), ['text/csv', 'text/tab-separated-values', 'application/json']);
  assert.ok(files[0].text.startsWith('participant,run,trial'));
  assert.doesNotThrow(() => JSON.parse(files[2].text));
});

test('links carry participant, run, per-run schedules, and auto-save', () => {
  const c = resolveConfig({ participant: '07', run: 2, seedFromIds: true, autoSave: false });
  const q = configToQuery(c);
  assert.equal(q, '?run=2&sub=07&idseed=1&autosave=0');
  const back = resolveConfig(configFromQuery(q));
  for (const k of ['participant', 'run', 'seedFromIds', 'autoSave', 'scheduleSeed']) assert.deepEqual(back[k], c[k], k);
});
