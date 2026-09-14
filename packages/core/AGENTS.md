# Core Package (Transfer Domain)

## Purpose

- `packages/core` — transport-agnostic transfer domain with three paths:
  - **Hyper path** (`domain/hyper/`) — the flagship desktop transfer mechanism: sender seeds a Hyperdrive, shares its key over signaling, receiver replicates via Hyperswarm. Bulk data never passes through the Transport port.
  - **WebRTC path** (`domain/webrtc/`) — the chunked protocol (16 KB binary frames through the Transport port itself) for transports where Hypercore cannot run.
  - **Optical path** (`domain/optical/`) — fountain-coded QR transfer (screen to camera, no network). No Transport port at all: frames ride QR codes rendered/read by app adapters.
- Hexagonal shape: `domain/` owns pure protocol logic, `ports/` declares interfaces the outside world must satisfy, `adapters/` implements ports for specific transports (Pear/Hyperswarm, WebRTC, in-memory mock)

## Ownership

- Signaling protocol (drive-key exchange), both transfer state machines, chunk framing, transport abstraction
- Does not own UI, RPC routers, or DB schema. Apps depend on the public port only; adapter selection happens in app bootstrap code (e.g. desktop main process picks the Hyperswarm/Hyperdrive adapter)
- The `hyperdrive` and `hyperswarm` npm packages belong to the desktop adapter layer, NOT to this package — core stays transport-free and testable

## Local Contracts

- `src/ports/transport.ts` — the `Transport` interface. In the Hyper path it carries signaling only (hyper-offer / hyper-accepted / hyper-release JSON messages); in the WebRTC path it carries chunk frames and control messages
- `src/domain/hyper/signaling.ts` — zod-validated signaling messages (driveKey, topic are 32-byte hex) plus the pairing vocabulary (`pair-hello`, `pair-accept`, `pair-reject`) and `pairSafetyCode(deviceIdA, deviceIdB)` — a symmetric derivation of the code both devices display during pairing confirmation; `hyper-transfer-machine.ts` — states idle → offering/receiving → completed/failed/cancelled
- `src/domain/hyper/qr-offer.ts` — `rox1:<driveKey><topic>` base layout with optional `key=value` segments after a colon (currently `sender=<16-hex device id>`, `name=<percent-encoded>`); `sender` lets receivers verify the safety code from the QR alone before connecting, and is optional for legacy tolerance
- `src/domain/hyper/worklet-rpc.ts` — the native worklet RPC contract (host ↔ Bare worklet): JSON envelopes `{v, id, kind: req|res|evt}` riding the Transport port, zod-validated on decode, commands mirroring the desktop session IPC. Pure protocol — the host client lives in apps/native/lib, the dispatcher in the worklet core source
- LAN presence (pair-first discovery): `DISCOVERY_TOPIC` = `sha256("rox-discovery-v1")` exported from `domain/hyper` — the well-known topic every instance joins; `pair-ping`/`pair-pong` heartbeat signals extend the pairing vocabulary so peers prove liveness. Identity still flows via `pair-hello`; no new transport machinery
- `src/domain/webrtc/transfer/` — chunk protocol (CHUNK_SIZE 16 KB, little-endian binary frame), chunked state machine; illegal transitions throw in both machines
- `src/domain/optical/` — LT fountain codec + QR frame format for the screen-to-camera path. Wire format: length-prefixed frames (magic `0x52`, type, encoding flag) — header frames carry fileId/pieceCount/pieceSize/originalLength/sha256 (hex-ASCII fields so binary and text encodings share one layout); symbol frames carry `{seed, payload}`. Symbols are fully deterministic in the seed (mixSeed avalanche + xorshift32 PRNG + robust-soliton-style degree), so the decoder rebuilds piece adjacency from seeds alone and the pipeline is testable without a camera. Dual encoding (binary Uint8Array / base64 string) serves both camera paths: raw-pixel WASM decoders (binary) and native barcode scanners that expose string payloads only (text). Peeling decoder reports decodedPieces so a stuck decode is detectable, never silent garbage. QR rendering/camera capture belong to app adapters — nothing QR-specific lives here
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
