# Rox

Peer-to-peer file transfer between your devices — no accounts, no cloud, no intermediary servers holding your bytes.

Rox moves files directly between desktop and mobile over three independent paths:

- **Hyper path** (flagship) — the sender seeds a one-entry Hyperdrive; the receiver replicates it over Hyperswarm. Bulk data flows peer-to-peer; the signaling channel only exchanges drive keys.
- **Optical beam** — fountain-coded QR codes: file plays on the sender's screen, the receiver's camera scans it. Zero network, air-gapped by construction.
- **WebRTC path** — the chunked fallback protocol (16 KB binary frames) for transports where Hypercore cannot run.

Pairing is two-sided: both devices show a matching safety code derived from their device ids, both must accept, and trusted devices skip the prompt on repeat pairings.

## Monorepo Layout

Built as a Bun + Turborepo workspace:

```
rox/
├── apps/
│   ├── desktop/    # Nextron (Electron + Next.js) flagship client
│   │   ├── main/       # Electron main: Pear-stack data plane (Hyperswarm/Hyperdrive), IPC session
│   │   └── renderer/   # Next.js static-export UI: transfer wizards, pairing, beam sender
│   ├── native/     # Expo React Native client — Pear stack runs in a Bare worklet
│   └── web/        # Next.js marketing site
└── packages/
    ├── core/       # Transport-agnostic transfer domain (hexagonal): state machines, signaling,
    │               # chunk + optical codecs, Transport port. No UI, no transport deps
    ├── ui/         # Shared UI primitives (shadcn web, HeroUI native) + design tokens
    ├── env/        # Typed env validation per runtime
    └── config/     # Shared tsconfig / tooling config
```

## Features

- **Direct device transfer** — discover nearby peers over a well-known Hyperswarm topic, pair with a two-sided safety-code handshake, send directly (offer queued until pairing confirms) or share an offline `rox1:` offer via QR / clipboard
- **Live progress** — byte counters streamed from the transfer adapters every 500 ms; the UI derives progress bar, speed, and ETA
- **Transfer history** — recent completed transfers (peer name, direction), stored locally
- **Trusted devices** — explicitly accepted devices auto-pair afterwards; revocable
- **Optical beam** — send files or typed text screen-to-camera, with SHA-256 verification on receive
- **Dark-only machine-voice design** — protocol data (keys, codes, topics) in mono, human text in sans; verified WCAG AA contrast

## Tech Stack

- **TypeScript** end to end, Bun workspaces + Turborepo
- **Nextron** (Electron + statically exported Next.js) for desktop
- **Expo / React Native** for mobile, with the Pear stack (Hypercore/Hyperswarm) running in a Bare worklet
- **Hypercore / Hyperdrive / Hyperswarm** (Holepunch's Pear stack) for P2P transport
- **zod**-validated wire protocols (signaling, worklet RPC, QR offers)
- **TailwindCSS v4** + shared shadcn/ui primitives
- **Biome (via Ultracite)** for lint/format, **fallow** for import-boundary enforcement

## Getting Started

Requirements: [Bun](https://bun.sh), and for the native app a local Android/iOS toolchain (dev builds only — no Expo Go, the worklet needs native modules).

```bash
bun install
```

Run a single app in dev:

```bash
bun run dev:desktop   # Nextron desktop client
bun run dev:native    # Expo dev server
bun run dev:web       # Marketing site
```

Desktop supports multi-instance testing (sender + receiver side by side): set `ROX_USER_DATA_SUFFIX` in `apps/desktop/.env` (see `apps/desktop/.env.example`) to isolate each instance's userData.

## Quality Checks

```bash
bun run check          # Biome lint + format (Ultracite)
bun run check-types    # TypeScript across the workspace
```

## License

[Distributed under the GNU AGPL-3.0](./LICENSE). The transfer protocol logic in `packages/core` is and stays open — network-copyleft applies to any modified version, including one offered as a network service.
