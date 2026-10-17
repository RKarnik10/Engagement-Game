// Worker: the display opened from a labmate link, every feedback variant on.
import { parentPort, workerData } from 'node:worker_threads';
import { installDom, installClock } from './_dom.js';

const { $, keydown, created, tones } = installDom({ search: workerData.search, href: 'https://example.org/Engagement-Game/display.html' });
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
// Plus one press on an empty column while a happy mole is up: it must be silent.
const g4 = sched.filter((t) => t.type === 'good')[3];
const empty = [0, 1, 2].find((c) => c !== g4.targets[0].response);
const plan = [
  { at: g4.scheduledOnsetMs + 150, key: String(empty + 1), hole: g4.targets[0].hole, kind: 'empty' },
  ...goods.map((t) => ({ at: t.scheduledOnsetMs + 300, key: String(t.targets[0].response + 1), hole: t.targets[0].hole, kind: 'hit' })),
  { at: bad.scheduledOnsetMs + 300, key: String(bad.targets[0].response + 1), hole: bad.targets[0].hole, kind: 'com' },
].sort((a, b) => a.at - b.at);
out.presses = [];
while (clock.pending) {
  if (plan.length && clock.now >= plan[0].at) {
    const p = plan.shift();
    const tonesBefore = tones.length;
    keydown(p.key);
    const h = $('holes').children[p.hole];
    const stimNow = h.dataset.stim;
    out.presses.push({
      sounds: tones.slice(tonesBefore).join(','),
      struck: h.classList.contains('struck'), stillShown: !!stimNow,
      kind: p.kind, ring: h.classList.contains('fx-hit') ? 'white' : h.classList.contains('fx-com') ? 'red' : null,
      swing: h.classList.contains('swing'), score: $('score-text').textContent, scoreHidden: $('score').hidden,
      fill: $('score-fill').style.props.width, band: $('score-fill').dataset.band,
      color: $('score-fill').style.props['background-color'],
      roomMade: $('stage').classList.contains('has-score'),
    });
  }
  clock.frame();
}
await new Promise((r) => setTimeout(r, 20));
$('dl-csv').click();
await new Promise((r) => setTimeout(r, 400));   // let the hammer sinks finish
out.leftUp = $('holes').children.filter((h) => h.dataset.stim).length;
out.leftStruck = $('holes').children.filter((h) => h.classList.contains('struck')).length;
out.sceneGarden = $('stage').classList.contains('scene-garden');
out.resultsHidden = $('results').hidden;
out.summary = $('results-summary').textContent;
out.download = created.filter((e) => e.tagName === 'A').at(-1)?.download;
parentPort.postMessage(out);
setTimeout(() => process.exit(0), 10);
