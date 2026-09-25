/**
 * Local server for the src/ build: `npm run serve`, then open
 * http://localhost:8000/ .
 *
 * No dependencies. Unlike `python3 -m http.server`, it tells the browser
 * never to cache (Cache-Control: no-store), so a normal reload always shows
 * the latest code. Browsers otherwise reuse old copies of the modules and
 * the page can look unchanged after an update.
 *
 * PORT=8080 npm run serve   to use another port.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const PORT = Number(process.env.PORT) || 8000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad request');
    return;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, `.${rel}`);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use, probably by an earlier server.`);
    console.error('Stop it (Ctrl+C in its terminal), or run: PORT=8080 npm run serve');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Experimenter console:  http://localhost:${PORT}/`);
  console.log(`Participant display:   opens from the console, or http://localhost:${PORT}/display.html`);
  console.log('Press Ctrl+C to stop.');
});
