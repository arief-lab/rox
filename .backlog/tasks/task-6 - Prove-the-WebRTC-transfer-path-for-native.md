---
id: TASK-6
title: Build the native Bare worklet transport (react-native-bare-kit)
status: In Progress
assignee: []
created_date: '2026-09-10 05:24'
updated_date: '2026-09-14 10:35'
labels:
  - native
  - core
  - bare-kit
dependencies:
  - TASK-2
references:
  - 'https://docs.pears.com/how-to/run-on-native/embed-bare-in-react-native/'
  - 'https://docs.pears.com/how-to/run-on-native/type-a-native-rpc-bridge/'
  - 'https://docs.pears.com/how-to/run-on-native/handle-app-suspension/'
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision made after reading the Pear docs (docs.pears.com/how-to/run-on-native/embed-bare-in-react-native/): native transfer goes through react-native-bare-kit, NOT react-native-webrtc. The docs confirm the Pear stack runs natively on iOS/Android via a Bare worklet — 'it can require any bare-* module and open a Hyperswarm or Corestore just as it would on the desktop' — with a config-plugin setup for Expo specifically. This makes the desktop skeleton the blueprint: same @rox/core domain, same Transport port, same QR offer flow; only the host shell differs (Electron main process on desktop, Bare worklet on native). The chunked webrtc path in packages/core stays as the browser fallback story, not the mobile path. Known risks to verify during implementation: Bare is not Node — the desktop adapter code is Node-shaped (node:crypto, createReadStream into drive.put) and needs a Bare-shaped twin (b4a, bare streams); worklet suspension is a first-class mobile requirement (docs: stop all active I/O when backgrounded or the OS force-terminates; wire worklet.suspend()/resume() into app foreground/background handlers).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 react-native-bare-kit is installed with the Expo config-plugin setup, and a hello-world worklet runs on an Expo dev build (iOS sim or Android emu)
- [ ] #2 A minimal native Transport adapter wraps worklet.IPC in the @rox/core Transport port; the hyper domain (signaling + HyperTransferMachine) runs unmodified inside the worklet
- [ ] #3 Pear-stack modules (hyperdrive, hyperswarm bare-* equivalents) load inside the worklet; any Node-shaped glue that does not port cleanly is documented and given a Bare equivalent
- [ ] #4 A seed->replicate round-trip passes between the desktop app and the native worklet (or two worklets) using the shared rox1 QR offer payload
- [ ] #5 App suspension handling: worklet.suspend()/resume() are wired to app state changes and an active transfer survives background/foreground without process termination (or fails gracefully into the cancelled state)
- [ ] #6 apps/native/AGENTS.md is updated: worklet data plane, IPC/RPC bridge contract, suspension rules; fallow zones stay accurate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
PROGRESS (session 1): react-native-bare-kit@0.15 + react-native-b4a + b4a installed; expo-build-properties plugin (minSdk 31, useLegacyPackaging) per bare-expo example — note: bare-kit has NO expo config plugin of its own, native modules autolink; dev build required (not Expo Go). lib/worklet.ts singleton host (suspend/resume on AppState per AC#5), lib/worklet-core-source.ts inlined echo core (Metro has no string-loader; dropped the standalone worklet/ file). lib/bare-transport.ts implements the Transport port over IPC with u32-LE length framing (IPC is a boundary-less byte stream — concurrent messages would interleave otherwise). worklet-dev drawer screen = echo probe for AC#1. Remaining: on-device echo run (AC#1), hyper signaling in worklet + seed/replicate round-trip (AC#2-4), Node-shaped vs Bare-shaped glue documentation (AC#3).

RPC SEAM DESIGNED + IMPLEMENTED (decision: JSON over the existing length-framed Transport port — zero new deps, same wire conventions as signaling, rejected bare-rpc/hyperschema because both endpoints are JS and the docs recommend HRPC there, which is heavier than this seam needs). Contract: domain/hyper/worklet-rpc.ts in @rox/core — envelopes {v,id,kind:req|res|evt}, zod-validated on decode, commands mirror desktop session IPC (transfer:send/receive/cancel/release, peers:discover, device:get/setName), events: signal/state/progress/done/error/peers. Host client: apps/native/lib/worklet-rpc-client.ts (id correlation, 120s timeout, event subs; methods mirror window.ipc.transfer). Worklet dispatcher: inlined core source now a real RPC server (state machines + handler table; seeding/replication throw explicit not-wired errors until Pear stack lands). TESTS: 6 round-trip tests run the REAL core source against the real client via an in-memory IPC pair shimmed as BareKit — caught a real bug: plain Uint8Array.toString() yields comma-joined digits (not text), so the core now decodes with Buffer.from(data).toString('utf8'). All pass; typecheck + ultracite clean.

PEAR STACK WIRED (AC#3,#4 code-complete): worklet/app.js is the real Bare core — hyperdrive+hyperswarm seeding (host writes file into sandbox, transfer:send → drive.put → join derived topic → reply driveKey/senderId/topic) and replication (join topic, list→get→write rox-transfers/, reply path). Peer signaling: newline-delimited JSON on swarm connections → signal events (host parses via parseSignal). BUNDLING VERIFIED: scripts/bundle-worklet.sh runs bare-pack --linked across android-arm64/x64 + ios-arm64/simulator → lib/worklet.bundle.mjs 1.85MB committed; ~40 transitive Pear deps added as DEV deps (module graph only). Metro serves .mjs as asset; worklet.ts prefers bundle, falls back to stub. REMAINING RISK/WORK: linked: addons (sodium/rocksdb/udx/quickbit .so) must resolve at native link time — needs the dev build to verify (AC#1/#4 on-device); device id persistence in worklet sandbox; progress events during replication.

ADDON LINKING VERIFIED (checklist steps 1-3 on Linux): scripts/link-worklet-addons.mjs runs bare-link over the Pear roots (hyperdrive/hyperswarm/bare-fs/bare-crypto/b4a) and emits all prebuilt .so into react-native-bare-kit's android/src/main/addons/{arm64-v8a,x86_64} — cross-checked against the bundle's linked: pins: 13/13 present, ZERO missing (sodium/rocksdb/udx/quickbit/rabin/simdle/fs-native-extensions/bare-*). expo prebuild --clean succeeds with the new expo-build-properties dev dep. Steps combined into . Remaining: steps 4-7 need a real device/emulator with the Android SDK (this box has no ANDROID_HOME/Xcode) — the addon .so are prebuilds so no cross-compilation needed, just packaging + runtime smoke.
<!-- SECTION:PLAN:END -->
