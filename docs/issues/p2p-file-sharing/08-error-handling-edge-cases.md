Status: ready-for-agent

## What to build

Robust error handling for the failure modes we know about: connection drops mid-Transfer (no partial Inbox entry), malformed QR (clear rejection), non-SDP paste (clear rejection), camera permission denied (graceful fallback), and Transfer that fails partway (no partial file).

Modules touched:

- `apps/web/src/lib/pairing/state-machine.ts` — failure transitions: `malformed_qr`, `invalid_paste`, `ice_failure`
- `apps/web/src/lib/transfer/state-machine.ts` — `failed` state with reason; partial reassembly is discarded
- `apps/web/src/components/PairingScreen.tsx` — error toasts
- `apps/web/src/components/AnswererScreen.tsx` — error toasts

User stories covered: 40, 41, 42, 43.

## Acceptance criteria

- [ ] Killing the network mid-Transfer produces a "connection lost" toast on the sender and no Inbox entry on the receiver
- [ ] Scanning a QR that isn't a valid PairingPayload shows a "QR not recognized" message and returns to the idle state
- [ ] Pasting text that isn't a valid SDP answer shows a "not a valid answer" message
- [ ] Camera permission denial falls back to "paste the offer text manually"
- [ ] Vitest integration: every failure path produces the correct state transition and the correct toast message
- [ ] Playwright E2E: at least three of the above failure paths are exercised in a single E2E run

## Blocked by

- `.scratch/p2p-file-sharing/issues/06-bidirectional-ephemeral-session.md`
