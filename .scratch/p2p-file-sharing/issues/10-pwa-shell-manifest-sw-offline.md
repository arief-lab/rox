Status: ready-for-agent

## What to build

The PWA shell: the existing `apps/web/src/app/manifest.ts` is verified-complete and extended; a service worker is added that precaches the app shell HTML/JS/CSS/icons so the app launches and is usable offline after the first install. The app installs to the home screen.

Modules touched:

- `apps/web/src/app/manifest.ts` — verify and extend (icons, start_url, display, theme_color already present)
- `apps/web/public/sw.js` (or `apps/web/src/lib/pwa/sw.ts` compiled) — precache list, install/activate/fetch handlers
- `apps/web/src/components/InstallPrompt.tsx` — a small "Install app" banner that appears on second visit
- `apps/web/src/lib/pwa/register-sw.ts` — registers the SW from a client component on first load

User stories covered: 28, 29, 30.

## Acceptance criteria

- [ ] `manifest.ts` validates against the PWA manifest spec (start_url, display, icons at 192/512)
- [ ] Service worker registers successfully on first load
- [ ] After the first install, the app launches in airplane mode and is fully usable (Pair, Transfer, Inbox — all working offline)
- [ ] App installs to the home screen on Android Chrome and iOS Safari 17+
- [ ] Playwright E2E: simulate offline mode after first visit; assert the home page renders
- [ ] Lighthouse PWA audit passes (installable, offline-capable)

## Blocked by

- `.scratch/p2p-file-sharing/issues/06-bidirectional-ephemeral-session.md`
