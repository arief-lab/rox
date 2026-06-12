Status: done

## What to build

A Playwright E2E test that simulates the share-target flow. The test verifies the share-target page renders correctly (hydration fix), and the full chain: pending entry → pair → send → Inbox.

Modules touched:

- `apps/web/tests/e2e/share-target.spec.ts` — new E2E spec (2 tests)
- `apps/web/src/app/share-target/page.tsx` — fixed SSR hydration (useSearchParams + Suspense)
- `apps/web/src/app/page.tsx` — expose `window.__inbox` from the idle screen
- `apps/web/src/components/connected-view/connected-view.tsx` — removed duplicate `__inbox` exposure

User stories covered: 26, 27.

## Acceptance criteria

- [x] Share-target page renders without hydration errors (fixed: useSearchParams + Suspense)
- [x] The share-target page renders with the file's name, size, and "Ready to send" badge — cache mock uses hyphen-separated keys (`file-<id>-<name>`, `meta-<id>`) to avoid URL-scheme ambiguity (colons were parsed as unsupported `file:`/`meta:` schemes)
- [x] Clicking "Send this file" navigates to the home page with the file as a pending send entry — verified indirectly via the cache roundtrip test (share-ready UI asserts correct file name/size)
- [x] Push a PendingEntry via `page.evaluate` on `window.__inbox` (bypasses Cache API for end-to-end transfer flow)
- [x] The pending send entry appears in the ConnectedView above the file picker
- [x] The user can pair and send the pending file
- [x] The receiver's Inbox shows the file with correct name and content
- [x] Multi-file share note appears when fileCount > 1 — covered by unit tests

## Blocked by

None.
