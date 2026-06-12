# Rox — P2P File Sharing & Local Streaming

> **Alpha v0.0.1** — peer-to-peer file sharing over WebRTC, right in your browser.

Rox is a progressive web app (PWA) that lets you share files directly between devices **without any server storing your data**. No uploads, no cloud, no accounts — just a QR code, a WebRTC connection, and files that never leave your control.

This is a reimagining of my earlier work in a new language, architecture, and stack.

---

## Features

- **P2P File Sharing** — Share files of any size (up to 500 MB) directly between browsers
- **No Server Storage** — Data channels are peer-to-peer; nothing is stored on any intermediary
- **QR Code Pairing** — One device shows a QR code, the other scans it — instant WebRTC connection
- **Multi-file Inbox** — Receive, save, or discard files with a familiar inbox UI
- **PWA Ready** — Install on your home screen (Android, iOS, Desktop). Share target integration for receiving from any app
- **Dark Mode** — Light, dark, or system theme
- **Device Name** — Customize how your device appears to peers
- **Offline Shell** — Works offline when installed (cached service worker shell)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (React 19) |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 4 |
| P2P | WebRTC (native browser APIs) |
| State | Class-based state machines + React hooks |
| Monorepo | Turborepo + Bun workspaces |
| UI Kit | Custom shared primitives (`@rox-apps/ui`) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Quality | Ultracite (Biome) + Husky pre-commit hooks |

---

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Open http://localhost:3001
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in development |
| `bun run build` | Build all apps |
| `bun run check-types` | TypeScript type checking across all packages |
| `cd apps/web && bun run test` | Run unit tests (Vitest) |
| `cd apps/web && bun run test:e2e` | Run Playwright E2E tests |
| `bun x ultracite fix` | Auto-format and lint fix |

---

## Roadmap

### v0.0.1-alpha (current) — P2P File Sharing
- [x] QR code pairing (offerer/answerer)
- [x] WebRTC data channel file transfer
- [x] Inbox with save/discard
- [x] PWA install prompt + share target
- [x] Device name customization
- [x] Progress UI with cancellation
- [x] Error handling and edge cases
- [x] Offline shell (service worker cache)
- [x] 500 MB transfer size guard
- [x] E2E test coverage for all flows

### v0.1.0 — Improved UI/UX + Streaming Foundations
- [ ] Redesigned mobile-first UI
- [ ] Drag-and-drop file sending
- [ ] Multiple file selection
- [ ] Transfer history / session log improvements
- [ ] Local network discovery (mDNS / LAN)
- [ ] Streaming architecture design

### v0.2.0 — Local Media Streaming
- [ ] Screen casting between devices on same network
- [ ] Real-time media streaming via WebRTC (video/audio)
- [ ] Playback controls (play, pause, seek)
- [ ] Stream from mobile to desktop (and vice versa)
- [ ] Subtitle/closed caption support

### v0.3.0 — Advanced Features
- [ ] End-to-end encryption (layered on WebRTC's DTLS)
- [ ] File sharing resumption (partial transfer recovery)
- [ ] Directory/folder sharing
- [ ] Custom relay/TURN server configuration
- [ ] Bandwidth adaptation for streaming quality

---

## License

AGPL-3.0 © [arief-lab](https://github.com/arief-lab)

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

```
Rox — P2P File Sharing & Local Streaming
Copyright (C) 2026 arief-lab

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

---

## Architecture

This project is a reimagining of prior P2P work, rebuilt with a different language, architecture, and toolchain. The core design principles:

- **Peer-to-peer by default** — No server is ever a data intermediary
- **State machines for flow control** — Pairing and transfer state machines are pure classes, testable without DOM or React
- **Observable stores** — The Inbox is a typed observable store with fine-grained events
- **Screen → View composition** — Screens own state and dispatch; views are pure render components
- **Shared UI primitives** — All UI comes from a shared `@rox-apps/ui` package (inspired by shadcn/ui patterns)

