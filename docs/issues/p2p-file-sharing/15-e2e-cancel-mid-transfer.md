Status: ready-for-agent

## What to build

A Playwright E2E test that exercises the cancel flow end-to-end. Two contexts pair; Context A sends a large file; Context A clicks "Cancel" mid-progress; the test asserts Context A's UI shows "Cancelled", Context B's Inbox is empty (no partial entry), the Session stays alive, and Context A can send a new (small) file successfully.

Then the symmetric case: Context B (receiver) cancels an incoming file, and the same invariants hold.

Modules touched:

- `apps/web/tests/e2e/cancel-mid-transfer.spec.ts` — new E2E spec

User stories covered: 15, 25.

## Acceptance criteria

- [ ] Sender cancel: file is mid-flight → sender clicks Cancel → sender sees "Cancelled" log → receiver's Inbox is empty → sender sends a second file successfully
- [ ] Receiver cancel: file is mid-flight → receiver clicks Cancel (on receive progress bar) → sender sees "Cancelled" log → receiver's Inbox is empty → sender sends a second file successfully
- [ ] In both cases the Session remains connected (DataChannel stays open)
- [ ] Both files in the "second file" case round-trip correctly

## Blocked by

None.
