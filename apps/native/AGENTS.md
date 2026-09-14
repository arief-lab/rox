# Native App (Expo)

## Purpose

- `apps/native` — mobile client built with Expo Router, React Native, and Tailwind (uniwind)
- Transfer client: the Pear stack (Hyperswarm/Hypercore) runs in a Bare worklet (`react-native-bare-kit`) — the native twin of the desktop's Electron main data plane
- File-based routes under `app/` (drawer + tabs layout scaffolded)

## Ownership

- Mobile screens, navigation structure, native-specific components and contexts
- Does not own the transfer domain (owned by `packages/core`)

## Local Contracts

- **Bare worklet data plane (TASK-6, in progress)**: the worklet hosts the Pear-stack transfer core; the UI never imports Node/Pear modules directly
  - **Pear stack wiring**: the real core is `worklet/app.js` (CommonJS — it runs in Bare, not Metro) requiring `hyperdrive`, `hyperswarm`, `b4a`, `bare-crypto`, `bare-fs`. Bundle it with `bash scripts/bundle-worklet.sh` (bare-pack `--linked`, multi-host android/ios) → `lib/worklet.bundle.mjs` (~1.85 MB, committed). `lib/worklet.ts` loads the bundle when present (`/app.bundle` + asset URI; Metro serves `.mjs` as an asset via `assetExts.push`) and falls back to the inlined stub source otherwise — the app must boot before the first bundle run. Pear packages are DEV deps of the app: they exist only for bare-pack's module graph, never imported by RN code. The `linked:` addon specifiers in the bundle (.so for sodium, rocksdb, udx, quickbit, …) must be satisfied by the native build — bare-runtime prebuilds wired at link time; this is the remaining on-device risk
  - Seeding contract: host writes the file into the worklet sandbox (expo-file-system cache dir = worklet cwd), then `transfer:send {filePath}` → worklet creates a one-entry Hyperdrive, `drive.put`, joins `sha256("rox-topic:"+key)`, replies `{driveKey, senderId, topic}`. Receive: join topic, `drive.list` → first entry, `drive.get` → write to `rox-transfers/`, reply `{path}`. Peer signaling arrives on swarm connections as newline-delimited JSON and forwards to the host as `signal` events
  - `lib/worklet.ts` — singleton worklet host: `ensureWorklet()` starts `/app.js` from `CORE_SOURCE` (`lib/worklet-core-source.ts`, inlined because Metro has no asset-as-string loader; `worklet/core.js`-style standalone file was dropped). Wires `AppState` background→`worklet.suspend()` / active→`resume()` — the worklet MUST stop all I/O when backgrounded or the OS force-terminates it
  - `lib/bare-transport.ts` — `BareTransport`, the native implementation of `@rox/core`'s Transport port over the worklet IPC duplex. IPC is a raw byte stream with no message boundaries, so frames are u32-LE length-prefixed; the adapter buffers and splits. Native twin of desktop's `ProtomuxTransport` (same port, same domain machine, different host shell)
  - **RPC seam (contract in `@rox/core` domain/hyper/worklet-rpc)**: JSON envelopes over the Transport port — `{v, id, kind: req|res|evt}` frames, zod-validated on decode, same JSON convention as the signaling wire. Commands mirror the desktop session's IPC handlers (transfer:send/receive/cancel/release, peers:discover, device:*); events push signaling (parsed with `parseSignal` on the host), transfer states, progress, and done/error. Host side: `lib/worklet-rpc-client.ts` (id-correlated replies with timeouts, event subscriptions); worklet side: the dispatcher in `worklet-core-source.ts` (state machines + handlers; Pear-stack seeding/replication return explicit not-wired errors until the next slice). Encoding gotcha, found by the round-trip test: decode inbound bytes with `Buffer.from(data).toString('utf8')` — a plain Uint8Array's `toString()` yields comma-joined digits, which silently fails JSON.parse
  - `app/(drawer)/worklet-dev.tsx` — dev-only echo probe proving the RN↔worklet bridge; the echo protocol lives in the core source and gets replaced by hyper signaling next
  - Android needs `minSdkVersion 31` + `useLegacyPackaging: true` (expo-build-properties, already in app.json). react-native-b4a provides b4a's native bits; plain `b4a` covers the UI side
  - Dev builds only: bare-kit native modules require a dev build (`expo run:ios|android`), not Expo Go
