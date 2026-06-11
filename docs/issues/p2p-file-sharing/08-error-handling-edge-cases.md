Status: done

## What to build

Robust error handling for the failure modes we know about: connection drops mid-Transfer (no partial Inbox entry), malformed QR (clear rejection), non-SDP paste (clear rejection), camera permission denied (graceful fallback), and Transfer that fails partway (no partial file).

Modules touched:

- `apps/web/src/lib/pairing/state-machine.ts` — failure transitions: `malformed_qr`, `invalid_paste`, `ice_failure`
- `apps/web/src/lib/transfer/state-machine.ts` — `failed` state with reason; partial reassembly is discarded
- `apps/web/src/components/PairingScreen.tsx` — error toasts
- `apps/web/src/components/AnswererScreen.tsx` — error toasts

User stories covered: 40, 41, 42, 43.

## Acceptance criteria

- [x] Killing the network mid-Transfer produces a "connection lost" toast on the sender and no Inbox entry on the receiver — E2E verified: `error-handling.spec.ts` tests 4 & 5 (close sender/receiver mid-transfer, verify log + empty Inbox)
- [x] Scanning a QR that isn't a valid PairingPayload shows a "QR not recognized" message and returns to the idle state — E2E verified: `error-handling.spec.ts` test 1 (garbage text in scan area → "QR not recognized", stays on idle view)
- [x] Pasting text that isn't a valid SDP answer shows a "not a valid answer" message — E2E verified: `error-handling.spec.ts` test 2 (garbage paste → "not a valid answer", resets to idle)
- [x] Camera permission denial falls back to "paste the offer text manually" — E2E verified: `error-handling.spec.ts` test 3 (headless Chromium no-camera → fallback message visible, scan-area still accessible)
- [x] Vitest integration: every failure path produces the correct state transition and the correct toast message — `pairing.test.ts`: 33/33 pass (malformed_qr, invalid_paste, ice_failure transitions); `state-machine.test.ts`: TransferMachine fail/cancel/complete guard tests pass
- [x] Playwright E2E: at least three of the above failure paths are exercised in a single E2E run — `error-handling.spec.ts`: 5/5 pass, covering all 4 failure paths (malformed QR, invalid paste, camera denial, connection lost ×2)

## Implementation notes

- **error-handling.spec.ts** (5 tests): malformed QR → "QR not recognized", invalid paste → "not a valid answer", camera permission denial → fallback message, connection lost on sender → "Connection lost" in send log, connection lost on receiver → empty Inbox
- **pairing.test.ts** (integration): 33 tests covering PairingMachine state transitions including `failMalformedQr()`, `failInvalidPaste()`, `failIce()` from all legal states and guard violations from illegal states
- **state-machine.test.ts** (unit): TransferMachine `fail()`, `cancel()`, `complete()` guard transitions from all states (idle, sending, receiving, failed, cancelled, completed)
- PairingScreen and AnswererScreen components render error toasts via `data-testid="error-text"` in idle/scanning/offering-pasting views
- `receive.ts` and `send.ts` handle transport close mid-transfer — reject the promise without producing partial files
