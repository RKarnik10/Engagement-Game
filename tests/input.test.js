import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { interpretKey } from '../src/input.js';

const grid = resolveConfig({});                              // 3 buttons: 1, 2, 3
const perHole = resolveConfig({ layout: 'grid9' });          // 9 keys, one per hole
const custom = resolveConfig({ keys: ['a', 's', 'd'], triggerKey: '5' });
const k = (key, extra = {}) => ({ key, repeat: false, ...extra });

test('input: idle, the trigger key starts a run (either case), nothing else does', () => {
  assert.deepEqual(interpretKey(k('t'), grid, false), { action: 'trigger', source: 'key t', preventDefault: true });
  assert.equal(interpretKey(k('T'), grid, false).action, 'trigger');
  assert.equal(interpretKey(k('1'), grid, false), null);
  assert.equal(interpretKey(k('Escape'), grid, false), null);
});

test('input: idle, the trigger key is ignored while typing or with modifiers', () => {
  assert.equal(interpretKey(k('t', { typing: true }), grid, false), null);
  assert.equal(interpretKey(k('t', { ctrlKey: true }), grid, false), null);
  assert.equal(interpretKey(k('t', { metaKey: true }), grid, false), null);
  assert.equal(interpretKey(k('t', { altKey: true }), grid, false), null);
});

test('input: running, the three keys map to the three column buttons', () => {
  assert.deepEqual(interpretKey(k('1'), grid, true), { action: 'press', button: 0, source: 'key 1', preventDefault: true });
  assert.equal(interpretKey(k('2'), grid, true).button, 1);
  assert.equal(interpretKey(k('3'), grid, true).button, 2);
  assert.equal(interpretKey(k('s'), custom, true).button, 1, 'keys come from config');
  assert.equal(interpretKey(k('1'), custom, true), null);
});

test('input: only mapped keys are recorded; every other key is ignored', () => {
  // Decided September 21, 2026: record the response buttons, nothing else.
  for (const key of ['4', '5', '9', 'x', 'Enter', ' ', 'ArrowLeft']) {
    assert.equal(interpretKey(k(key), grid, true), null, `${key} is ignored`);
  }
  assert.equal(interpretKey(k('7'), perHole, true).button, 0, 'the per-hole layout still maps its own keys');
});

test('input: held keys (e.repeat) are ignored', () => {
  assert.equal(interpretKey(k('1', { repeat: true }), grid, true), null);
  assert.equal(interpretKey(k('t', { repeat: true }), grid, true), null);
});

test('input: running, Escape stops and the trigger key is a volume pulse', () => {
  assert.deepEqual(interpretKey(k('Escape'), grid, true), { action: 'stop', preventDefault: false });
  assert.deepEqual(interpretKey(k('t'), grid, true), { action: 'pulse', source: 'key t', preventDefault: true });
  assert.equal(interpretKey(k('5'), custom, true).action, 'pulse', 'trigger key from config');
});
