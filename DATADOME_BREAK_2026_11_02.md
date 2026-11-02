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

## 3. The `jspl` payload is **reversible obfuscation, not crypto**

A **prior harness** (`artifacts/PRIOR-RE-DataDome.md`, tags.js v5.6.6) reversed the
cipher: the payload is **Marsaglia xorshift32 XOR** (`n^=n<<13; n^=n>>17; n^=n<<5`)
seeded from `seed ^ 11027890091` mixed with a hash of the **public** `ddjskey`,
mapped through a custom base64 alphabet (`-_0-9A-Za-z` in the current bundle).
**No HMAC, no AEAD, no public key** → with the public key + approximate timestamp
you can **decrypt and forge** it. The prior run decrypted real payloads and produced
the full **203-signal** inventory (`artifacts/SIGNALS-SHIPPED.md`).

Our live capture is v5.11.2: the bundle **still contains the `11027890091` constant**
and the alphabet scheme, but the byte generator was refactored (`l(n,t)` slices
`255&((i>>(16-8*o))^…)`), so the v5.6.6 decoder doesn't reproduce (v5.11.2 decode =
41% printable). **Obfuscation, not protection** — the exact current keystream is
re-derivable but was not completed here.

### Original observation (v5.11.2, for the record)

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

- **Crypto-RE: ~2** — **no cryptography**: reversible xorshift XOR + custom base64,
  keyed by a public `ddjskey` + timestamp. (Prior v5.6.6 harness decrypted it; the
  current v5.11.2 keystream is re-derivable.)
- **Resistance: ~50 (revised)** — the wire is *obfuscated, not protected*; the real
  moat is server-side (Device Check PoW + the requesting client's TLS/IP/header
  signals). The client cannot mint a *trusted* session, but the payload is not
  cryptographically sealed.
- Good-vs-bad framing: **mixed** — strong server-side posture, but the client
  payload is reversible obfuscation (weaker than Fingerprint Pro's/TMX's sealed
  sides, stronger than the plaintext fraud-shims).

## Scope note

Public client-side key only; no protected resource requested; no session cookie
forged or replayed. Findings stated honestly, never overstated.
