import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { interpretKey } from '../src/input.js';

const row4 = resolveConfig({});
const grid9 = resolveConfig({ layout: 'grid9' });
const custom = resolveConfig({ keys: ['a', 's', 'd', 'f'], triggerKey: '5' });
const k = (key, extra = {}) => ({ key, repeat: false, ...extra });

test('input: idle, the trigger key starts a run (either case), nothing else does', () => {
  assert.deepEqual(interpretKey(k('t'), row4, false), { action: 'trigger', source: 'key t', preventDefault: true });
  assert.equal(interpretKey(k('T'), row4, false).action, 'trigger');
  assert.equal(interpretKey(k('1'), row4, false), null);
  assert.equal(interpretKey(k('Escape'), row4, false), null);
});

test('input: idle, the trigger key is ignored while typing or with modifiers', () => {
  assert.equal(interpretKey(k('t', { typing: true }), row4, false), null);
  assert.equal(interpretKey(k('t', { ctrlKey: true }), row4, false), null);
  assert.equal(interpretKey(k('t', { metaKey: true }), row4, false), null);
  assert.equal(interpretKey(k('t', { altKey: true }), row4, false), null);
});

test('input: running, mapped keys map to 0-based holes in reading order', () => {
  assert.deepEqual(interpretKey(k('1'), row4, true), { action: 'press', hole: 0, source: 'key 1', preventDefault: true });
  assert.equal(interpretKey(k('4'), row4, true).hole, 3);
  assert.equal(interpretKey(k('7'), grid9, true).hole, 0);
  assert.equal(interpretKey(k('5'), grid9, true).hole, 4);
  assert.equal(interpretKey(k('3'), grid9, true).hole, 8);
  assert.equal(interpretKey(k('s'), custom, true).hole, 1);
  assert.equal(interpretKey(k('1'), custom, true), null, 'keys come from config, not the layout');
});

test('input: running, unmapped keys are ignored', () => {
  assert.equal(interpretKey(k('x'), row4, true), null);
  assert.equal(interpretKey(k('5'), row4, true), null);
  assert.equal(interpretKey(k('Enter'), row4, true), null);
});

test('input: held keys (e.repeat) are ignored', () => {
  assert.equal(interpretKey(k('1', { repeat: true }), row4, true), null);
  assert.equal(interpretKey(k('t', { repeat: true }), row4, true), null);
});

test('input: running, Escape stops and the trigger key is a volume pulse', () => {
  assert.deepEqual(interpretKey(k('Escape'), row4, true), { action: 'stop', preventDefault: false });
  assert.deepEqual(interpretKey(k('t'), row4, true), { action: 'pulse', source: 'key t', preventDefault: true });
  assert.equal(interpretKey(k('5'), custom, true).action, 'pulse', 'trigger key from config');
});
