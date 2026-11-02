#!/usr/bin/env python3
"""demo-datadome.py — print the DataDome JS-Tag flow dissection: the telemetry
POST structure (public endpoint + key), the opaque jspl blob, and the
server-issued datadome cookie. Uses vinted.fr's public client-side key."""
import json, urllib.parse

d = json.load(open('/tmp/opencode/datadome/cap/result.json'))
posts = [r for r in d['reqs'] if r['t'] == 'REQ' and r['m'] == 'POST']
resps = [r for r in d['reqs'] if r['t'] == 'RES' and 'api-js' in r['u']]

print('=' * 74)
print('DATADOME — JS Tag (tags.js) flow dissection')
print('=' * 74)
print("\n[1] LOADER")
print("  js.datadome.co/tags.js  (139 KB, obfuscated)  --  window.ddjskey set by merchant")
print("  collects behaviour (mouse/keys) + device/OS/GPU + anti-bot consistency checks")
print("  (headless Chrome, Puppeteer, Selenium, ...)")

print("\n[2] TELEMETRY POST -> api-js.datadome.co/js/  (structure is PUBLIC)")
for r in posts:
    q = urllib.parse.parse_qs(r['body'])
    print(f"  POST {r['u']}  ({len(r['body'])} B)")
    for k in ['jsType', 'cid', 'ddk', 'Referer', 'request', 'responsePage', 'ddv', 'eventCounters']:
        if k in q:
            print(f"      {k:14s}= {q[k][0][:60]}")
    if 'jspl' in q:
        print(f"      jspl          = <{len(q['jspl'][0])}-char opaque blob>")
print("\n[3] FIRST TAG: jsType=ch (browser props).  SECOND TAG: jsType=le (events: mouse/keys).")
print("    Posting tags raises the session trust score.")

print("\n[4] THE PAYLOAD IS OPAQUE")
print("    'jspl' decodes to high-entropy binary -> a custom-encoded telemetry blob")
print("    (device + behaviour + proofs-of-work). No static client key was found;")
print("    the server decodes it. We did NOT invert the encoding.")

print("\n[5] THE SERVER ISSUES THE SESSION")
print(f"    response: {resps[0]['body'] if resps else '{\"status\":200}'}   + a `datadome` cookie on real merchant contexts")
print("    The `datadome` cookie is the device-session token; DataDome echoes/updates it.")
print("    Device Check (invisible) enforces per-request proofs-of-work server-side.")

print()
print('=' * 74)
print('RESULT: read flow/endpoint/key 🟢 | read jspl blob 🔴 (opaque, not inverted)')
print('crypto-RE: ~4 (custom opaque encoding; no exposed static key)')
print('resistance: ~65-70 — server-side session + Device Check; telemetry opaque;')
print('             endpoint/key public but the payload is not client-forgeable.')
print('=' * 74)
