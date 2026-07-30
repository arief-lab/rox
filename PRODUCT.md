# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **First-time visitors.** People who just opened the app with no Session established. The empty / onboarding state is the most-encountered surface, so the first viewport must communicate what the app does and how pairing starts within seconds.
- **Casual users moving one file phone↔PC.** Someone with two devices on the same WiFi who wants to push a single photo, PDF, or video between them in a few taps.

The casual one-off scenario is the day-one success case. *(Inferred from `CONTEXT.md` and PRD-0001.)* Privacy-aware users who avoid cloud services are a supporting audience by construction — the no-server, no-account shape is what makes Rox usable for them at all.

## Product Purpose

A serverless, installable progressive web app that moves individual files directly between two devices on the same WiFi. Each Transfer runs over a WebRTC DataChannel with no backend, no account, and no cloud copy. The only out-of-band channel during pairing is a QR code and a manual clipboard paste.

**Day-one success** = a person with a phone and a PC on the same network opens Rox on both, scans the QR, and a single file arrives intact in the receiver's Inbox within seconds.

## Positioning

Friction-free cross-platform local file transfer — the AirDrop shape that works on any browser.

The mechanism a neighboring product cannot truthfully copy is the **no-server, no-account, no-cloud-copy** commitment: data moves peer-to-peer over WebRTC, the only signalling is a QR and a clipboard paste, and no third-party broker, persistent identity, or cloud copy is ever introduced.

## Operating Context

- **Same-network pairing.** Both devices are on the same LAN / WiFi. The user thinks in terms of "this device" and "the other device," not Internet sender and cloud receiver.
- **Ephemeral Sessions.** A Session ends when either device closes the app, after a short idle window, or on an explicit close. The current Session's Inbox is cleared automatically on Session end. The user's mental model is device-to-device — see Brand Commitments for the canonical language rule.
- **Installable PWA.** Adds to a phone home screen, integrates with the OS share sheet (Share Target) so a photo can be sent straight from the Photos app, and runs offline from the service-worker-cached shell after first install.
- **Privacy by construction.** No signalling server, no third-party intermediary storage, no account-bound profile; the only persistent per-user state is the auto-generated Device Name on the user's own device.

## Capabilities and Constraints

### Capabilities (confirmed in code; PRD-0001 fully implemented per `AGENTS.md`)

- Manual pairing via QR (Offerer displays a QR; Answerer scans or pastes) and WebRTC SDP exchange.
- WebRTC DataChannel Transfer, chunked at 16 KB, reliable + unordered, single file per Transfer, single-direction per Transfer, up to 500 MB.
- Bidirectional in one Session — either side can be Sender or Receiver without re-pairing.
- Session-scoped Inbox with explicit Save or Discard per received file.
- Auto-generated Device Name on first run (derived from `navigator.userAgent`); a per-user override persists in `localStorage`.
- PWA install prompt, Share Target entry, service-worker-cached offline app shell.

### Constraints

- **No backend, no API routes.** The Next.js application is fully static. There is no signalling server, no WebSocket service, no Durable Object, and no third-party broker.
- **LAN-only.** Cross-internet Transfer is out of scope; it would require NAT traversal and break the no-server property.
- **Two-device Sessions.** Group Transfer (more than two devices) is out of scope.
- **One file per Transfer.** Multi-file and folder Transfers are out of scope on day one.
- **Lenient reconnect grace.** If the WebRTC connection drops briefly mid-Session (e.g. flapping WiFi), the app retries silently for a 3–5 s window with a subtle status indicator. If reconnect fails, the Session transitions to a "Connection lost" state and offers **Retry** and **Start over**. The current Session's Inbox survives a successful reconnect and is cleared only on a hard Session end.

### Out of Scope

See `CONTEXT.md` § Out of Scope for the canonical exclusions (cross-internet Transfer, group Transfers, multi-file Transfers, folder Transfer, phone-as-hotspot hosting, Bluetooth-class proximity pairing, persistent device identity and accounts, push notifications, background sync, any signalling server, resumable / checksummed / backpressure-aware Transfers). When this section and `CONTEXT.md` disagree, `CONTEXT.md` wins.

## Brand Commitments

- **Name.** "Rox" (title case). The repository and npm scope remain "rox-apps" for backwards compatibility.
- **License.** AGPL-3.0-or-later.
- **Light-only theming (durable).** The app ships light-only; there is no light / dark / system toggle and no dark-mode surface area committed as a product. Implementation choices (provider, tokens, theme variable names) belong in DESIGN.md, not here.
- **Hardware-first language.** The UI speaks in "this device" and "the other device" — never "sender / receiver", "host / guest", or "client / server."
- **Manual pairing only.** No auto-discovery, no mDNS, no LAN scan; the user always performs the physical act of reading the QR (the trust proof), per `CONTEXT.md`.

## Evidence on Hand

- **Test coverage as proof of the core flow.** Per `README.md` and `AGENTS.md`: 340 unit/integration Vitest tests across 23 files, 25 Playwright E2E tests across 11 specs. All pairing, transfer, inbox, device-name, PWA-install, share-target, error-handling, and reconnect paths are covered.
- **Domain glossary.** `CONTEXT.md` is the source of truth for terminology. Fix glossary drift before code review comments when the two disagree.
- **PRD as the durable feature list.** `docs/prd/0001-p2p-file-sharing.md` enumerates the 43 user stories driving day-one scope. All 18 implementation issues under `docs/issues/p2p-file-sharing/` are `Status: done`.
- **Visual trajectory specs as evidence of past intent, not authority.** `frontend-ux-iteration-spec.md` (current draft), `hardware-ux-redesign-spec.md`, and `beui-redesign-spec.md` describe the visual iteration history. They are not authoritative for visual decisions — those decisions belong in `DESIGN.md` going forward.

## Product Principles

1. **Peer-to-peer by default.** No third party becomes a party to a person's Transfer; the data path is the WebRTC DataChannel, period.
2. **Hardware-first mental model.** *(Inferred from `CONTEXT.md` § Role and Pairing.)* Conversation, copy, and labels stay in terms of devices, not roles or accounts.
3. **Friction-free pairing in three moves.** Loading the QR on the Offerer, reading it on the Answerer, and pasting the answer back close the loop without a setup screen.
4. **Ephemeral Sessions, durable devices.** Sessions disappear the moment they're done; the only piece that persists across Sessions is the user's auto-generated Device Name.

## Accessibility & Inclusion

- Full keyboard reach across primary actions, with visible focus rings in the app's accent color.
- Screen-reader labels on every interactive control: QR, Copy link, Share, Scan QR, status dot, Inbox rows, transfer progress.
- Honor `prefers-reduced-motion`: disable looping / pulse animations; keep state-change transitions short and opacity-only.
- No color-only signaling: connection status and Transfer state also carry a text label.
