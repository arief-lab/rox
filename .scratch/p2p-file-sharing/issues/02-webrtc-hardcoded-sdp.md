Status: ready-for-agent

## What to build

Establish a working WebRTC peer connection between two browser contexts using a hardcoded SDP exchange (no QR yet — both contexts read the SDP from a shared test fixture). The Session ends cleanly when either side closes. The DataChannel carries a single test message ("ping") in each direction. This slice proves the WebRTC layer is right before QR + clipboard are wired in.

Modules touched:

- `apps/web/src/lib/webrtc/transport.ts` — defines the `Transport` interface and ships two implementations: real (RTCDataChannel-backed) and fake (in-memory EventTarget-backed)
- `apps/web/src/lib/webrtc/create-session.ts` — `createSession({ localOffer, remoteAnswer })` returns a connected `Transport` (in this slice, both inputs are hardcoded)
- `apps/web/src/app/page.tsx` — adds a "Connected" state that displays the Session id and a single "ping" send/receive UI

User stories covered: 9 (partial — just the "Connected" state).

## Acceptance criteria

- [ ] `lib/webrtc/transport.ts` exports `Transport` with `send`, `onmessage`, `close`, and `closeReason` (or equivalent)
- [ ] Real implementation creates an `RTCPeerConnection`, exchanges ICE candidates, opens a `RTCDataChannel` with `{ ordered: false }` (reliable + unordered per the PRD)
- [ ] Fake implementation uses an in-memory `EventTarget` so two transports in the same test can talk
- [ ] Vitest integration test: two fake transports exchange a "ping" message in < 100ms
- [ ] Playwright E2E: two contexts both call `createSession` with the same hardcoded SDP fixture, each sends a "ping", each receives the other's "ping"
- [ ] Closing one context's Session tears down the other side's data channel cleanly (no leaked resources, no unhandled rejections)

## Blocked by

- `.scratch/p2p-file-sharing/issues/01-scaffold-qr-roundtrip.md`
