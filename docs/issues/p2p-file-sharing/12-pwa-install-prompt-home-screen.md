Status: ready-for-agent

## What to build

A visible install prompt that appears after a few visits (or on a relevant user action like a successful transfer). On iOS Safari (which doesn't fire `beforeinstallprompt`), the prompt shows explicit "Add to Home Screen" instructions with an arrow pointing at the share button.

Modules touched:

- `apps/web/src/components/InstallPrompt.tsx` — listens for `beforeinstallprompt` on Android Chrome; falls back to iOS instructions on Safari
- `apps/web/src/lib/pwa/install-prompt.ts` — small store for the deferred prompt event; user-dismissal is remembered in `localStorage` so we don't nag
- `apps/web/src/app/page.tsx` — wires the prompt to render

User stories covered: 31.

## Acceptance criteria

- [ ] On Android Chrome, the install prompt appears once per device (or once per dismissal) and installs the PWA on tap
- [ ] On iOS Safari 17+, the prompt shows a small visual guide ("tap the share button, then 'Add to Home Screen'")
- [ ] On desktop Chrome / Edge, the same flow as Android
- [ ] Once the user has installed (or dismissed N times), the prompt is suppressed
- [ ] Playwright E2E: stub `beforeinstallprompt`, fire it, assert the prompt UI renders and the install action calls the deferred prompt's `prompt()`
- [ ] Manual test (HITL): on an actual iPhone, verify the iOS instructions are visible and accurate

## Blocked by

- `.scratch/p2p-file-sharing/issues/10-pwa-shell-manifest-sw-offline.md`
