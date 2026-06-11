# 0001 — Local P2P File Sharing

> Source glossary: [CONTEXT.md](../../CONTEXT.md). Every term used in this
> PRD means what the glossary says it means. Where a decision in this PRD
> refines or extends a glossary term, the PRD takes precedence; the glossary
> should be updated to match on the next code-driven revision.

## Problem Statement

A user has two devices on the same WiFi — say, a PC and a phone — and wants
to move a file (a photo, a PDF, a video) between them. Every option today is
worse than it should be:

- **Email / messenger attachments** — bounce through a third party's
  server, impose size limits, compress images, require accounts.
- **Cloud drives** (iCloud, Google Drive, Dropbox) — require an account,
  round-trip through the cloud, and add a permanent copy on someone else's
  storage.
- **Cable transfer apps** (iTunes, Smart Switch) — need a physical cable, a
  driver install, and patience.
- **Existing "Snapdrop-style" web apps** — usually work, but most still
  require a signalling server, account setup, or both.

The user wants something as friction-free as AirDrop, but cross-platform,
with no install beyond a web app.

## Solution

A **serverless, installable web app** (PWA) that runs entirely in the
browser. Two devices open the same URL; the user pairs them by displaying
a QR on one and scanning it with the other; the file moves directly
peer-to-peer over a WebRTC DataChannel; the app installs to the home
screen, works offline after first launch, and integrates with the OS share
sheet so a photo can be sent straight from the phone's Photos app.

**No backend. No account. No cloud copy.** The only data plane is the
peer-to-peer DataChannel; the only "signalling" is a QR code and a
clipboard paste.

## User Stories

### Pairing

1. As a **PC user**, I want to open the app and click "Receive a file", so
   that the app displays a QR code I can show to my phone.
2. As a **PC user**, I want to see a short code alongside the QR, so that I
   can confirm the connection is to the right device after my phone scans
   it.
3. As a **phone user**, I want to scan the QR with my camera, so that the
   app picks up the Offerer's session invitation.
4. As a **phone user**, I want the camera permission prompt to be clear and
   non-blocking, so that I can grant access smoothly.
5. As a **phone user**, I want the app to handle a denied camera permission
   gracefully, so that I'm not stuck.
6. As a **phone user**, I want to see the Offerer's Device Name after
   scanning, so that I know I'm connecting to the right device.
7. As a **phone user**, I want to copy the SDP answer to my clipboard with
   one tap, so that I can hand it back to the Offerer.
8. As a **PC user**, I want to paste the SDP answer and see the Session
   connect, so that pairing completes.
9. As either user, I want to see a clear "pairing in progress" indicator,
   so that I know the handshake hasn't hung.
10. As either user, I want to be told if pairing fails (with a useful
    reason), so that I can retry or fall back.
