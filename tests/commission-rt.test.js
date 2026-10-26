import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../src/config.js';
import { buildSchedule } from '../src/schedule.js';
import { summarize } from '../src/summary.js';
import { simulateRun } from './_sim.js';

test('sad-mole RTs are averaged separately for bad-only and both trials', () => {
  const config = resolveConfig({ nTrials: 60 });
  const schedule = buildSchedule(config);
  const presses = [];
  for (const t of schedule) {
    const onset = config.firstOnsetMs + (t.trial - 1) * config.trialMs;
    const bad = t.targets.find((x) => x.valence === 'bad');
    const good = t.targets.find((x) => x.valence === 'good');
    if (t.type === 'bad') presses.push({ tMs: onset + 300, button: bad.response });
    if (t.type === 'both') {
      presses.push({ tMs: onset + 250, button: good.response });
      presses.push({ tMs: onset + 500, button: bad.response });
    }
  }
  const { trials } = simulateRun({ config, trials: schedule, presses });
  const s = summarize(trials);
  const nBad = schedule.filter((t) => t.type === 'bad').length;
  const nBoth = schedule.filter((t) => t.type === 'both').length;
  assert.equal(s.comRtsBad.length, nBad);
  assert.equal(s.comRtsBoth.length, nBoth);
  assert.ok(nBad > 0 && nBoth > 0);
  assert.ok(Math.abs(s.meanComRtBad - 300) < 15);
  assert.ok(Math.abs(s.meanComRtBoth - 500) < 15);
});
