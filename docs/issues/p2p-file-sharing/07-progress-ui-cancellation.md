Status: ready-for-agent

## What to build

A real progress bar on the sender side, showing bytes-sent and percentage. A Cancel button that aborts the in-flight Transfer (closes the DataChannel cleanly per the PRD's wire protocol). The receiver sees the Transfer disappear from the Inbox (no partial entry).

Modules touched:

- `apps/web/src/lib/transfer/state-machine.ts` — `onProgress` callback, `cancel()` action
- `apps/web/src/components/SendButton.tsx` — progress bar UI, Cancel button
- `apps/web/src/lib/transfer/send.ts` — `cancel()` closes the DataChannel; receiver sees a clean termination

User stories covered: 14, 15.

## Acceptance criteria

- [ ] Sender sees a progress bar with percentage and bytes-sent updating at least 4 times per second
- [ ] Cancel button is visible only while a Transfer is in flight
- [ ] Tapping Cancel closes the DataChannel cleanly; the receiver's Inbox is not updated with a partial file
- [ ] Vitest integration: cancel mid-Transfer; receiver's reassembler throws and the Inbox is untouched
- [ ] Playwright E2E: send a 5 MB file, observe the progress bar advance, click Cancel, observe the file never appears in the Inbox

## Blocked by

- `.scratch/p2p-file-sharing/issues/04-single-transfer-small-file.md`
