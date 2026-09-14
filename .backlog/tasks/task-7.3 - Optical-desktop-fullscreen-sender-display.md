---
id: TASK-7.3
title: 'Optical desktop: fullscreen sender display'
status: In Progress
assignee: []
created_date: '2026-09-14 03:56'
updated_date: '2026-09-14 06:16'
labels:
  - feature
  - frontend
dependencies:
  - TASK-7.1
parent_task_id: TASK-7
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Desktop side of the optical path: a 'Beam via screen' send mode that renders the looping QR frame stream fullscreen (hide chrome, max brightness) so a phone camera can read it off the monitor. Reuses the core codec; no camera/receive support on desktop initially (webcam capture + decode is a separate decision). Include the frame pacing/timing calibration from the native task's findings if available.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 - 'Beam via screen' send mode in desktop renderer: file picker -> fullscreen QR stream (window goes borderless/fullscreen, brightness note shown)
- Reuses core codec; symbol stream identical to native sender (cross-device compatible)
- Frame pacing implementation shared or documented from 7.2 calibration findings
- No receive/camera support on desktop in this task (explicitly out of scope)
- ESC or click exits beam mode cleanly and stops the stream loop
- bun run check-types passes; fallow boundaries hold; ultracite clean
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
IMPLEMENTATION (started): reuse the frame-generation approach from native lib/beam.ts but pure-browser (no node:crypto/node:buffer in renderer). BeamSession in renderer/shared/beam.ts: text -> header+symbol QR payloads (base64 text frames, same wire format as native so cross-device compatible). beam-send feature page: full-window overlay (fixed inset-0, black, close on ESC/click), react-native equivalent on desktop is a <div> with a QR per frame — reuse the existing QrCode component if it supports arbitrary payloads, else add a tiny renderer-local SVG QR writer. Wire the entry as a third option on the desktop send step ('Beam via screen') in features/transfer/send-wizard.tsx device-picker step. No camera/receive on desktop. Note: 250ms cadence carried over from native; recalibrate after on-device testing.

DONE (renderer+main): beam:prepare in main/transfer/beam.ts precomputes looping QR frames via @rox/core (TEXT_ENCODING, PIECE_SIZE 120, 3x stream overhead — same params as native, cross-device compatible). features/transfer/beam-sender.tsx: fullscreen overlay (fixed inset-0 black), QrCode at 420px, 250ms cadence, ESC/Enter/click exit, unencrypted notice on picker, drop/browse file pick. Entered from send wizard device step as 'Beam via screen (no network)'. No camera/receive on desktop per AC. Verified: typecheck, ultracite clean, fallow 0 violations. Remaining for AC #1: manual on-device test (desktop beaming → native receiver).
<!-- SECTION:PLAN:END -->
