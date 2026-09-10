# Desktop App (Nextron: Next.js + Electron)

## Purpose

- `apps/desktop` — desktop client built with Nextron (Electron main process + statically-exported Next.js renderer)
- Will be the flagship transfer client: the Electron main process is full Node and will host the Pear-stack transport (Hyperswarm/Hypercore) via `@rox/core` adapters

## Ownership

- Electron main process (`main/`), preload bridge, renderer pages and future feature modules
- Does not own the transfer protocol or transports — those live in `packages/core`; this app selects/wires an adapter at startup

## Local Contracts

- Process model: **main = shell + data plane, renderer = view** (mirrors Pear's hello-pear-electron split)
- Renderer never imports Node-only or `@rox/core` internals; it talks to main over the IPC bridge in `main/preload.ts` (`window.ipc`)
- Zone layout (enforced by fallow boundaries, see root `.fallowrc.json`):
  - `main/**` — may import `@rox/core`, `@rox/env`, `renderer/shared`
  - `renderer/features/**` — sibling-isolated via autoDiscover; may import `renderer/shared`
  - `renderer/shared/**` — may import `@rox/api`, `@rox/ui`, `@rox/env`
  - `renderer/pages/**` — may import features + shared
- `renderer/next.config.ts` uses `output: 'export'`; no SSR/server actions in the renderer
- Build: `nextron build` packages via electron-builder into `dist/`; renderer production output goes to `../app`

## Work Guidance

- New transfer/pairing UI goes in `renderer/features/<name>/`, one folder per feature
- New IPC channels: define handler in `main/`, expose typed surface via `main/preload.ts`; keep the renderer side typed with a `preload.d.ts` declaration
- Root AGENTS.md standards apply (Ultracite/Biome)

## Verification

- `bun run check-types` (turbo) must pass
- `npx fallow` must show zero boundary violations for desktop zones

## Child DOX Index

- (none)
