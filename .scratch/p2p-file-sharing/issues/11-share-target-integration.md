Status: ready-for-agent

## What to build

The PWA registers as a target in the OS share sheet. When a user in Photos, Files, WhatsApp, Mail, etc. taps "Share → [this app]", the shared file is delivered to the app via a service-worker-handled POST. The app receives the file, queues it in the Inbox as a "ready to send" item, and the user can pick a peer and send it.

Modules touched:

- `apps/web/src/app/manifest.ts` — add `share_target` action (with `method`, `enctype`, `params`)
- `apps/web/src/app/share-target/page.tsx` — route that handles the share payload and presents the file in a "ready to send" state
- `apps/web/public/sw.js` — handler for the `share_target` POST
- `apps/web/src/lib/inbox/store.ts` — extend to support "pending send" entries

User stories covered: 26, 27.

## Acceptance criteria

- [ ] `manifest.ts` includes a `share_target` action with `method: POST`, `enctype: multipart/form-data`, and `params.files` (or the equivalent)
- [ ] The `/share-target` route accepts the shared file and presents it in a "ready to send" state
- [ ] From a single-file share, the file is queued with the file's MIME type and name preserved
- [ ] Multi-file shares are dropped to the first file with a UI note (per the PRD's Out-of-Scope note)
- [ ] Playwright E2E: simulate a share via `page.evaluate` (or the `Web Share Target` API stub) and assert the file is queued
- [ ] Manual test (HITL): share a photo from the iOS Photos app to the installed PWA, confirm it lands in the "ready to send" state

## Blocked by

- `.scratch/p2p-file-sharing/issues/10-pwa-shell-manifest-sw-offline.md`
