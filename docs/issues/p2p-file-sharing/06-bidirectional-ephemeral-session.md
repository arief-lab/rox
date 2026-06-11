Status: done

## What to build

Either side can initiate a Transfer in the same Session. The Session is explicitly ephemeral: it auto-ends on `pagehide`, on DataChannel close, or after a short idle window (5 minutes with no activity). The Inbox is cleared on auto-end.

Modules touched:

- `apps/web/src/lib/webrtc/session.ts` — `Session` lifecycle: `start`, `close`, `onClose` event; idle-window timer
- `apps/web/src/lib/inbox/store.ts` — hook into the Session's `onClose` to clear the Inbox
- `apps/web/src/components/SendButton.tsx` — same component, now usable from either side of the Session
- `apps/web/src/components/SessionTimer.tsx` (or inline) — small visual indicator of session liveness

User stories covered: 23, 36, 37, 38, 39.

## Acceptance criteria

- [x] Either side can tap "Send a file" in the same Session — no re-pairing needed
- [x] Closing one side's tab (`pagehide`) ends the Session on the other side within 2 seconds
- [x] Idle window (5 min, configurable): the Session auto-ends and the Inbox is cleared
- [x] After auto-end, the user can re-pair for a new Session
- [x] Vitest integration: Session close propagates to Inbox clear; idle timer fires when expected — session.test.ts: 14/14 pass
- [x] Playwright E2E: phone sends, PC receives, then PC sends, phone receives; close phone's tab; PC sees Session end — bidirectional.spec.ts passes (flaky on first attempt due to WebRTC headless Chrome timing, passes on retry)

## Implementation notes

- **Verified 2026-06-12**: bidirectional E2E flaky but passes on retry (known `paste-answer` button timing in headless Chrome). Session integration tests 14/14 pass. Session idle expiry E2E (issue 16) already done and committed.

## Blocked by

- `.scratch/p2p-file-sharing/issues/05-inbox-save-discard.md`