11. As either user, I want the **PC** to be able to act as the Answerer
    (scan the phone's QR) too, so that the flow works in either direction.
12. As either user, I want pairing to be impossible to do accidentally
    with a stranger on the same WiFi, so that I don't send my files to the
    wrong person.

### Transfer

13. As a **phone user in a Session**, I want to pick a single file to send,
    so that I can move it to the PC.
14. As a **phone user in a Session**, I want to see a progress bar with
    percentage and bytes-sent, so that I know the transfer is happening.
15. As a **phone user in a Session**, I want to cancel an in-flight
    Transfer, so that I can stop a transfer I no longer want.
16. As a **PC user in a Session**, I want to receive the file in my Inbox,
    so that I can decide what to do with it.
17. As a **PC user**, I want to see the sender's Device Name and the file
    name + size in my Inbox, so that I know what I'm being offered.
18. As a **PC user**, I want to save a file from my Inbox to the device's
    storage, so that I can use it elsewhere.
19. As a **PC user**, I want to discard a file from my Inbox, so that I
    can keep the Inbox tidy.
20. As a **PC user**, I want to save or discard multiple files in one
    action, so that I can clear the Inbox quickly.
21. As a **PC user**, I want the Inbox to clear automatically when the
    Session ends, so that stale files don't pile up.
22. As either user, I want to send and receive in the same Session
    (bidirectional), so that I can exchange files in either direction
    without re-pairing.
23. As a **PC user**, I want to pick a file and send it to the phone, so
    that the transfer works in the phone-as-receiver direction too.
24. As either user, I want to send a second file after the first
    completes, so that I can do batch transfers in one Session.
25. As either user, I want a Transfer that fails mid-flight to leave no
    partial file in the Inbox, so that I don't have a corrupt file to
    deal with.

### PWA / Share Target

26. As a **phone user in the Photos app**, I want to share a photo to this
    app via the system share sheet, so that I don't have to open the app
    first and find the photo.
27. As a **phone user in any source app** (Files, WhatsApp, Mail, etc.), I
    want this app to appear in the share sheet, so that I can route any
    file into a Transfer.
28. As a **phone user**, I want the app to install to my home screen, so
    that I can launch it like a native app.
29. As a **phone user**, I want the app to load instantly on subsequent
    launches (from the service-worker cache), so that I don't wait.
30. As a **phone user**, I want the app to work in airplane mode after the
    first install, so that I can use it on a flight or in poor coverage.
31. As a **phone user**, I want a visible install prompt, so that I know
    installing is an option.

### Device Name

32. As a user, I want my Device Name to be auto-generated from my browser
    on first run (e.g. "iPhone", "MacBook Pro"), so that I don't have to
    type anything.
33. As a user, I want to override my Device Name in a settings screen, so
    that I can pick a friendlier label.
34. As a user, I want my Device Name to persist across Sessions, so that I
    only set it once.
35. As either user, I want to see the peer's Device Name during a Session
    and in each Inbox row, so that I know who's on the other end.

### Session lifecycle

36. As a user, I want the Session to end when I close the app, so that
    resources are freed and the Inbox is cleared.
37. As a user, I want the Session to end after a period of inactivity
    (e.g. 5 minutes), so that a forgotten tab doesn't stay paired.
38. As a user, I want to be able to start a new Session after the
    previous one ended, so that I can keep transferring files.
39. As a user, I want the WebRTC connection to be torn down cleanly on
    Session end, so that neither side leaks resources.

### Error handling

40. As a user, I want a clear error if the connection drops mid-Session,
    so that I can retry.
41. As a user, I want a Transfer that fails partway through to leave the
    Inbox untouched, so that I don't have to clean up a partial file.
42. As a user, I want the QR scanner to validate the payload before
    accepting it, so that a malformed QR doesn't break the app.
43. As a user, I want a paste that's not a valid SDP answer to be
    rejected with a helpful message, so that I know to retry.

## Implementation Decisions

### Module layout (within `apps/web/src/`)

The codebase is currently a near-empty Next.js App Router skeleton. The
following modules will be introduced:

- `lib/webrtc/` — WebRTC peer connection lifecycle: `Session` (start, end,
  on-close), `DataChannel` setup, ICE candidate gathering. Pure-ish, no
  React. Designed to be testable without a browser.
- `lib/pairing/` — Pairing flow: `encodeOffer(sdp, name)` → QR payload,
  `decodeQr(text)` → `{ sdp, name }`, clipboard read/write helpers, the
  "Pairing state machine" (idle → offerer-shown → answerer-scanned →
  answer-pasted → connected).
- `lib/transfer/` — Transfer state machine: `Transfer.send(blob)` →
  chunked stream, `Transfer.receive(blob)` → reassembler, progress
  reporting, cancellation. The chunk frame shape lives here.
- `lib/inbox/` — In-memory session-scoped store of received Transfers,
  with `save(file)` and `discard(fileId)` operations.
- `lib/device-name/` — Auto-generation from `navigator.userAgent` on
  first run; override stored in `localStorage`; `get()` / `set(name)`.
- `lib/pwa/` — Service worker registration and lifecycle; Share Target
  manifest + the `/share-target` route handler.
- `components/` — React UI. Each component corresponds to one screen
  (home, pairing, in-session, in-transfer, settings, share-target
  receiver) plus shared widgets (QR display, QR scanner, file picker,
  progress bar, Inbox row).

### Key interfaces

> Candidate shape — to be validated by a prototype before code lands.
> Included here because the shape encodes a decision (per-byte framing
> format, in-band transfer ID) that prose would fuzz.

```ts
// The unit of the File Transfer stream.
type Chunk = {
  fileId: string;       // UUID assigned per Transfer, included in every
                        // chunk so the receiver can reassemble one file
                        // at a time without an out-of-band handshake.
  offset: number;       // byte offset within the file (u32).
  length: number;       // bytes in this chunk's payload (≤ CHUNK_SIZE).
  payload: ArrayBuffer; // the bytes themselves.
};

const CHUNK_SIZE = 16 * 1024; // 16 KB — sweet spot for LAN throughput
                              // without blocking the DataChannel.
```

```ts
// The Pairing payload. Same shape for offer (via QR) and answer
// (via clipboard).
type PairingPayload = {
  sdp: string;          // base64url-encoded SDP
  name: string;         // the Device Name of the sender
};
```

### Architectural decisions

- **No server, no backend.** The Next.js app is fully static; no API
  routes hold state. The `apps/web/src/app/api/` directory will not be
  used for this feature.
- **WebRTC DataChannel is the only data plane.** No HTTP fallback, no
  WebSocket fallback. If the DataChannel can't open, the transfer fails
  and the user re-pairs.
- **State machines for Pairing and Transfer.** Both flows are
  small enough to be expressed as explicit state machines
  (`idle | offering | scanning | pasting | connected | closing` for
  Pairing; `idle | sending | receiving | completed | failed | cancelled`
  for Transfer). This is the shape that the prototype should validate
  first; the UI mirrors these states directly.
- **Inbox lives in client-side state scoped to the active Session** —
  held in React state (or a lightweight client store owned by the
  Session). Concretely, it is cleared on `pagehide` and on explicit
  Session close. This is what makes the ephemeral-Session rule
  automatically correct — the Inbox cannot outlive the page, so the
  glossary's "cleared on Session end" is a property of the runtime
  lifecycle, not a separate code path. No IndexedDB, no service-worker
  cache.
- **Device Name lives in `localStorage` only.** No sync, no account.
- **Service worker does two things**: precache the app shell for offline
  launch; handle the Share Target POST. Nothing else.
- **No chunked backpressure, no checksum, no resume on day one.** The
  chunked shape is structured so these are incremental extensions, not
  rewrites.

### Wire protocol decisions

- The **SDP exchange is unmodified WebRTC**. We do not invent a custom
  signalling protocol on top.
- The **chunk frame is in-band** (every chunk carries the `fileId`).
  The receiver does not need an out-of-band "start of file" message.
- The **last chunk of a file is marked** by `offset + length === totalBytes`
  (computed by the receiver when the file ends), not by a separate
  "end-of-file" message.
- A Transfer is **cancelled by closing the DataChannel** (cleanest
  cross-implementation signal). Re-opening requires a new Transfer.
- The DataChannel is configured as **reliable + unordered** — every
  chunk must arrive, and ordering is reconstructed by the receiver from
  each chunk's `offset`. The browser default is intentionally avoided
  because ordered delivery can stall under loss on busy networks;
  "reliable + unordered" is the only setting that lets the chunked
  shape be robust to reordered delivery without an application-level
  reorder buffer.

### PWA / Share Target decisions

- The PWA manifest already exists at
  `apps/web/src/app/manifest.ts`; the `share_target` action and the
  `/share-target` route are the only additions.
- Share Target payload is a single file per share (matches the
  "single file per Transfer" decision). Multi-file shares are dropped to
  the first file (with a UI note) on day one; this is a known limitation.
- The service worker is registered from a client component on first
  load, gated on a "has the user installed the PWA" check (to avoid the
  SW being torn down by browser storage pressure in incognito).

## Testing Decisions

### Seams (where tests will live)

- **Highest seam — E2E (Playwright).** Two browser contexts in one
  Playwright run simulate the PC and the phone. The PC context loads
  the page, generates a QR, exposes the offer as text. The phone
  context decodes that text, generates an answer, and pastes it back.
  The test then asserts that a Transfer from phone → PC completes and
  the file's bytes round-trip identically. This is the seam that
  catches "the QR doesn't encode what the scanner expects" bugs, which
  are the single most likely source of cross-device regressions. The
  full peer-to-peer round trip is acknowledged to be a **slow, flaky
  E2E** (ICE candidate gathering and `getUserMedia` are not friendly to
  headless mode), so this seam runs in CI but is not the test you reach
  for on every change.
  - New directory: `apps/web/tests/e2e/`
  - New config: `apps/web/playwright.config.ts`
  - Pipeline entry in `turbo.json`: `test:e2e`
- **Mid seam — Integration (Vitest).** Tests for the Pairing and
  Transfer state machines, the chunk framing serializer, the Inbox
  save/discard logic, and the Device Name generator. The WebRTC layer
  is mocked at the boundary through a **fake transport** abstraction:
  the `lib/transfer/` state machine sees a `DataChannel`-shaped
  interface (send / onmessage / bufferedAmount / close), and the
  implementation can be a real `RTCDataChannel` in E2E or an
  in-memory `EventTarget` in integration tests. This is what lets us
  assert chunking and reassembly, cancel, and the failure paths in a
  Vitest integration test in milliseconds rather than seconds, without
  touching real WebRTC. Pairing's QR encode/decode is exercised here
  with a synthetic SDP; clipboard read/write is stubbed. The fake
  transport is owned by a single module — `lib/webrtc/transport.ts` —
  which exposes a `Transport` interface and ships two implementations
  (real `RTCDataChannel`-backed for production, in-memory
  `EventTarget`-backed for tests); `lib/transfer/` and `lib/pairing/`
  consume only the interface.
  - New directory: `apps/web/tests/integration/`
  - New config: `apps/web/vitest.config.ts` (workspace scope so the
    monorepo can extend it later).
  - Pipeline entry in `turbo.json`: `test:integration`
- **Low seam — Unit (Vitest, in the same suite as integration).**
  Tests for pure helpers (QR encode/decode round-trip, clipboard
  parsing, chunk frame serialization, base64url helpers, Device Name
  generator from a handful of representative `navigator.userAgent`
  strings). Co-located with their modules under
  `apps/web/src/lib/**/__tests__/`.

### What makes a good test

- **Test external behavior, not implementation details.** For a state
  machine, test the inputs and the resulting observable state — not
  the internal field names or method-call ordering. For the chunk
  framing, test that a serialized chunk round-trips through the
  receiver unchanged — not that a specific function was called.
- **Use the public API as the entry point.** Tests should call the
  same functions the UI calls. If a test needs to reach into private
  internals, that's a sign the public surface needs an extension.
- **One assertion per behavior, multiple assertions per scenario.** A
  test for "Transfer sends a 500MB file" should assert progress
  updates fire, the Inbox receives a single entry, the file's bytes
  round-trip, and the Session remains open. A test for "QR encoder
  handles a 4KB SDP" is a separate test.
- **No real timers.** Use `vi.useFakeTimers()` for idle-window tests.

### Modules that will be tested

- `lib/pairing/state-machine.ts` — every transition, plus the
  failure modes (malformed QR, paste of non-SDP text, ICE failure).
- `lib/transfer/state-machine.ts` — every transition, plus
  cancellation, partial-failure, multi-chunk reassembly, single-chunk
  (small file) case, and the 500MB upper bound.
- `lib/transfer/chunk-frame.ts` — encode/decode round-trip, boundary
  cases (empty file, single byte, exact multiple of `CHUNK_SIZE`).
- `lib/inbox/store.ts` — save, discard, clear-on-Session-end, idempotency.
- `lib/device-name/index.ts` — generation from `navigator.userAgent`
  for a handful of representative UA strings, override behavior,
  localStorage round-trip.
- `components/PairingScreen.tsx` — the user-facing flow (Playwright).
- `components/InboxScreen.tsx` — save, discard, multi-select (Playwright).

### Prior art in the codebase

There is no prior test infrastructure in this repo. `AGENTS.md`
prescribes the test style (`it` / `test` blocks, no `.only` or `.skip`,
flat `describe` nesting) and Ultracite's Biome config will be the
linter. The PR for adding Vitest and Playwright will set the pattern
the rest of the repo follows.

## Out of Scope

- **Cross-internet Transfer** (devices on different networks). Would
  require NAT traversal and a TURN server, breaking the no-server
  property.
- **Group Transfers** (more than two devices in one Session). Would
  require multi-party signalling, breaking the Pairing shape.
- **Multi-file Transfer** (one Transfer carrying several files). Would
  require a single Transfer to carry multiple file identities, breaking
  the one-file shape.
- **Folder Transfer** (sender picks a directory). No portable browser
  API for folder contents; would require a zip step before Transfer.
- **Phone-as-hotspot hosting.**
- **Bluetooth-class proximity pairing.**
- **Persistent device identity or accounts.**
- **File Handling API, push notifications, background sync.**
- **Any signalling server** (WebSocket, Durable Object, third-party
  broker).
- **Resumable / checksummed / backpressure-aware transfers.** The
  chunked shape is designed to accommodate these later, but they are
  not in this PRD.
- **A specific deployment target.** The Next.js app will be buildable
  and runnable locally; the hosting decision (Vercel, Cloudflare Pages,
  Fly.io, self-host) is a separate question to be answered before the
  first user-facing deploy.

## Further Notes

- **Source of truth for terminology is `CONTEXT.md`**, not this PRD.
  If a code review or implementation question reveals that a glossary
  term is wrong, the fix is in `CONTEXT.md` first, then the code.
- **The chunk frame type and the pairing payload type in the
  Implementation Decisions section are candidate shapes**, not
  committed interfaces. The first prototype should either confirm
  them or produce a small delta. Any change ripples through
  `docs/prd/0001-p2p-file-sharing.md` and `CONTEXT.md` together.
- **The E2E test seam (Playwright with two browser contexts) is the
  risk-reducer for the highest-impact class of bugs in this PRD**: the
  QR / clipboard round-trip. If that seam isn't built early, the
  project will spend a long time manually testing across actual
  devices. The `to-issues` step that follows this PRD should put
  Playwright setup near the top of the queue, before any of the
  feature code.
- **The issue tracker is not yet configured** for this repo (no
  `## Agent skills` block in `AGENTS.md`, no `docs/agents/`). The
  PRD will be published to a tracker as a followup; for now it lives
  in-tree at `docs/prd/0001-p2p-file-sharing.md` so the design is
  version-controlled with the code.
