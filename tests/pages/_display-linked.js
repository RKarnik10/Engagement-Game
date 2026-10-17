// Worker: a display tab controlled by a console. It plays a few hits, pauses
// with P, resumes, and keeps going until the console ends the run.
import { parentPort } from 'node:worker_threads';
import { installDom, installClock } from './_dom.js';

const { $, keydown } = installDom({ href: 'http://localhost:8000/display.html' });
const clock = installClock();
await import('../../src/display.js');
const { resolveConfig } = await import('../../src/config.js');
const { buildSchedule } = await import('../../src/schedule.js');
const yieldNow = () => new Promise((r) => setTimeout(r, 1));
parentPort.postMessage({ kind: 'loaded', idleText: $('ov-body').innerHTML });

while (!clock.pending) await yieldNow();
const sched = buildSchedule(resolveConfig({ nTrials: 30, seed: 1234, showScore: true }));
const goods = sched.filter((t) => t.type === 'good').slice(0, 6);
let pausedMs = 0;
const play = () => {
  const t = goods.find((g) => !g.done && clock.now - pausedMs >= g.scheduledOnsetMs + 300);
  if (t) { t.done = true; keydown(String(t.targets[0].response + 1)); }
};
while (clock.pending && clock.now < 3500) { play(); clock.frame(); }
keydown('p');
const paused = { title: $('ov-title').textContent, framesStopped: !clock.pending };
clock.now += 2000; pausedMs = 2000;
keydown('p');
paused.resumed = $('overlay').hidden;
parentPort.postMessage({ kind: 'paused', ...paused, score: $('score-text').textContent });
let told = false;
let n = 0;
while (clock.pending) {
  play(); clock.frame(); n++;
  if (!told && clock.now - pausedMs > 8500) { told = true; parentPort.postMessage({ kind: 'midrun' }); }
  if (n % 30 === 0) await yieldNow();   // let the console's messages in
}
await new Promise((r) => setTimeout(r, 30));
parentPort.postMessage({ kind: 'done', title: $('ov-title').textContent, hint: $('hint').textContent, resultsHidden: $('results').hidden });
setTimeout(() => process.exit(0), 20);
