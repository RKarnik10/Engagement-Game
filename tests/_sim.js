/**
 * Test helper: drive the engine under a fake clock and a fake animation-frame
 * loop. Not a test file (no .test.js suffix).
 *
 * presses: [{ tMs, hole, source? }]   pulses: [{ tMs, source? }]
 * frameMs: fixed frame interval; frameJitter(frameIndex) -> ms overrides it.
 * stopAt: call engine.stop('stopped') at this time.
 */
import { createEngine } from '../src/engine.js';
import { createLogger } from '../src/logger.js';

export function simulateRun({ config, trials, presses = [], pulses = [], stopAt = null, frameMs = 10, frameJitter = null }) {
  let now = 0;
  let pending = null;
  const logger = createLogger();
  const engine = createEngine({
    config,
    trials,
    logger,
    clock: () => now,
    raf: (fn) => { pending = fn; return 1; },
    caf: () => { pending = null; },
  });
  engine.start({ source: 'test' });

  const queue = [
    ...presses.map((p) => ({ ...p, kind: 'press' })),
    ...pulses.map((p) => ({ ...p, kind: 'pulse' })),
  ].sort((a, b) => a.tMs - b.tMs);

  let frame = 0;
  while (pending) {
    const step = frameJitter ? frameJitter(frame) : frameMs;
    const next = stopAt != null ? Math.min(now + step, stopAt) : now + step;
    while (queue.length && queue[0].tMs <= next) {
      const ev = queue.shift();
      if (ev.tMs > now) now = ev.tMs;
      if (ev.kind === 'press') engine.press(ev.hole, ev.source || 'key');
      else engine.pulse(ev.source || 'key t');
    }
    if (stopAt != null && next >= stopAt) {
      now = stopAt;
      engine.stop('stopped');
      break;
    }
    now = next;
    frame++;
    const fn = pending;
    pending = null;
    fn();
  }
  return { engine, logger, events: logger.toArray(), trials: engine.trials(), state: engine.getState() };
}
