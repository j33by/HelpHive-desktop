// Copies renderer/ to www/ for the Android (Capacitor) build.
// Electron keeps its strict CSP (no network from the page). The phone build lets the page call
// your server over https; requests go through CapacitorHttp, so no CORS setup is needed.
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'renderer');
const out = path.join(__dirname, '..', 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

const file = path.join(out, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const before = html;
html = html.replace("connect-src 'none'", "connect-src https: http://localhost:* http://127.0.0.1:*");
if (html === before) throw new Error('CSP line not found in index.html');
fs.writeFileSync(file, html);
console.log('www/ ready');
