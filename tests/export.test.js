import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import {
  CSV_COLUMNS, TSV_COLUMNS, buildRunCSV, buildEventsTSV, buildFullLog, buildFullLogJSON,
  exportFilename, shownTrials,
} from '../src/export.js';
import { simulateRun } from './_sim.js';

/** A run with a hit, a pressed bad mole, a both trial answered right, a wrong column, and a stray press. */
function sampleRun(extra = {}) {
  const config = resolveConfig({ seed: 1234, nTrials: 60, ...extra });
  const schedule = buildSchedule(config);
  const t1 = schedule[0];
  const bad = schedule.find((t) => t.type === 'bad');
  const both = schedule.find((t) => t.type === 'both');
  const wrong = schedule[1];
  const presses = [
    { tMs: t1.scheduledOnsetMs + 300, button: t1.targets[0].response, source: 'key 1' },
    { tMs: wrong.scheduledOnsetMs + 120, button: (wrong.targets[0].response + 1) % 3, source: 'key x' },
    { tMs: wrong.scheduledOnsetMs + 350, button: wrong.targets[0].response, source: 'key y' },
    { tMs: bad.scheduledOnsetMs + 200, button: bad.targets[0].response, source: 'key 2' },
    { tMs: both.scheduledOnsetMs + 330, button: both.targets[0].response, source: 'key 3' },
    { tMs: 500, button: 0, source: 'key 1' },
  ];
  return { config, schedule, ...simulateRun({ config, trials: schedule, presses }) };
}

function readTable(text, sep) {
  const lines = text.split('\n');
  assert.equal(lines.at(-1), '', 'file ends with a newline');
  lines.pop();
  const header = lines[0].split(sep);
  const rows = lines.slice(1).map((l) => l.split(sep));
  const get = (r, name) => r[header.indexOf(name)];
  return { header, rows, get };
}

test('export: the run CSV has what Dr. Song asked for', () => {
  const { trials } = sampleRun();
  const { header, rows } = readTable(buildRunCSV(trials), ',');
  assert.deepEqual(header, [...CSV_COLUMNS]);
  // Which mole appeared (row and column), what should be pressed, what was pressed, reaction time.
  for (const c of ['good_row', 'good_col', 'bad_row', 'bad_col', 'expected_button', 'pressed_buttons', 'first_press_ms', 'good_hit_ms']) {
    assert.ok(header.includes(c), `${c} is present`);
  }
  assert.equal(rows.length, shownTrials(trials).length);
  for (const r of rows) assert.equal(r.length, header.length);
});

test('export: run CSV rows are right for each trial type', () => {
  const { trials, schedule } = sampleRun();
  const { rows, get } = readTable(buildRunCSV(trials), ',');
  const row = (n) => rows[n - 1];

  for (const r of rows) {
    const type = get(r, 'trial_type');
    assert.ok(['good', 'bad', 'both'].includes(type));
    const hasGood = type !== 'bad';
    const hasBad = type !== 'good';
    assert.equal(get(r, 'good_row') !== 'n/a', hasGood);
    assert.equal(get(r, 'bad_row') !== 'n/a', hasBad);
    assert.equal(get(r, 'correct_action'), hasGood ? 'press' : 'withhold');
    assert.equal(get(r, 'expected_button'), hasGood ? get(r, 'good_col') : 'n/a', 'expected button is the good mole\'s column');
    if (type === 'both') assert.notEqual(get(r, 'good_col'), get(r, 'bad_col'));
  }

  // Trial 1: good mole hit at 300 ms.
  assert.equal(get(row(1), 'onset_s'), '2.000');
  assert.equal(get(row(1), 'pressed_buttons'), get(row(1), 'expected_button'));
  assert.equal(get(row(1), 'first_press_ms'), '300');
  assert.equal(get(row(1), 'good_hit_ms'), '300');
  assert.deepEqual([get(row(1), 'outcome'), get(row(1), 'correct')], ['hit', '1']);

  // Trial 2: wrong column first, then the right one; every press is listed in order.
  const w = schedule[1].targets[0];
  assert.equal(get(row(2), 'pressed_buttons'), `${((w.response + 1) % 3) + 1} ${w.response + 1}`);
  assert.equal(get(row(2), 'first_press_ms'), '120');
  assert.equal(get(row(2), 'good_hit_ms'), '350');
  assert.equal(get(row(2), 'outcome'), 'hit');

  // The bad trial that was pressed.
  const badRow = rows.find((r) => get(r, 'trial_type') === 'bad' && get(r, 'pressed_buttons') !== 'n/a');
  assert.deepEqual([get(badRow, 'bad_outcome'), get(badRow, 'outcome'), get(badRow, 'correct')], ['commission', 'commission', '0']);
  assert.equal(get(badRow, 'good_hit_ms'), 'n/a');
  assert.match(get(badRow, 'preceding_go'), /^\d+$/);

  // The both trial answered right: good hit, bad left alone.
  const bothRow = rows.find((r) => get(r, 'trial_type') === 'both');
  assert.deepEqual(
    [get(bothRow, 'good_outcome'), get(bothRow, 'bad_outcome'), get(bothRow, 'outcome'), get(bothRow, 'correct')],
    ['hit', 'correct_rejection', 'hit', '1'],
  );
  assert.equal(get(bothRow, 'good_hit_ms'), '330');
});

