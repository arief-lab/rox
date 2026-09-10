# Core Package (Transfer Domain)

## Purpose

- `packages/core` — transport-agnostic transfer domain: pairing, session, transfer protocol, and state machines
- Hexagonal shape: `domain/` owns pure protocol logic, `ports/` declares interfaces the outside world must satisfy, `adapters/` implements ports for specific transports (Pear/Hyperswarm, WebRTC, in-memory mock)

## Ownership

- Chunk framing, transfer/pairing state machines, protocol messages, transport abstraction
- Does not own UI, RPC routers, or DB schema. Apps depend on the public port only; adapter selection happens in app bootstrap code (e.g. desktop main process picks the Hyperswarm adapter)

## Local Contracts

- `src/ports/transport.ts` — the `Transport` interface: the only channel abstraction the domain speaks through. Adapters implement it; domain never imports an adapter
- `src/domain/transfer/` — chunk protocol (CHUNK_SIZE 16 KB, binary frame format), state machines (idle → sending/receiving → completed/failed/cancelled; illegal transitions throw)
- Wire format is stable: fileId + offset + length + payload (little-endian packed); control messages are JSON strings on the same transport
- Deps: `@rox/env` and `zod` only — no UI, no oRPC, no DB. Boundary rule: `core → env` only

## Work Guidance

- Domain code must stay pure (no transport calls, no globals); drive state machines from adapters or higher layers
- Any new transport (Hyperswarm, WebRTC DataChannel, mock) is a new adapter in `src/adapters/` implementing `Transport`
- Port the original AGPL-licensed protocol logic from the `ui-update` branch history when fidelity matters

## Verification

- `bun run check-types` (turbo) must pass
- `npx fallow` must show zero boundary violations

## Child DOX Index

- (none)