- **Beam (optical transfer, `app/(drawer)/beam.tsx` + `app/beam-send.tsx` + `app/beam-compose.tsx` + `app/beam-receive.tsx`, glue in `lib/beam.ts`)**: screen-to-camera file transfer on the core optical codec (`domain/optical`). One-way, unencrypted (all screens say so). Sender: `beam-send` offers a file picker (`expo-document-picker` → `fetch(uri)` → bytes → `createBeamSessionFromBytes`) or typed text (`beam-compose` → `createBeamSession`); looping base64-text symbol frames rendered as white-on-black QRs fullscreen with brightness maxed (restore on exit). Receiver: `CameraView` `onBarcodeScanned` → `BeamReceiver.ingest` → live decoded/needed progress → SHA-256-verified completion; valid-UTF-8 payloads render as text, binary is written to `FileSystem.Paths.cache` and handed off via the `expo-sharing` share sheet. Frame cadence 250 ms (tune on device). Scanner path returns strings only — that's why frames use the text encoding; the header frame re-airs each loop so mid-join receivers always get it, and `BeamReceiver` resets state if the fileId changes (new sender run).
- `lib/beam.ts` never imports camera/QR/document-picker libs; screens never import `@rox/core` internals — the seam is the session/receiver API. `BeamResult` carries raw `bytes` plus `text` (non-null only when the payload is valid UTF-8); the receiver names saved files `beam-<sha-12>.txt|.bin` — the wire format carries no filename (staying byte-compatible with the desktop sender), so the sending side's name is display-only.

- `app.json` — Expo app config; app identifier follows the `rox` naming
- **Env**: `EXPO_PUBLIC_*` vars in `apps/native/.env` (gitignored; `.env.example` documents them) are inlined by Expo at bundle time — public config only, never secrets. Imports go through `@rox/env/native` (validated in `packages/env`), never `process.env`
- Theme via `contexts/app-theme-context.tsx`; shared UI primitives live in `@rox/ui`

## Work Guidance

- Follow root AGENTS.md code standards (Ultracite/Biome)
- Use React Native rules from root: text inside `<Text>`, safe-area-aware scrolling, native modals where appropriate

## Verification

- `bun run check-types` (turbo) must pass

## Dev Build Checklist

Bare-kit native modules and the camera require a dev build — Expo Go cannot run this app. From `apps/native`:

1. `bun install` at the repo root (native deps are workspace-linked)
2. `bun run bundle:worklet` — bare-packs the Pear-stack core into `lib/worklet.bundle.mjs` AND links the `linked:` addons (sodium/rocksdb/udx/quickbit/… prebuilt .so) into `node_modules/react-native-bare-kit/android/src/main/addons/{arm64-v8a,x86_64}/` (via `scripts/link-worklet-addons.mjs`); without this step the worklet bundle's addons can't resolve at runtime
3. `npx expo prebuild --clean` regenerates `ios/` + `android/` from `app.json` plugins (expo-router, splash, sharing, camera permissions, build-properties) — never edit generated natives by hand
4. `npx expo run:android` (needs minSdk 31 device/emulator; the machine needs Android SDK — ANDROID_HOME) or `npx expo run:ios` (needs macOS + Xcode) — the first build compiles bare-kit's native modules, expect several minutes
5. Start the bundler if not already running: `npx expo start` — pick the running dev build from the launcher
6. Smoke: drawer → **Worklet (dev)** → header shows `core: pear bundle`; "Run echo probe" prints `echo: ping from rox` (proves the Bare bridge + addons loaded)
7. Smoke: drawer → **Beam** → Receive grants camera access (proves the permission plugin + scanner)

Steps 1–3 verified on Linux (2026-09-14): prebuild succeeds, all 13 bundle addons linked with zero missing. Steps 4–7 need the actual device/emulator toolchain.

If native modules change (bare-kit, b4a, expo-camera versions), repeat from step 2. `ios/` and `android/` are gitignored — prebuild output is disposable.

## Child DOX Index

- (none)