test('export: the events TSV keeps the BIDS layout', () => {
  const { trials } = sampleRun();
  const { header, rows, get } = readTable(buildEventsTSV(trials), '\t');
  assert.deepEqual(header, [...TSV_COLUMNS]);
  assert.deepEqual(header.slice(0, 2), ['onset', 'duration']);
  const numeric = /^\d+\.\d{3}$/;
  for (const r of rows) {
    assert.match(get(r, 'onset'), numeric);
    assert.match(get(r, 'duration'), numeric);
    assert.ok(['good', 'bad', 'both'].includes(get(r, 'trial_type')));
  }
});

test('export: a stopped run exports only shown trials; a cut-off trial is neither right nor wrong', () => {
  const config = resolveConfig({ seed: 7, nTrials: 40 });
  const schedule = buildSchedule(config);
  const { trials } = simulateRun({ config, trials: schedule, stopAt: schedule[1].scheduledOnsetMs + 100 });
  const { rows, get } = readTable(buildRunCSV(trials), ',');
  assert.equal(rows.length, 2);
  assert.deepEqual([get(rows[1], 'outcome'), get(rows[1], 'correct')], ['truncated', 'n/a']);
});

test('export: full JSON log parses and carries metadata, the trial table with moles and presses, and events', () => {
  const { config, trials, events, engine } = sampleRun();
  const log = JSON.parse(buildFullLogJSON({
    config, trials, events, frameStats: engine.frameStats(), userAgent: 'node-test', created: '2026-09-25T12:00:00.000Z',
  }));
  assert.deepEqual(Object.keys(log), ['meta', 'trials', 'events']);
  assert.equal(log.meta.version, '0.3');
  assert.equal(log.meta.in_scanner, 0);
  assert.deepEqual(log.meta.trial_mix, { good: 0.8, bad: 0.1, both: 0.1 });
  assert.equal(log.meta.bad_stimulus, 'mole_sad');
  const both = log.trials.find((t) => t.type === 'both');
  assert.equal(both.targets.length, 2);
  assert.deepEqual(Object.keys(both.targets[0]), ['target', 'valence', 'stimulus', 'hole', 'row', 'col', 'button', 'outcome', 'rt_ms', 'offset_ms', 'input']);
  assert.deepEqual(log.trials[1].presses.map((p) => p.outcome), ['wrong_hole', 'hit']);
  assert.equal(log.events[0].event, 'trigger');
  assert.equal(log.events.at(-1).event, 'run_end');
  assert.ok(log.events.some((e) => e.event === 'trial_end'));
});

test('export: the scanner setting is logged as 1', () => {
  const { config, trials, events } = sampleRun({ setting: 'scanner' });
  const log = buildFullLog({ config, trials, events, frameStats: null, userAgent: 'x', created: 'c' });
  assert.equal(log.meta.in_scanner, 1);
});

test('export: builders are pure (same input, same output)', () => {
  const { config, trials, events } = sampleRun();
  const run = { config, trials, events, frameStats: null, userAgent: 'x', created: 'c' };
  assert.deepEqual(buildFullLog(run), buildFullLog(run));
  assert.equal(buildRunCSV(trials), buildRunCSV(trials));
});

test('export: file names carry date, time, setting, seed, and kind', () => {
  const config = resolveConfig({ seed: 42, setting: 'scanner' });
  const d = new Date(2026, 8, 25, 14, 5, 2);
  assert.equal(exportFilename(config, 'run', d), 'engagement-game_20260925-140502_scanner_seed42_run.csv');
  assert.equal(exportFilename(config, 'events', d), 'engagement-game_20260925-140502_scanner_seed42_events.tsv');
  assert.equal(exportFilename(config, 'log', d), 'engagement-game_20260925-140502_scanner_seed42_log.json');
  assert.throws(() => exportFilename(config, 'nope', d), /unknown file kind/);
});
