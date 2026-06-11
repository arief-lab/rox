Status: ready-for-agent

## What to build

Each device has a friendly label that the other side sees during a Session and in each Inbox row. The label is auto-generated from `navigator.userAgent` on first run ("iPhone", "MacBook Pro") and stored in `localStorage`. A small settings screen lets the user override it. The label persists across Sessions.

Modules touched:

- `apps/web/src/lib/device-name/` — `generate(ua)` (the auto heuristic), `get()`, `set(name)`, `localStorage` round-trip
- `apps/web/src/components/SettingsScreen.tsx` — the override UI
- `apps/web/src/components/InboxRow.tsx` — display the sender's Device Name
- `apps/web/src/components/PairingScreen.tsx` — display the peer's Device Name

User stories covered: 32, 33, 34, 35.

## Acceptance criteria

- [ ] On first run, the auto-generated name is shown in the home screen and the UI doesn't prompt for one
- [ ] The auto-generated name is one of: "iPhone", "iPad", "Mac", "MacBook Pro", "Windows", "Android", or similar — derived from `navigator.userAgent`
- [ ] Settings screen has a text input with the current name; saving updates `localStorage` and updates all in-UI labels immediately
- [ ] The Device Name persists across reloads and across Sessions
- [ ] Vitest unit: `generate(ua)` on a representative set of UA strings (iPhone Safari, Mac Chrome, Windows Firefox, etc.)
- [ ] Playwright E2E: open settings, change name, pair with another context, see the new name in the peer's UI and in the Inbox row

## Blocked by

- `.scratch/p2p-file-sharing/issues/01-scaffold-qr-roundtrip.md`
