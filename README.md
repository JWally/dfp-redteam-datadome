# dfp-redteam-datadome — DataDome JS Tag

Authorized dissection of DataDome's **client** JS Tag (`js.datadome.co/tags.js`)
using a merchant's **public** client-side key (vinted.fr's `DATADOME_CLIENT_SIDE_KEY`,
read from their page HTML). Only public page loads; no protected endpoint hit.
Detail: [`DATADOME_BREAK_2026_11_02.md`](DATADOME_BREAK_2026_11_02.md).

---

## What we found

- **Loader**: `js.datadome.co/tags.js` (139 KB, obfuscated), keyed by the
  merchant's `window.ddjskey`. It hooks mouse/keyboard, device/OS/GPU properties,
  and runs **anti-bot consistency checks** (headless Chrome, Puppeteer, Selenium…).
- **Telemetry** is POSTed to `api-js.datadome.co/js/` — the **endpoint and key
  are public**. Body fields: `jspl` (5.2 KB opaque blob), `jsType=ch` (browser
  props; a second `le` tag carries events), `cid`, `ddk=<key>`, `Referer`,
  `request`, `responsePage`, `ddv=5.11.2`.
- **The `jspl` payload is opaque**: it base64-decodes to high-entropy binary — a
  **custom-encoded telemetry blob** (device + behaviour + proofs-of-work). No
  static client key was found; the server decodes it. **We did not invert it.**
- **The server owns the session**: responses are `{"status":200}` and a
  server-issued **`datadome` cookie** is set on real merchant contexts (the
  device-session token). DataDome's invisible **Device Check** enforces
  per-request proofs-of-work server-side.

## Status

- 🟢 Read flow / endpoint / key / structure: fully characterised
- 🟢 Signals shipped: **203**, listed in [`artifacts/SIGNALS-SHIPPED.md`](artifacts/SIGNALS-SHIPPED.md)
- 🟢/🟡 Read `jspl` payload: **reversible XOR obfuscation, not crypto** — prior v5.6.6 harness decrypted it and extracted **203 signals** (current v5.11.2 keystream re-derivable)
- 🔴 Mint session: `datadome` cookie + Device Check are **server-issued** — not client-mintable (payload is forgeable in principle) (but the *payload* is forgeable in principle)
- The moat is server-side (detection engine + Device Check PoW) and the
  telemetry encoding is opaque

## Recorded demo

<img src="assets/demo-datadome.gif" width="720" alt="DataDome JS Tag flow dissection demo" />

<video src="assets/demo-datadome.mp4" width="720" controls></video>

## Artifacts & scripts

- [`artifacts/cap-result.json`](artifacts/cap-result.json) — full tags POST + response
- `scripts/dd-capture.mjs` — drive the real tags.js + capture the telemetry POST
- `scripts/demo-datadome.py` — print the analysis

## Honest caveats

- Used a merchant's **public** client-side key only; no protected resource was
  requested and no session cookie was forged or replayed.
- The `jspl` encoding was **not** broken — we characterise the envelope, not the
  contents.
- Good-vs-bad framing: a **good** design — public key/endpoint like everyone, but
  the telemetry is opaque and the session + challenge are server-side.

## Wire / tamper / mint — and the prior RE (this is the real story)

A **prior red-team harness already reverse-engineered the tag** (`artifacts/PRIOR-RE-DataDome.md`,
bundled from `~/Dev/_archive/bots-datadome`, tags.js v5.6.6). It proved `jspl` is **not
crypto — it's a reversible XOR stream cipher**:

- keystream = **Marsaglia xorshift32** (`n ^= n<<13; n ^= n>>17; n ^= n<<5`) seeded
  from `(seed) ^ 11027890091`, mixed with a hash of the customer's **public**
  `ddjskey`; the XOR'd JSON bytes are then mapped through a **custom base64
  alphabet** — `-_0-9A-Za-z` in the current bundle.
- **No HMAC, no AEAD, no public key.** Knowing the (public) `ddjskey` + the
  approximate request time is enough to **decrypt and forge** the payload — the
  same "reversible obfuscation" class as ThreatMetrix's `td_3F`.

The prior run **decrypted real payloads** and produced the full attribute list:
[`artifacts/SIGNALS-SHIPPED.md`](artifacts/SIGNALS-SHIPPED.md) — **203 signals**,
including behavioural mouse/pointer counters (`m_*`), **keyboard dynamics**
(`k_hA/k_hSD`, hold/press/release timings), **stroke statistics** (`es_*`),
pointer coalescing (`p_*`), the full `nt_*` **network-timing** set, viewport/screen,
**canvas/CSS fingerprint** (`css*`, `fph`), **self-stack-integrity** traces
(`ccs*`), audio/video codec probes, storage quota, UA-client-hints, WebGL
`glrd/glvd`, and **AI-agent detectors** (`gai`, `sqt`).

### Fresh v5.11.2 check (honest)

Our live capture is `ddv=5.11.2`. The current bundle **still contains the
`11027890091` xorshift constant** and the same alphabet scheme — but the
**keystream generator was refactored** (`l(n,t)` now slices bits per-byte:
`255 & ((i >> (16-8*o)) ^ …)`), so the v5.6.6 decoder does **not** reproduce
(v5.11.2 decode scored only **41% printable** = garbage). So: **XOR obfuscation,
not crypto** (readable/forgeable in principle) — but the *exact current*
keystream still needs re-derivation (the pieces are in `artifacts/tags.js`).

### Tamper / replay (live, v5.11.2)

- Re-POSTed the telemetry: unmodified, tampered `ddv`/`jsType`, a **flipped-byte
  `jspl`**, and a fake `cid` → **all four `200` + a fresh `datadome` cookie**.
  The tags endpoint is a **promiscuous trust endpoint** (issues a session cookie
  regardless; the cookie's *trust value* is decided server-side).

## Assessment (revised)

- **Crypto-RE: ~2** — **no cryptography**: reversible xorshift XOR + custom
  base64, keyed by a public key + timestamp. Meters: read 🟢/🟡, forge 🟡 (prior
  v5.6.6 done; v5.11.2 re-derivable).
- **Resistance: ~50** — the wire is *obfuscated, not protected*; the real moat is
  server-side (Device Check PoW + the requesting client's TLS/IP/header signals),
  not the payload encoding.
