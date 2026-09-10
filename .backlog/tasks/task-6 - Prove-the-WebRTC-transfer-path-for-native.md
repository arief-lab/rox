---
id: TASK-6
title: Build the native Bare worklet transport (react-native-bare-kit)
status: To Do
assignee: []
created_date: '2026-09-10 05:24'
updated_date: '2026-09-10 05:38'
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
