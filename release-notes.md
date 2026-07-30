First alpha release of Rox — peer-to-peer file sharing directly between browsers via WebRTC.

### Features
- QR code pairing (offerer/answerer)
- WebRTC data channel file transfer (up to 500 MB)
- Inbox with save/discard
- PWA install prompt + share target integration
- Device name customization
- Progress UI with cancellation
- E2E test coverage for all flows
- Dark mode
- Offline shell (service worker cache)

### Stack
- Next.js 16 + React 19 + TypeScript 6
- WebRTC (native browser APIs)
- Tailwind CSS 4
- Turborepo + Bun workspaces
- Vitest + Playwright
