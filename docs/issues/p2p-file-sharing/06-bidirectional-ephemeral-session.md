Status: ready-for-agent

## What to build

Either side can initiate a Transfer in the same Session. The Session is explicitly ephemeral: it auto-ends on `pagehide`, on DataChannel close, or after a short idle window (5 minutes with no activity). The Inbox is cleared on auto-end.

Modules touched:

- `apps/web/src/lib/webrtc/session.ts` — `Session` lifecycle: `start`, `close`, `onClose` event; idle-window timer
- `apps/web/src/lib/inbox/store.ts` — hook into the Session's `onClose` to clear the Inbox
- `apps/web/src/components/SendButton.tsx` — same component, now usable from either side of the Session
- `apps/web/src/components/SessionTimer.tsx` (or inline) — small visual indicator of session liveness

User stories covered: 23, 36, 37, 38, 39.

## Acceptance criteria

- [ ] Either side can tap "Send a file" in the same Session — no re-pairing needed
- [ ] Closing one side's tab (`pagehide`) ends the Session on the other side within 2 seconds
- [ ] Idle window (5 min, configurable): the Session auto-ends and the Inbox is cleared
- [ ] After auto-end, the user can re-pair for a new Session
- [ ] Vitest integration: Session close propagates to Inbox clear; idle timer fires when expected
- [ ] Playwright E2E: phone sends, PC receives, then PC sends, phone receives; close phone's tab; PC sees Session end

## Blocked by

- `.scratch/p2p-file-sharing/issues/05-inbox-save-discard.md`
