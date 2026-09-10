---
id: TASK-6
title: Prove the WebRTC transfer path for native
status: To Do
assignee: []
created_date: '2026-09-10 05:24'
labels:
  - native
  - core
  - decisions
dependencies:
  - TASK-2
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
apps/native is a paper client: its fallow zones and DOX contract exist but it has zero transfer code, and the chunked webrtc path in packages/core domain/webrtc is unproven. Before investing, verify the path is actually viable for Expo (RTCDataChannel transports exist for RN, or decide native transfers wait). Deliverable is a decision plus either a minimal native proof or an explicit deferral note in the native AGENTS.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A transport decision is recorded for native (react-native-webrtc based Transport adapter, Bare embedding, or explicit deferral with reasoning)
- [ ] #2 If proceeding: a minimal native Transport adapter implements the @rox/core port and a round-trip test passes against the chunked protocol
- [ ] #3 If deferring: apps/native/AGENTS.md states the deferral and the native fallow zones note stays accurate
<!-- AC:END -->
