import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import {
  TSV_COLUMNS, buildEventsTSV, buildFullLog, buildFullLogJSON, exportFilename, trialTable, shownTrials,
} from '../src/export.js';
import { simulateRun } from './_sim.js';

function sampleRun(extra = {}) {
  const config = resolveConfig({ seed: 1234, durationS: 30, ...extra });
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  const ng = schedule.find((t) => t.type === 'nogo');
  const presses = [
    { tMs: t1.scheduledOnsetMs + 300, hole: t1.hole, source: 'key 1' },
    { tMs: ng.scheduledOnsetMs + 200, hole: ng.hole, source: 'key 2' },
    { tMs: 500, hole: 0, source: 'key 1' },
  ];
  const sim = simulateRun({ config, trials: schedule, presses });
  return { config, ...sim };
}

/** Minimal TSV reader in the spirit of pandas.read_csv(sep='\t', na_values='n/a'). */
function readTSV(text) {
  const lines = text.split('\n');
  assert.equal(lines.at(-1), '', 'file ends with a newline');
  lines.pop();
  const header = lines[0].split('\t');
  const rows = lines.slice(1).map((l) => l.split('\t'));
  return { header, rows };
}

test('export: TSV header, width, and trailing newline', () => {
  const { config, trials } = sampleRun();
  const tsv = buildEventsTSV(trials, config.keys);
  const { header, rows } = readTSV(tsv);
  assert.deepEqual(header, [...TSV_COLUMNS]);
  assert.equal(header.length, 9);
  assert.equal(rows.length, shownTrials(trials).length);
  for (const r of rows) assert.equal(r.length, 9, `row has 9 fields: ${r.join('|')}`);
  assert.ok(!tsv.includes('\r'));
});

test('export: TSV cell contents follow README 4.5', () => {
  const { config, trials } = sampleRun();
  const { header, rows } = readTSV(buildEventsTSV(trials, config.keys));
  const col = (r, name) => r[header.indexOf(name)];
  const numeric = /^-?\d+\.\d{3}$/;
  for (const r of rows) {
    assert.match(col(r, 'onset'), numeric);
    assert.match(col(r, 'duration'), numeric);
    assert.match(col(r, 'scheduled_onset'), numeric);
    assert.ok(['go', 'nogo'].includes(col(r, 'trial_type')));
    const hole = Number(col(r, 'hole'));
    assert.ok(hole >= 1 && hole <= config.keys.length, 'hole is 1-based');
    assert.equal(col(r, 'key'), config.keys[hole - 1]);
    assert.ok(['hit', 'omission', 'commission', 'correct_rejection', 'truncated'].includes(col(r, 'outcome')));
    const rt = col(r, 'response_time');
    if (['hit', 'commission'].includes(col(r, 'outcome'))) assert.match(rt, numeric);
    else assert.equal(rt, 'n/a');
    const pg = col(r, 'preceding_go');
    if (col(r, 'trial_type') === 'nogo') assert.match(pg, /^\d+$/);
    else assert.equal(pg, 'n/a');
    assert.ok(Number(col(r, 'onset')) >= Number(col(r, 'scheduled_onset')));
  }
  // First trial: hit at +300 ms on hole 1, key "1".
  const first = rows[0];
  assert.equal(col(first, 'onset'), '2.000');
  assert.equal(col(first, 'duration'), '0.300');
  assert.equal(col(first, 'trial_type'), 'go');
  assert.equal(col(first, 'hole'), '1');
  assert.equal(col(first, 'key'), '1');
  assert.equal(col(first, 'outcome'), 'hit');
  assert.equal(col(first, 'response_time'), '0.300');
  assert.equal(col(first, 'scheduled_onset'), '2.000');
  assert.equal(col(first, 'preceding_go'), 'n/a');
  assert.ok(rows.some((r) => col(r, 'outcome') === 'commission'));
});

test('export: a stopped run exports only shown trials, with the truncated one included', () => {
  const config = resolveConfig({ seed: 7, durationS: 30 });
  const schedule = buildSchedule(config);
  const stopAt = schedule[1].scheduledOnsetMs + 100;
  const { trials } = simulateRun({ config, trials: schedule, stopAt });
  const { rows, header } = readTSV(buildEventsTSV(trials, config.keys));
  assert.equal(rows.length, 2);
  assert.equal(rows[1][header.indexOf('outcome')], 'truncated');
  // Duration runs from the actual (frame-locked) onset to the stop time.
  const expected = ((stopAt - trials[1].actualOnsetMs) / 1000).toFixed(3);
  assert.equal(rows[1][header.indexOf('duration')], expected);
  assert.equal(rows[1][header.indexOf('response_time')], 'n/a');
});

test('export: full JSON log parses and carries metadata, trial table, and events', () => {
  const { config, trials, events, engine } = sampleRun();
  const text = buildFullLogJSON({
    config, trials, events, frameStats: engine.frameStats(), userAgent: 'node-test', created: '2026-09-18T12:00:00.000Z',
  });
  const log = JSON.parse(text);
  assert.deepEqual(Object.keys(log), ['meta', 'trials', 'events']);
  assert.equal(log.meta.version, '0.1');
  assert.equal(log.meta.user_agent, 'node-test');
  assert.equal(log.meta.created, '2026-09-18T12:00:00.000Z');
  assert.deepEqual(log.meta.config, JSON.parse(JSON.stringify(config)));
  assert.deepEqual(Object.keys(log.meta.frame_stats).sort(), ['frames', 'intervals_over_20ms', 'max_interval_ms', 'mean_interval_ms']);
  assert.equal(log.trials.length, shownTrials(trials).length);
  const t0 = log.trials[0];
  assert.deepEqual(Object.keys(t0), ['trial', 'type', 'hole', 'scheduled_onset_ms', 'actual_onset_ms', 'offset_ms', 'outcome', 'rt_ms', 'preceding_go', 'input']);
  assert.equal(t0.trial, 1);
  assert.equal(t0.hole, trials[0].hole + 1);
  assert.equal(t0.outcome, 'hit');
  assert.equal(t0.rt_ms, 300);
  assert.equal(t0.input, 'key 1');
  assert.equal(t0.preceding_go, null);
  const ng = log.trials.find((t) => t.type === 'nogo');
  assert.equal(typeof ng.preceding_go, 'number');
  assert.equal(log.events[0].event, 'trigger');
  assert.equal(log.events.at(-1).event, 'run_end');
  for (const e of log.events) {
    assert.equal(typeof e.t_ms, 'number');
    assert.equal(typeof e.event, 'string');
  }
  assert.ok(log.events.some((e) => e.event === 'volume' && e.simulated === true));
  assert.ok(log.events.some((e) => e.event === 'no_target_press'));
});

test('export: trialTable and buildFullLog are pure (same input, same output)', () => {
  const { config, trials, events } = sampleRun();
  const a = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  const b = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  assert.deepEqual(a, b);
  assert.equal(a.meta.frame_stats, null);
  assert.deepEqual(trialTable(trials), trialTable(trials));
});

test('export: file names carry date, time, seed, and kind', () => {
  const config = resolveConfig({ seed: 42 });
  const d = new Date(2026, 8, 18, 14, 5, 2);
  assert.equal(exportFilename(config, 'events', d), 'engagement-game_20260918-140502_seed42_events.tsv');
  assert.equal(exportFilename(config, 'log', d), 'engagement-game_20260918-140502_seed42_log.json');
});
