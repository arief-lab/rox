Status: ready-for-agent

## What to build

A Playwright E2E test (or Vitest integration test with fake timers) that verifies the Session idle expiry end-to-end. Two contexts pair; no activity occurs for the idle window (5 minutes); both sides transition to "Disconnected" and their Inboxes are cleared.

Since a real 5-minute wait is impractical in CI, the test uses Vitest fake timers at the integration seam (`Session.test.ts` already exists) OR mocks the Session's `idleWindowMs` to a short value (e.g. 2 seconds) in the E2E test, then waits for the DOM to update.

Modules touched:

- `apps/web/tests/integration/session.test.ts` — add fake-timer idle-expiry test, OR
- `apps/web/tests/e2e/session-lifecycle.spec.ts` — new E2E spec with short idle window

User stories covered: 36, 37.

## Acceptance criteria

- [ ] After the idle window elapses with no activity, both sides show "Disconnected"
- [ ] Both Inboxes are empty (cleared on Session end)
- [ ] The "Start over" button is visible on both sides
- [ ] Does NOT require a real 5-minute wait — uses fake timers or a short `idleWindowMs`

## Blocked by

None.
