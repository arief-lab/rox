# Core Package (Transfer Domain)

## Purpose

- `packages/core` — transport-agnostic transfer domain with two paths:
  - **Hyper path** (`domain/hyper/`) — the flagship desktop transfer mechanism: sender seeds a Hyperdrive, shares its key over signaling, receiver replicates via Hyperswarm. Bulk data never passes through the Transport port.
  - **WebRTC path** (`domain/webrtc/`) — the chunked protocol (16 KB binary frames through the Transport port itself) for transports where Hypercore cannot run.
- Hexagonal shape: `domain/` owns pure protocol logic, `ports/` declares interfaces the outside world must satisfy, `adapters/` implements ports for specific transports (Pear/Hyperswarm, WebRTC, in-memory mock)

## Ownership

- Signaling protocol (drive-key exchange), both transfer state machines, chunk framing, transport abstraction
- Does not own UI, RPC routers, or DB schema. Apps depend on the public port only; adapter selection happens in app bootstrap code (e.g. desktop main process picks the Hyperswarm/Hyperdrive adapter)
- The `hyperdrive` and `hyperswarm` npm packages belong to the desktop adapter layer, NOT to this package — core stays transport-free and testable

## Local Contracts

- `src/ports/transport.ts` — the `Transport` interface. In the Hyper path it carries signaling only (hyper-offer / hyper-accepted / hyper-release JSON messages); in the WebRTC path it carries chunk frames and control messages
- `src/domain/hyper/signaling.ts` — zod-validated signaling messages (driveKey, topic are 32-byte hex); `hyper-transfer-machine.ts` — states idle → offering/receiving → completed/failed/cancelled
- `src/domain/webrtc/transfer/` — chunk protocol (CHUNK_SIZE 16 KB, little-endian binary frame), chunked state machine; illegal transitions throw in both machines
- Wire formats are stable: signaling is JSON (zod-validated); chunk frame is fileId+offset+length+payload packed binary
- Deps: `@rox/env` and `zod` only — no UI, no oRPC, no DB, no hyper* packages. Boundary rule: `core → env` only

## Work Guidance

- Domain code must stay pure (no transport calls, no globals); drive machines from adapters or higher layers
- New transports (Hyperswarm, WebRTC DataChannel, mock) are new adapters in `src/adapters/` implementing `Transport`
- Cancel/resume semantics differ per path: Hyperdrive cancels by closing the drive and discarding partial state (Hypercore resumes natively); the chunked path cancels via the CancelMessage while keeping the transport open
- Port fidelity: original AGPL-licensed protocol logic came from the `ui-update` branch history

## Verification

- `bun run check-types` (turbo) must pass
- `npx fallow` must show zero boundary violations

## Child DOX Index

- (none)
