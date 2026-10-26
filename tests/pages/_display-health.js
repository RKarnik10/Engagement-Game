// Worker: the display opened from a labmate link in the health game style.
import { parentPort, workerData } from 'node:worker_threads';
import { installDom, installClock } from './_dom.js';

const { $, keydown } = installDom({ search: workerData.search, href: 'https://example.org/Engagement-Game/display.html' });
const clock = installClock();
await import('../../src/display.js');
const { resolveConfig } = await import('../../src/config.js');
const { configFromQuery } = await import('../../src/query.js');
const { buildSchedule } = await import('../../src/schedule.js');

const out = { snaps: [] };
const sched = buildSchedule(resolveConfig(configFromQuery(workerData.search)));
const bad = sched.find((t) => t.type === 'bad' && t.trial >= 6);
// Hit every happy mole; hit the sad mole once; leave the other sad moles alone.
const plan = sched.filter((t) => t.type !== 'bad').map((t) => ({
  at: t.scheduledOnsetMs + 300, key: String(t.targets[0].response + 1), tag: 'hit',
}));
plan.push({ at: bad.scheduledOnsetMs + 300, key: String(bad.targets[0].response + 1), tag: 'sad' });
plan.sort((a, b) => a.at - b.at);

const snap = (tag) => out.snaps.push({
  tag, text: `${$('score-label').textContent} ${$('score-value').textContent}`, value: $('score-value').textContent, label: $('score-label').textContent, fill: $('score-fill').style.props.width,
  color: $('score-fill').style.props['background-color'], hurt: $('score').classList.contains('hurt'),
  low: $('score').classList.contains('low'), hidden: $('score').hidden,
});
out.idle = { hidden: $('score').hidden };
keydown('t');
snap('start');
while (clock.pending) {
  if (plan.length && clock.now >= plan[0].at) {
    const p = plan.shift();
    keydown(p.key);
    if (p.tag === 'sad') snap('after the sad mole');
  }
  clock.frame();
}
await new Promise((r) => setTimeout(r, 450));   // real time, so the hurt flash can clear
snap('end');
parentPort.postMessage({ ...out, badTrial: bad.trial });
setTimeout(() => process.exit(0), 10);
