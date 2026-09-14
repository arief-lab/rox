---
id: TASK-7
title: 'Optical transfer: fountain-coded QR path (screen to camera)'
status: To Do
assignee: []
created_date: '2026-09-14 03:56'
updated_date: '2026-09-14 03:57'
labels:
  - feature
dependencies: []
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Third transfer path alongside Hyper (LAN) and the WebRTC chunk path: send a file between devices using only a screen and a camera, no network at all. Inspired by github.com/bashalarmistalt/decimen-optical-transfer (AGPL) but implemented from the LT fountain-code spec, NOT forked — keep Rox's AGPL-only-by-choice position clean.

Shape (hexagonal, matching existing paths):
- packages/core: new domain/optical/ — LT fountain codec (encode pieces -> symbols, peel -> pieces), zod-validated wire format for symbol frames, optical transfer state machine. Pure, transport-free, tested (TASK-2 style golden vectors for the wire format).
- apps/native (first target): receiver uses camera via existing QR scanning infra + a WASM QR decoder; sender renders looping QR frames. No pairing, no discovery — one-way beam.
- apps/desktop (later): fullscreen sender display; receiver only if webcam capture lands.

Accepted constraints:
- Unidirectional, no back-channel; dropped frames cost time only.
- Unencrypted by default (what's on screen is public) — document this in UI.
- Target: documents/photos, not bulk media (measured ~200-400 KB/s in comparable projects).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Third transfer path exists alongside Hyper and WebRTC: a file moves screen-to-camera with no network between devices.

- All three subtasks (7.1, 7.2, 7.3) are Done and integrated
- One real file transferred end-to-end: desktop or phone screen -> phone camera, SHA-256 verified
- No code copied from decimen-optical-transfer or its decimen-codec (spec-derived implementation only, verified by review)
- Docs updated: core AGENTS.md gains domain/optical; owning app AGENTS.md documents the beam UI
- The unencrypted-by-default caveat is visible in the beam UI on both sender and receiver
<!-- AC:END -->
