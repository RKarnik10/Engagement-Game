// Worker: the experimenter console. Takes commands from the test.
import { parentPort } from 'node:worker_threads';
import { installDom } from './_dom.js';

const formInputs = [
  ['setting', 'behavioral', true], ['goodPct', '80'], ['badPct', '10'], ['bothPct', '10'],
  ['badStim', 'molerat', true], ['layout', 'grid3x3', true], ['onset', 'instant', true],
  ['nTrials', '30'], ['trialMs', '1000'], ['holdMs', '800'], ['tr', '1'], ['seed', '1234'],
  ['showScore', 'on', true], ['hitRings', 'on', true], ['sound', 'on', true], ['hammer', 'on', true], ['participant', '07'], ['run', '2'], ['autoSave', 'on', true],
].map(([name, value, checked]) => ({ name, value, checked, disabled: false }));
const { $, created, clipboard } = installDom({ formInputs, href: 'https://example.org/Engagement-Game/' });
await import('../../src/main.js');

const report = () => ({
  link: $('link-status').textContent, share: $('share-link').value, shareStatus: $('share-status').textContent,
  startDisabled: $('start').disabled, pauseDisabled: $('pause').disabled, summary: $('run-summary').textContent,
  hits: $('m-hit').textContent, pauses: $('m-pauses').textContent, trace: $('chart-data').innerHTML,
  csv: $('export').value.split('\n')[0], dlDisabled: $('dl-csv').disabled, loadCheckHidden: $('load-check').hidden,
  downloads: created.filter((e) => e.tagName === 'A').map((a) => a.download), clipboard: clipboard(),
  saveStatus: $('save-status').textContent, filePreview: $('file-preview').textContent,
});
parentPort.on('message', async (cmd) => {
  if (cmd === 'start') $('start').click();
  if (cmd === 'stop') $('stop').click();
  if (cmd === 'copy') { $('share-copy').click(); await new Promise((r) => setTimeout(r, 5)); }
  if (cmd === 'download') $('dl-csv').click();
  if (cmd === 'touch') $('settings').dispatch('input', {});
  parentPort.postMessage({ kind: 'report', cmd, ...report() });
});
parentPort.postMessage({ kind: 'report', cmd: 'loaded', ...report() });
