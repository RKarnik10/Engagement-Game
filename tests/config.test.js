import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, LAYOUTS, PRESETS, resolveConfig, validateConfig, holeCount } from '../src/config.js';

test('config: defaults match README 6.1', () => {
  const c = resolveConfig();
  assert.deepEqual(c, {
    version: '0.1', skin: 'mole', layout: 'row4', keys: ['1', '2', '3', '4'], triggerKey: 't',
    onset: 'instant', rampMs: 350, goProb: 0.8, holdMs: 900, isiMinMs: 500, isiMaxMs: 1200,
    firstOnsetMs: 2000, durationS: 60, trS: 1.0, showScore: true, seed: 1234,
  });
  assert.ok(Object.isFrozen(c));
  assert.ok(Object.isFrozen(DEFAULTS));
});

test('config: keys follow the layout unless given explicitly', () => {
  assert.deepEqual(resolveConfig({ layout: 'grid9' }).keys, [...LAYOUTS.grid9.keys]);
  assert.deepEqual(resolveConfig({ keys: ['a', 'b', 'c', 'd'] }).keys, ['a', 'b', 'c', 'd']);
  assert.equal(holeCount(resolveConfig({ layout: 'grid9' })), 9);
});

test('config: presets exist and resolve', () => {
  assert.deepEqual(Object.keys(PRESETS).sort(), ['desktop-pilot', 'scanner']);
  assert.equal(resolveConfig({}, 'desktop-pilot').layout, 'row4');
  assert.equal(resolveConfig({ seed: 9 }, 'scanner').seed, 9);
  assert.throws(() => resolveConfig({}, 'nope'), /Unknown preset/);
});

test('config: validation rejects bad values with a message naming each problem', () => {
  const bad = (p, re) => assert.throws(() => resolveConfig(p), re);
  bad({ goProb: 0 }, /goProb/);
  bad({ goProb: 1.5 }, /goProb/);
  bad({ holdMs: 0 }, /holdMs/);
  bad({ holdMs: 900.5 }, /holdMs/);
  bad({ isiMinMs: 800, isiMaxMs: 500 }, /isiMaxMs must be >= isiMinMs/);
  bad({ isiMinMs: -1 }, /isiMinMs/);
  bad({ firstOnsetMs: 1.5 }, /firstOnsetMs/);
  bad({ durationS: 0 }, /durationS/);
  bad({ trS: 0 }, /trS/);
  bad({ seed: 1.5 }, /seed/);
  bad({ layout: 'hex' }, /layout/);
  bad({ skin: 'lava' }, /skin/);
  bad({ onset: 'fade' }, /onset/);
  bad({ showScore: 'yes' }, /showScore/);
  bad({ keys: ['1', '2', '3'] }, /keys must have 4 entries/);
  bad({ keys: ['1', '1', '2', '3'] }, /unique/);
  bad({ triggerKey: '' }, /triggerKey/);
  // README 4.2 gotcha: a trigger box that sends "5" collides with the number-pad layout.
  bad({ layout: 'grid9', triggerKey: '5' }, /collides/);
  assert.throws(() => resolveConfig({ goProb: 2, holdMs: -1 }), /goProb[\s\S]*holdMs/);
});

test('config: validateConfig returns the config it was given', () => {
  const c = resolveConfig({ seed: 1 });
  assert.equal(validateConfig(c), c);
});
