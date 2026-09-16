# Rox

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-61DAFB?logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)
![Hypercore](https://img.shields.io/badge/Peer--to--Peer-Hypercore-7C3AED)
![Bun](https://img.shields.io/badge/Bun-F9F1F1?logo=bun&logoColor=black)
![License](https://img.shields.io/badge/License-AGPL--3.0-blue)

Send files straight from one of your devices to another. No accounts, no cloud, no middleman — your file goes from your screen to their screen, and nowhere else.

> **⚠️ Alpha** — Rox is under active development. Things break, the wire format may change between versions, and you should not rely on it for anything important yet.

## How it works

1. **Open Rox on both devices** (desktop and/or phone) — they find each other automatically on the same network.
2. **Pair once** — both devices show a short safety code. If the codes match, both sides accept, and the devices remember each other.
3. **Send** — pick a file, pick a paired device, done. The file travels directly between the two devices; it is never uploaded anywhere.

No network? Rox can still move a file **screen to camera**: the sender's screen flashes a series of QR codes, the receiver's camera scans them, and the file reassembles on the other side — completely offline.

## What Rox can do

- **Send files device-to-device** — directly, without any server in between
- **Pair devices safely** — a matching safety code on both screens makes sure you're talking to the device you think you are
- **Trust your devices** — devices you've accepted before pair automatically next time; revoke trust anytime
- **See live progress** — transfer speed and progress while a file moves
- **Keep a local history** — recent transfers, stored only on your device
- **Beam without a network** — send a file (or just typed text) through QR codes, air-gap optional
- **Copy an offer instead** — generate a transfer offer as a code or QR you can share through any channel; the receiver pastes or scans it to start

## Development

Requirements: [Bun](https://bun.sh). The native app also needs a local Android/iOS toolchain (dev builds only — no Expo Go).

```bash
bun install
bun run dev:desktop   # desktop app
bun run dev:native    # mobile app
bun run dev:web       # website
```

Quality checks:

```bash
bun run check          # lint + format
bun run check-types    # TypeScript
```

## License

[Distributed under the GNU AGPL-3.0](./LICENSE). The transfer protocol stays open — any modified version, including one offered as a network service, must share its source.
