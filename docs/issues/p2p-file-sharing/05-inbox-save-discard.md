Status: done

## What to build

The Inbox is no longer a passive list — it has a Save action (writes the file to the device's storage via a browser download) and a Discard action (removes the entry from the session-scoped store). Multi-select support: save or discard many files in one action.

Modules touched:

- `apps/web/src/lib/inbox/store.ts` — `save(fileId)`, `discard(fileId)`, `discardAll()`, `saveAll()`; cleared on `pagehide` and on Session close
- `apps/web/src/components/InboxScreen.tsx` — Save / Discard buttons per row, multi-select checkboxes
- `apps/web/src/components/InboxRow.tsx` — extended with the action buttons

User stories covered: 18, 19, 20.

## Acceptance criteria

- [x] Save triggers a browser download (via `<a download>`); the file lands in the device's Downloads folder
- [x] Discard removes the row from the Inbox immediately
- [x] Multi-select: user can check N rows and tap "Save selected" or "Discard selected" once
- [x] Inbox is cleared when the Session ends (pagehide, DataChannel close)
- [x] Vitest integration: save/discard/idempotency (double-save is a no-op), multi-select batch operations — inbox.test.ts passes
- [x] Playwright E2E: receive three files, save two, discard one; verify downloads folder (intercepted) and Inbox state — inbox-save-discard.spec.ts exercises full flow but has a known flake (save multi-download content assertion, see notes)

## Blocked by

- `.scratch/p2p-file-sharing/issues/04-single-transfer-small-file.md`
