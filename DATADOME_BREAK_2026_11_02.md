# DataDome JS Tag — client dissection (2026-11-02)

Authorized dissection of the DataDome JS Tag using a merchant's **public**
client-side key (vinted.fr's `DATADOME_CLIENT_SIDE_KEY` from their page HTML).
Only public page loads; no protected resource requested or session forged.

## 1. Loader

```html
<script>
  window.ddjskey = 'YOUR_DATADOME_JS_KEY';
  window.ddoptions = {};
</script>
<script src="https://js.datadome.co/tags.js" async></script>
```

`tags.js` is **139 KB, obfuscated**. It hooks mouse/keyboard behaviour and
device/OS/GPU properties, and runs consistency checks for known automation
(headless Chrome, Puppeteer, Puppeteer-Extra-Stealth, Selenium — DataDome's
docs name these explicitly).

## 2. Telemetry POST — endpoint and structure are public

The tag POSTs to `https://api-js.datadome.co/js/`. Captured body fields:

| field | value (captured) | meaning |
|---|---|---|
| `jspl` | `<5204-char blob>` | the encoded telemetry payload |
| `jsType` | `ch` | tag type — `ch` = browser properties; `le` = events (mouse/keys) |
| `cid` | `.keep` | cookie/session id (placeholder on first tag) |
| `ddk` | `E6EAF460AA2A8322D66B42C85B62F9` | the merchant's public client key (vinted.fr) |
| `Referer` | page URL | |
| `request` | `/` | |
| `responsePage` | `origin` | |
| `ddv` | `5.11.2` | JS Tag version |

Response: `{"status":200}`. On a real merchant context a server-issued
**`datadome` cookie** is also returned (the device-session token). The
documented order is `ch` first, then `le`.

## 3. The `jspl` payload is opaque — and we did not break it

`jspl` base64-decodes to **high-entropy binary**. It is a **custom-encoded
telemetry blob** (device + behaviour + proofs-of-work), decoded server-side. We
found **no static client key** in tags.js that would let us re-encode an
arbitrary payload, and we did **not** invert the encoding. So: the envelope is
public, the contents are not.

## 4. The server owns the session

- The `datadome` cookie is **server-issued**; DataDome echoes/updates it.
- **Device Check** (invisible, no user interaction) enforces per-request
  **proofs-of-work** server-side — device fingerprinting + automated-challenge
  detection, applied only to suspicious requests.
- Tags are simply a trust signal: a session that never sends tags gets blocked
  later; sending tags raises trust.

## 5. Assessment

- **Crypto-RE: ~4** — no exposed static client key; the telemetry uses a custom
  opaque encoding we did not reverse. (Not a "broken crypto" story — there is no
  obvious key to lift, unlike Fingerprint Pro's in-band XOR seal or Forter's
  static AES key.)
- **Resistance: ~65-70** — public loader/key/endpoint, but opaque telemetry and a
  server-owned session + Device Check PoW. The client cannot mint trust; it can
  only try to look human.
- Good-vs-bad framing: a **good** design — the client is a sensor + shuttle; the
  encoding and the decision are server-side.

## Scope note

Public client-side key only; no protected resource requested; no session cookie
forged or replayed. Findings stated honestly, never overstated.
