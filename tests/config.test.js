import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, LAYOUTS, PRESETS, resolveConfig, validateConfig,
  holeCount, buttonCount, responseForHole, holePosition, runDurationMs, trialWindowMs,
} from '../src/config.js';

test('config: defaults are the September 21 and 25, 2026 decisions', () => {
  const c = resolveConfig();
  assert.equal(c.layout, 'grid3x3');
  assert.deepEqual(c.keys, ['1', '2', '3']);
  assert.equal(c.nTrials, 600);
  assert.equal(c.trialMs, 1000);
  assert.equal(c.holdMs, 800);
  assert.equal(c.goodShare, 0.8);
  assert.equal(c.badShare, 0.1);
  assert.equal(c.bothShare, 0.1);
  assert.equal(c.badStim, 'mole_sad');
  assert.equal(c.version, '0.3');
  assert.equal(c.showScore, false, 'no score');
  assert.equal(c.feedback, false, 'no on-screen feedback');
  assert.equal(c.setting, 'behavioral');
  assert.equal(c.durationS, 602, '600 trials of 1 s plus a 2 s lead-in');
  assert.ok(Object.isFrozen(c));
  assert.ok(Object.isFrozen(DEFAULTS));
});

test('config: the 3x3 layout maps nine holes onto three column buttons', () => {
  const c = resolveConfig();
  assert.equal(holeCount(c), 9);
  assert.equal(buttonCount('grid3x3'), 3);
  assert.deepEqual([...LAYOUTS.grid3x3.holeResponse], [0, 1, 2, 0, 1, 2, 0, 1, 2]);
  // Reading order: holes 0,1,2 are row 1; the column decides the button.
  assert.deepEqual(holePosition(c, 0), { row: 1, col: 1 });
  assert.deepEqual(holePosition(c, 4), { row: 2, col: 2 });
  assert.deepEqual(holePosition(c, 8), { row: 3, col: 3 });
  for (const hole of [0, 3, 6]) assert.equal(responseForHole(c, hole), 0, 'column 1 -> button 1');
  for (const hole of [1, 4, 7]) assert.equal(responseForHole(c, hole), 1, 'column 2 -> button 2');
  for (const hole of [2, 5, 8]) assert.equal(responseForHole(c, hole), 2, 'column 3 -> button 3');
});

test('config: keys follow the layout unless given explicitly', () => {
  assert.deepEqual(resolveConfig({ layout: 'grid9' }).keys, [...LAYOUTS.grid9.keys]);
  assert.deepEqual(resolveConfig({ layout: 'row4' }).keys, ['1', '2', '3', '4']);
  assert.deepEqual(resolveConfig({ keys: ['a', 'b', 'c'] }).keys, ['a', 'b', 'c']);
});

test('config: run length is derived from the trial count and cycle', () => {
  const c = resolveConfig();
  assert.equal(runDurationMs(c), 602000);
  assert.equal(trialWindowMs(c), 800);
  assert.equal(trialWindowMs(resolveConfig({ onset: 'gradual', holdMs: 300, rampMs: 350 })), 1000);
  assert.equal(resolveConfig({ nTrials: 60 }).durationS, 62);
});

test('config: presets flip the scanner flag', () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), ['behavioral', 'scanner']);
  assert.equal(resolveConfig({}, 'scanner').setting, 'scanner');
  assert.equal(resolveConfig({}, 'behavioral').setting, 'behavioral');
  assert.throws(() => resolveConfig({}, 'nope'), /Unknown preset/);
});

test('config: validation rejects bad values with a message naming each problem', () => {
  const bad = (p, re) => assert.throws(() => resolveConfig(p), re);
  bad({ goodShare: 0.7 }, /add up to 1/);
  bad({ goodShare: 1.5, badShare: -0.5 }, /each be in \[0, 1\]/);
  bad({ badStim: 'eggplant' }, /badStim/);
  bad({ nTrials: 0 }, /nTrials/);
  bad({ nTrials: 10.5 }, /nTrials/);
  bad({ trialMs: 0 }, /trialMs/);
  bad({ holdMs: 0 }, /holdMs/);
  bad({ firstOnsetMs: -1 }, /firstOnsetMs/);
  bad({ trS: 0 }, /trS/);
  bad({ seed: 1.5 }, /seed/);
  bad({ layout: 'hex' }, /layout/);
  bad({ skin: 'lava' }, /skin/);
  bad({ onset: 'fade' }, /onset/);
  bad({ setting: 'kitchen' }, /setting/);
  bad({ feedback: 'no' }, /feedback/);
  bad({ keys: ['1', '2'] }, /keys must have 3 entries/);
  bad({ keys: ['1', '1', '2'] }, /unique/);
  bad({ triggerKey: '' }, /triggerKey/);
  bad({ triggerKey: '2' }, /collides/);
  assert.throws(() => resolveConfig({ badStim: 'x', holdMs: -1 }), /badStim[\s\S]*holdMs/);
});

test('config: a target may never be up longer than the trial cycle', () => {
  assert.throws(() => resolveConfig({ trialMs: 1000, holdMs: 1200 }), /targets would overlap/);
  // Gradual onset adds a rise and a sink, so it can overflow a 1 s cycle.
  assert.throws(() => resolveConfig({ onset: 'gradual', holdMs: 800, rampMs: 350 }), /targets would overlap/);
  assert.doesNotThrow(() => resolveConfig({ onset: 'gradual', holdMs: 300, rampMs: 350 }));
});

test('config: validateConfig returns the config it was given', () => {
  const c = resolveConfig({ seed: 1 });
  assert.equal(validateConfig(c), c);
});
