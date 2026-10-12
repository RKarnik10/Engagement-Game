// Worker: the display opened from a labmate link, every feedback variant on.
import { parentPort, workerData } from 'node:worker_threads';
import { installDom, installClock } from './_dom.js';

const { $, keydown, created } = installDom({ search: workerData.search, href: 'https://example.org/Engagement-Game/display.html' });
const clock = installClock();
await import('../../src/display.js');
const { resolveConfig } = await import('../../src/config.js');
const { configFromQuery } = await import('../../src/query.js');
const { buildSchedule } = await import('../../src/schedule.js');

const out = { idleText: $('ov-body').innerHTML, scoreHiddenIdle: $('score').hidden };
keydown('t');
out.started = !!clock.pending;
const sched = buildSchedule(resolveConfig(configFromQuery(workerData.search)));
const goods = sched.filter((t) => t.type === 'good').slice(0, 3);
const bad = sched.find((t) => t.type === 'bad');
const plan = [
  ...goods.map((t) => ({ at: t.scheduledOnsetMs + 300, key: String(t.targets[0].response + 1), hole: t.targets[0].hole, kind: 'hit' })),
  { at: bad.scheduledOnsetMs + 300, key: String(bad.targets[0].response + 1), hole: bad.targets[0].hole, kind: 'com' },
].sort((a, b) => a.at - b.at);
out.presses = [];
while (clock.pending) {
  if (plan.length && clock.now >= plan[0].at) {
    const p = plan.shift();
    keydown(p.key);
    const h = $('holes').children[p.hole];
    out.presses.push({
      kind: p.kind, ring: h.classList.contains('fx-hit') ? 'white' : h.classList.contains('fx-com') ? 'red' : null,
      swing: h.classList.contains('swing'), score: $('score').textContent, scoreHidden: $('score').hidden,
    });
  }
  clock.frame();
}
await new Promise((r) => setTimeout(r, 20));
$('dl-csv').click();
out.resultsHidden = $('results').hidden;
out.summary = $('results-summary').textContent;
out.download = created.filter((e) => e.tagName === 'A').at(-1)?.download;
parentPort.postMessage(out);
setTimeout(() => process.exit(0), 10);
