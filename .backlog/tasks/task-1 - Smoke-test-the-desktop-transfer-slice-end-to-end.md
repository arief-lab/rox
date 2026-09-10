---
id: TASK-1
title: Smoke-test the desktop transfer slice end-to-end
status: To Do
assignee: []
created_date: '2026-09-10 05:22'
labels:
  - desktop
  - testing
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The full vertical slice (renderer UI -> IPC -> HyperSeeder/HyperReceiver -> Hyperdrive/Hyperswarm) is typechecked and linted but has never run. Real runtime risks: DHT hole-punching, drive.put with a read stream, electron-builder postinstall, renderer fetch of the static export. Everything else builds on this being true.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bun run dev:desktop launches the app window without errors
- [ ] #2 Seeding a real file via the Send panel produces a QR offer and a seeded Hyperdrive
- [ ] #3 The same app instance receives via the Receive panel (self-transfer through LocalTransport) and the file lands in the downloads dir intact
- [ ] #4 Any runtime errors found are either fixed or filed as follow-up tasks
<!-- AC:END -->
