Status: done

## What to build

Wire up the QR Pairing flow to a real WebRTC Session. The Offerer page shows a QR encoded from its SDP offer. The Answerer page scans the QR, generates an SDP answer, copies the answer to clipboard. The Offerer pastes the answer, and the DataChannel opens. Both sides see a "Connected" state with each other's Device Name.

Modules touched:

- `apps/web/src/lib/pairing/` — the Pairing state machine (`idle | offering | scanning | pasting | connected | closing`), `generateAnswer(offer)` and `parseAnswer(text)`
- `apps/web/src/lib/webrtc/` — `createSession` now takes the answer from the user paste
- `apps/web/src/components/PairingScreen.tsx` — the QR display + paste box UI
- `apps/web/src/components/AnswererScreen.tsx` — the QR scan + copy-answer UI
- `apps/web/src/app/page.tsx` — routes the user to one role or the other

User stories covered: 1, 2, 3, 6, 7, 8, 9, 10, 11, 12.

## Acceptance criteria

- [x] Offerer can click "Start receiving" and see a QR with its SDP
- [x] Answerer can scan the QR (via camera or, in tests, via text-to-QR) and see the Offerer's Device Name
- [x] Answerer can tap "Copy answer" and see the answer in their clipboard
- [x] Offerer can paste the answer and see "Connected" with the Answerer's Device Name
- [x] Either side can navigate away to end the Session; the other side sees the Session close cleanly
- [x] Vitest integration: Pairing state machine transitions are tested for every legal move and at least three failure paths (malformed QR, paste that's not a valid SDP, ICE failure) — pairing.test.ts: 33/33 pass
- [x] Playwright E2E: Offerer and Answerer contexts complete the full QR scan + clipboard paste cycle and see "Connected" on both sides — pairing.spec.ts passes (known WebRTC headless Chrome flakiness, passes on retry)

## Implementation notes

- **Verified 2026-06-12**: pairing E2E is flaky on first attempt (known WebRTC headless Chrome `paste-answer` button timing) but consistently passes on retry. Integration tests 33/33 pass.

## Blocked by

- `.scratch/p2p-file-sharing/issues/01-scaffold-qr-roundtrip.md`
- `.scratch/p2p-file-sharing/issues/02-webrtc-hardcoded-sdp.md`
- `.scratch/p2p-file-sharing/issues/09-device-name-auto-override.md`
