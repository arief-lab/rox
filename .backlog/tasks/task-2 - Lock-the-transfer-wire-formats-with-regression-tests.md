---
id: TASK-2
title: Lock the transfer wire formats with regression tests
status: In Progress
assignee:
  - '@buffy'
created_date: '2026-09-10 05:22'
updated_date: '2026-09-10 06:45'
labels:
  - core
  - desktop
  - testing
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two wire formats must stay byte-identical across both peers forever: the topic derivation (sha256 of 'rox-topic:' + driveKey) in apps/desktop/main/transfer/hyper-adapter.ts, and the chunk frame layout (fileIdLen/offset/length little-endian packed) in packages/core domain/webrtc. Nothing currently pins them; an accidental refactor would silently break cross-version transfers. Related: the rox1: QR payload codec also deserves pinning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test asserts the derived topic for a known drive key equals a hardcoded golden hex value
- [ ] #2 A test asserts encodeChunk output for a known chunk equals hardcoded frame bytes, and decodeChunk round-trips
- [ ] #3 A test asserts the rox1 QR payload for a known offer decodes to the same driveKey/topic/name
- [ ] #4 Tests live in packages/core and apps/desktop per the workspace test setup and pass via turbo
<!-- AC:END -->
