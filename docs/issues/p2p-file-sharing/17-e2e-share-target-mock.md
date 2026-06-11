Status: ready-for-agent

## What to build

A Playwright E2E test that simulates the share-target flow. Since Playwright cannot trigger the OS share sheet, the test mocks a `multipart/form-data` POST to `/share-target` (the service worker intercept) and verifies the entire chain: file lands in the pending-send queue, the user can pair and send it, and the receiver gets it in their Inbox.

Modules touched:

- `apps/web/tests/e2e/share-target.spec.ts` — new E2E spec

User stories covered: 26, 27.

## Acceptance criteria

- [ ] Mock a POST to `/share-target` with a file (using `page.evaluate` or `page.route` to simulate the SW response)
- [ ] The share-target page renders with the file's name, size, and "Ready to send" badge
- [ ] Clicking "Send this file" navigates to the home page with the file as a pending send entry
- [ ] The pending send entry appears in the ConnectedView above the file picker
- [ ] The user can pair and send the pending file
- [ ] The receiver's Inbox shows the file with correct name and content
- [ ] Multi-file share note appears when fileCount > 1

## Blocked by

None.
