Status: done

## What to build

A Playwright E2E test that verifies bidirectional transfer: Context A (Offerer) sends a file to Context B (Answerer), then Context B sends a different file back to Context A, all in the same Session without re-pairing. Both sides must receive the other's file in their Inbox. This tests the core "either direction" promise from the PRD.

Modules touched:

- `apps/web/tests/e2e/bidirectional.spec.ts` — new E2E spec

User stories covered: 22, 23.

## Acceptance criteria

- [ ] Two browser contexts pair successfully
- [ ] Context A sends a file (e.g. "from-a.txt" with content "hello from A"); Context B's Inbox shows 1 row with that file
- [ ] Context B sends a file (e.g. "from-b.txt" with content "hello from B"); Context A's Inbox shows 1 row with that file
- [ ] Both Inboxes have exactly 1 entry each (no cross-contamination)
- [ ] The Session stays connected (no "Disconnected" indicator)
- [ ] Download content round-trips correctly for both files

## Blocked by

None.
