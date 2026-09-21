import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import {
  CSV_COLUMNS, TSV_COLUMNS, buildRunCSV, buildEventsTSV, buildFullLog, buildFullLogJSON,
  exportFilename, trialTable, shownTrials,
} from '../src/export.js';
import { simulateRun } from './_sim.js';

function sampleRun(extra = {}) {
  const config = resolveConfig({ seed: 1234, nTrials: 40, ...extra });
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  const ng = schedule.find((t) => t.type === 'nogo');
  const wrong = schedule[1];
  const presses = [
    { tMs: t1.scheduledOnsetMs + 300, button: t1.response, source: 'key 1' },
    { tMs: wrong.scheduledOnsetMs + 120, button: (wrong.response + 1) % 3, source: 'key x' },
    { tMs: ng.scheduledOnsetMs + 200, button: ng.response, source: 'key 2' },
    { tMs: 500, button: 0, source: 'key 1' },
  ];
  return { config, ...simulateRun({ config, trials: schedule, presses }) };
}

function readTable(text, sep) {
  const lines = text.split('\n');
  assert.equal(lines.at(-1), '', 'file ends with a newline');
  lines.pop();
  return { header: lines[0].split(sep), rows: lines.slice(1).map((l) => l.split(sep)) };
}

test('export: the run CSV has the columns Dr. Song asked for', () => {
  const { trials } = sampleRun();
  const { header, rows } = readTable(buildRunCSV(trials), ',');
  assert.deepEqual(header, [...CSV_COLUMNS]);
  // Which mole appeared (row and column), what should be pressed, what was
  // pressed, and the reaction time.
  for (const col of ['mole_row', 'mole_col', 'stimulus', 'expected_button', 'pressed_button', 'response_time_ms']) {
    assert.ok(header.includes(col), `${col} is present`);
  }
  assert.equal(rows.length, shownTrials(trials).length);
  for (const r of rows) assert.equal(r.length, header.length);
});

test('export: run CSV cell contents are correct', () => {
  const { trials } = sampleRun();
  const { header, rows } = readTable(buildRunCSV(trials), ',');
  const col = (r, name) => r[header.indexOf(name)];

  for (const r of rows) {
    assert.ok(['happy mole', 'sad mole', 'molerat'].includes(col(r, 'stimulus')));
    assert.equal(col(r, 'trial_type'), col(r, 'stimulus') === 'happy mole' ? 'go' : 'nogo');
    const row = Number(col(r, 'mole_row'));
    const cl = Number(col(r, 'mole_col'));
    assert.ok(row >= 1 && row <= 3, 'row is 1 to 3');
    assert.ok(cl >= 1 && cl <= 3, 'column is 1 to 3');
    assert.equal(Number(col(r, 'expected_button')), cl, 'the expected button is the column');
    assert.equal(Number(col(r, 'hole')), (row - 1) * 3 + cl);
    const outcome = col(r, 'outcome');
    if (['hit', 'commission'].includes(outcome)) {
      assert.match(col(r, 'response_time_ms'), /^\d+$/, 'reaction time in whole milliseconds');
      assert.equal(col(r, 'pressed_button'), col(r, 'expected_button'));
    } else {
      assert.equal(col(r, 'response_time_ms'), 'n/a');
      assert.equal(col(r, 'pressed_button'), 'n/a');
    }
    assert.equal(col(r, 'correct'), ['hit', 'correct_rejection'].includes(outcome) ? '1' : '0');
    if (col(r, 'trial_type') === 'nogo') assert.match(col(r, 'preceding_go'), /^\d+$/);
    else assert.equal(col(r, 'preceding_go'), 'n/a');
    assert.ok(Number(col(r, 'onset_lag_ms')) >= 0, 'onset is never before the scheduled time');
  }

  const first = rows[0];
  assert.equal(col(first, 'trial'), '1');
  assert.equal(col(first, 'onset_s'), '2.000');
  assert.equal(col(first, 'stimulus'), 'happy mole');
  assert.equal(col(first, 'outcome'), 'hit');
  assert.equal(col(first, 'response_time_ms'), '300');
  assert.equal(col(first, 'correct'), '1');
  assert.ok(rows.some((r) => col(r, 'outcome') === 'commission'));
  assert.ok(rows.some((r) => col(r, 'stimulus') === 'sad mole' || col(r, 'stimulus') === 'molerat'));
});

