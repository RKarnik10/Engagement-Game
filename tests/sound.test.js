/**
 * The feedback sounds (October 26, 2026): a "bonk" for a hit, a bonk plus a
 * low buzz for a mistake, optionally delayed to the hammer's landing.
 * Uses a fake AudioContext; no real audio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const played = [];
class FakeAudio {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  resume() { return Promise.resolve(); }
  createGain() { const p = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; return { gain: p, connect: (x) => x }; }
  createOscillator() {
    const o = {
      type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x) => x, stop() {},
      start(t) { played.push([o.type, +(t ?? 0).toFixed(3)]); },
    };
    return o;
  }
}
globalThis.AudioContext = FakeAudio;
const { createSounds } = await import('../src/render/sound.js');
const take = () => played.splice(0);

test('sound: silent until unlocked by a key press or click', () => {
  const s = createSounds();
  assert.equal(s.play('good'), false);
  assert.deepEqual(take(), []);
  assert.equal(s.unlock(), true);
  assert.equal(s.play('good'), true);
});

test('sound: a hit is a bonk (a low sine thump and a short triangle click), not the old ding-ding', () => {
  const s = createSounds();
  s.unlock();
  take();
  s.play('good');
  assert.deepEqual(take(), [['sine', 0], ['triangle', 0]]);
});

test('sound: hitting a sad mole is the same bonk plus a low square buzz just after it', () => {
  const s = createSounds();
  s.unlock();
  take();
  s.play('bad');
  assert.deepEqual(take(), [['sine', 0], ['triangle', 0], ['square', 0.05]]);
});

test('sound: with the hammer on, everything is delayed to the hammer landing', () => {
  const s = createSounds();
  s.unlock();
  take();
  s.play('good', 0.09);
  assert.deepEqual(take(), [['sine', 0.09], ['triangle', 0.09]]);
  s.play('bad', 0.09);
  assert.deepEqual(take(), [['sine', 0.09], ['triangle', 0.09], ['square', 0.14]]);
});
