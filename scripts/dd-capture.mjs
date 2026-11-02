#!/usr/bin/env node
/** dd-capture.mjs — drive DataDome's JS Tag (js.datadome.co/tags.js) and capture
 *  the device/behaviour telemetry POSTs + the server-issued `datadome` cookie.
 *  Key: vinted.fr's public DATADOME_CLIENT_SIDE_KEY (from their page HTML). */
import { chromium } from 'playwright';
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';

const DDKEY = process.argv[2] || 'E6EAF460AA2A8322D66B42C85B62F9';
const OUT = '/tmp/opencode/datadome/cap';
mkdirSync(OUT, { recursive: true });

const srv = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><head>
<script>window.ddjskey = '${DDKEY}'; window.ddoptions = {};</script>
<script src="https://js.datadome.co/tags.js" async></script>
</head><body><h1>dd probe</h1></body></html>`);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

const b = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const reqs = [];
page.on('request', (req) => {
  const u = req.url();
  if (/datadome\.co|datadome|api-js|js\.datadome/.test(u)) reqs.push({ t: 'REQ', m: req.method(), u, body: (req.postData() || "") });
});
page.on('response', async (res) => {
  const u = res.url();
  if (/datadome\.co|api-js/.test(u)) {
    let text = ''; try { text = (await res.text()).slice(0, 400); } catch (_) {}
    reqs.push({ t: 'RES', s: res.status(), u, setCookie: res.headers()['set-cookie'] || null, body: text });
  }
});

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
// simulate a little behaviour then wait
await page.mouse.move(100, 100); await page.mouse.move(400, 300); await page.mouse.click(200, 200);
await page.waitForTimeout(20000);

const state = await page.evaluate(() => ({
  cookie: document.cookie,
  dataDomeOptions: window.dataDomeOptions ? Object.keys(window.dataDomeOptions) : null,
  ddOptions: window.ddoptions || null,
  events: !!(window.DataDome),
})).catch(e => ({ err: String(e).slice(0, 150) }));

writeFileSync(OUT + '/result.json', JSON.stringify({ ddkey: DDKEY, reqs, state }, null, 2));
console.log(`=== DATADOME (key ${DDKEY}) ===`);
for (const r of reqs) {
  if (r.t === 'RES') console.log(`RES ${r.s} ${r.u.slice(0, 90)}  set-cookie=${(r.setCookie || '-').slice(0, 90)}  body=${(r.body||'').slice(0,80)}`);
  else console.log(`${r.m} ${r.u.slice(0, 90)}  body=${r.body ? r.body.length : 0}B  ${r.body ? r.body.slice(0, 160) : ''}`);
}
console.log('\nstate:', JSON.stringify(state, null, 2).slice(0, 600));
srv.close(); await b.close();