test('export: the events TSV keeps the BIDS layout with the new columns', () => {
  const { trials } = sampleRun();
  const { header, rows } = readTable(buildEventsTSV(trials), '\t');
  assert.deepEqual(header, [...TSV_COLUMNS]);
  assert.equal(header[0], 'onset');
  assert.equal(header[1], 'duration');
  const numeric = /^-?\d+\.\d{3}$/;
  for (const r of rows) {
    assert.match(r[header.indexOf('onset')], numeric);
    assert.match(r[header.indexOf('duration')], numeric);
    assert.match(r[header.indexOf('scheduled_onset')], numeric);
    assert.ok(['go', 'nogo'].includes(r[header.indexOf('trial_type')]));
    assert.ok(['mole_happy', 'mole_sad', 'molerat'].includes(r[header.indexOf('stimulus')]));
  }
});

test('export: a stopped run exports only shown trials, with the truncated one included', () => {
  const config = resolveConfig({ seed: 7, nTrials: 40 });
  const schedule = buildSchedule(config);
  const stopAt = schedule[1].scheduledOnsetMs + 100;
  const { trials } = simulateRun({ config, trials: schedule, stopAt });
  const { header, rows } = readTable(buildRunCSV(trials), ',');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][header.indexOf('outcome')], 'truncated');
  assert.equal(rows[1][header.indexOf('correct')], 'n/a', 'a cut-off trial is neither right nor wrong');
});

test('export: full JSON log parses and carries metadata, trial table, and events', () => {
  const { config, trials, events, engine } = sampleRun();
  const log = JSON.parse(buildFullLogJSON({
    config, trials, events, frameStats: engine.frameStats(), userAgent: 'node-test', created: '2026-09-21T12:00:00.000Z',
  }));
  assert.deepEqual(Object.keys(log), ['meta', 'trials', 'events']);
  assert.equal(log.meta.version, '0.2');
  assert.equal(log.meta.setting, 'behavioral');
  assert.equal(log.meta.in_scanner, 0, 'behavioral is logged as 0');
  assert.match(log.meta.response_note, /column/);
  assert.deepEqual(log.meta.config, JSON.parse(JSON.stringify(config)));
  assert.deepEqual(Object.keys(log.meta.frame_stats).sort(), ['frames', 'intervals_over_20ms', 'max_interval_ms', 'mean_interval_ms']);
  const t0 = log.trials[0];
  assert.deepEqual(Object.keys(t0), [
    'trial', 'type', 'stimulus', 'hole', 'row', 'col', 'expected_button', 'pressed_button',
    'scheduled_onset_ms', 'actual_onset_ms', 'offset_ms', 'outcome', 'rt_ms', 'preceding_go', 'input',
  ]);
  assert.equal(t0.outcome, 'hit');
  assert.equal(t0.rt_ms, 300);
  assert.equal(t0.input, 'key 1');
  assert.equal(log.events[0].event, 'trigger');
  assert.equal(log.events.at(-1).event, 'run_end');
  assert.ok(log.events.some((e) => e.event === 'wrong_hole'));
  assert.ok(log.events.some((e) => e.event === 'no_target_press'));
});

test('export: the scanner setting is logged as 1', () => {
  const { config, trials, events } = sampleRun({ setting: 'scanner' });
  const log = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  assert.equal(log.meta.setting, 'scanner');
  assert.equal(log.meta.in_scanner, 1);
});

test('export: builders are pure (same input, same output)', () => {
  const { config, trials, events } = sampleRun();
  const a = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  const b = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  assert.deepEqual(a, b);
  assert.deepEqual(trialTable(trials), trialTable(trials));
  assert.equal(buildRunCSV(trials), buildRunCSV(trials));
});

test('export: file names carry date, time, setting, seed, and kind', () => {
  const config = resolveConfig({ seed: 42, setting: 'scanner' });
  const d = new Date(2026, 8, 21, 14, 5, 2);
  assert.equal(exportFilename(config, 'run', d), 'engagement-game_20260921-140502_scanner_seed42_run.csv');
  assert.equal(exportFilename(config, 'events', d), 'engagement-game_20260921-140502_scanner_seed42_events.tsv');
  assert.equal(exportFilename(config, 'log', d), 'engagement-game_20260921-140502_scanner_seed42_log.json');
  assert.throws(() => exportFilename(config, 'nope', d), /unknown file kind/);
});
