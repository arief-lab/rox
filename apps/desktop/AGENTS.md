# Desktop App (Nextron: Next.js + Electron)

## Purpose

- `apps/desktop` — desktop client built with Nextron (Electron main process + statically-exported Next.js renderer)
- Will be the flagship transfer client: the Electron main process is full Node and will host the Pear-stack transport (Hyperswarm/Hypercore) via `@rox/core` adapters

## Ownership

- Electron main process (`main/`), preload bridge, renderer pages and future feature modules
- Does not own the transfer protocol or transports — those live in `packages/core`; this app selects/wires an adapter at startup

## Local Contracts

- Process model: **main = shell + data plane, renderer = view** (mirrors Pear's hello-pear-electron split)
- **Transfer data plane lives in `main/transfer/`**:
  - `main/transfer/hyper-adapter.ts` — `HyperSeeder` (seeds a file into a one-entry Hyperdrive, announces on Hyperswarm, sends `hyper-offer`) and `HyperReceiver` (replicates, downloads, replies `hyper-accepted`/`hyper-release`); both drive `HyperTransferMachine` from `@rox/core`
  - `main/transfer/session.ts` — registers typed IPC handlers (`transfer:send`, `transfer:receive`, `transfer:cancel`, `transfer:release`, `device:get`, `device:setName`, `history:list`, `history:clear`) and streams `transfer:event` back to the renderer; peers connect over a shared Hyperswarm topic with Protomux multiplexing signals + drive replication on one socket
  - `main/transfer/identity.ts` — device display name (electron-store, defaults to OS hostname); exchanged as a `pair-hello` signal (defined in `@rox/core` signaling) when a peer connection opens; the session emits `{ type: "peer", status, device, confirmed }` events so the renderer knows who it's paired with and whether both sides approved
  - `main/transfer/trusted-devices.ts` — persisted list of device ids the user explicitly accepted (electron-store, capped at 50); a hello from a trusted id auto-accepts, skipping the confirmation prompt on repeat pairings. `trust:list` / `trust:revoke` IPC let the renderer manage the list (`features/transfer/trusted-devices.tsx` on the home screen); revoking restores the prompt for that device. Trust-list auto-accepts set a `trusted` flag on the peer event, which the pairing indicator renders as a "Trusted" shield badge next to the paired device name
- Pairing confirmation is a **two-sided handshake**: hello (identity) → `pair-accept`/`pair-reject` from each side (renderer calls `window.ipc.pair.accept/reject`); a transfer offer from a peer whose pairing is not confirmed by BOTH sides is dropped and surfaced as an error event; a `pair-reject` closes the connection immediately
  - `main/types/hyper.d.ts` — ambient declarations for corestore/hyperdrive/hyperswarm (they ship no types)
- The `hyperdrive`/`corestore`/`hyperswarm` npm deps are intentionally declared HERE (adapter layer), not in `packages/core`
- Renderer is **dark-only**: `renderer/pages/_app.tsx` carries the `dark` class root wrapper that activates the shared theme; `renderer/styles/globals.css` imports `@rox/ui/globals.css` (design tokens) and sets `bg-background`/`text-foreground` on body
- Renderer styling uses shared token utilities from `@rox/ui` (`bg-send`, `text-receive`, `bg-card`, `text-muted-foreground`, `text-destructive`, …) — do not hardcode palette classes (`emerald-*`, `sky-*`, `neutral-*`)
- Renderer never imports Node-only or `@rox/core` internals; it talks to main over the IPC bridge in `main/preload.ts` (`window.ipc.transfer`)
- Zone layout (enforced by fallow boundaries, see root `.fallowrc.json`):
  - `main/**` — may import `@rox/core`, `@rox/env`, `renderer/shared`
  - `renderer/features/**` — sibling-isolated via autoDiscover; may import `renderer/shared`
  - `renderer/shared/**` — may import `@rox/ui`, `@rox/env`
  - `renderer/pages/**` — may import features + shared
- `renderer/next.config.ts` uses `output: 'export'`; no SSR/server actions in the renderer
- Build: `nextron build` packages via electron-builder into `dist/`; renderer production output goes to `../app`

## Work Guidance

- New transfer/pairing UI goes in `renderer/features/<name>/`, one folder per feature; it calls only `window.ipc.transfer.*` (or `window.ipc.getPathForFile` for dropped files) — never the adapter directly. Transfer UI is a **guided wizard**: `features/transfer/wizard.tsx` (shared shell/steps), `send-wizard.tsx` (dropzone → offer QR), `receive-wizard.tsx` (scan/paste → done), with the mode chooser on `renderer/pages/home.tsx`. Dropped files resolve to paths via the preload's `getPathForFile` (Electron `webUtils`)
- New IPC channels: define handler in `main/transfer/session.ts`, expose typed surface via `main/preload.ts`; keep the renderer side typed with a `preload.d.ts` declaration. The preload also exposes `getPathForFile` (`webUtils.getPathForFile`) for drag-and-drop file paths and `files.search`/`files.browse` (filename search over common user folders + native open dialog; handlers in `main/main.ts`)
- Offer clipboard affordances (`main/main.ts`): the send wizard pushes the current `rox1:` payload over `offer:payload` while the offer step is showing; the main process then shows a native "Copy Rox offer" context-menu item anywhere in the window and binds Ctrl+Shift+C to copy it. With no active offer, right-click falls back to the default menu and the accelerator is inert
- Window is a compact utility (760×560, min 620×480, max 1100×800); home screen content is vertically centered
- Transfer progress: the session polls the adapter's byte counters (`HyperSeeder.uploadProgress` / `HyperReceiver.downloadProgress`, from hypercore peer stats) every 500 ms and streams `{ type: "progress", direction, bytes, total }` on `transfer:event`; the renderer derives bar/speed/ETA in `features/transfer/transfer-progress.tsx`
- Recent transfers: completed transfers are persisted by the session via `main/transfer/history.ts` (electron-store, max 30); records carry the paired device's display name (`peerName`, captured from the pairing state at completion) and the renderer shows it as "to/from <name>" in `features/transfer/recent-transfers.tsx`
- Pairing UI: `features/transfer/pairing-indicator.tsx` renders the handshake stages (waiting → confirm with safety code + Accept/Reject buttons → waiting for remote → paired with "<name>"); it appears in the send wizard's offer step and the receive wizard's offer step, driven by `state.peerConnected`/`state.pairedDevice`/`state.pairingConfirmed` from `use-transfer`
- Safety code: during the confirm stage both devices display a shared two-group code derived via `pairSafetyCode(localId, peerId)` from `@rox/core` (pure function of the sorted device ids — symmetric by construction, tested in `packages/core/tests/pairing-signals.test.ts`). The renderer needs the local device id, so `home.tsx` passes `localId` into both wizards alongside `localName`
- Sender verification in QR: the sender's device id is baked into the offer payload (`rox1:<driveKey><topic>:sender=<id>,name=…`), so a receiver can derive and compare the safety code from the QR alone — BEFORE any connection exists. `transfer:send` returns `senderId`, the send wizard encodes it into the QR, and the receive wizard shows the pre-connect code when the scanned payload carries it. The segment is optional: legacy payloads without it fall back to the in-band hello
- Root AGENTS.md standards apply (Ultracite/Biome)

## Verification

- `bun run check-types` (turbo) must pass
- `npx fallow` must show zero boundary violations for desktop zones

## Child DOX Index

- (none)
