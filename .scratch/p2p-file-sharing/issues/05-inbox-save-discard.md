Status: ready-for-agent

## What to build

The Inbox is no longer a passive list — it has a Save action (writes the file to the device's storage via a browser download) and a Discard action (removes the entry from the session-scoped store). Multi-select support: save or discard many files in one action.

Modules touched:

- `apps/web/src/lib/inbox/store.ts` — `save(fileId)`, `discard(fileId)`, `discardAll()`, `saveAll()`; cleared on `pagehide` and on Session close
- `apps/web/src/components/InboxScreen.tsx` — Save / Discard buttons per row, multi-select checkboxes
- `apps/web/src/components/InboxRow.tsx` — extended with the action buttons

User stories covered: 18, 19, 20.

## Acceptance criteria

- [ ] Save triggers a browser download (via `<a download>`); the file lands in the device's Downloads folder
- [ ] Discard removes the row from the Inbox immediately
- [ ] Multi-select: user can check N rows and tap "Save selected" or "Discard selected" once
- [ ] Inbox is cleared when the Session ends (pagehide, DataChannel close)
- [ ] Vitest integration: save/discard/idempotency (double-save is a no-op), multi-select batch operations
- [ ] Playwright E2E: receive three files, save two, discard one; verify downloads folder (intercepted) and Inbox state

## Blocked by

- `.scratch/p2p-file-sharing/issues/04-single-transfer-small-file.md`
