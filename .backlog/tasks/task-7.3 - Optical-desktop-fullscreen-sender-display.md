---
id: TASK-7.3
title: 'Optical desktop: fullscreen sender display'
status: To Do
assignee: []
created_date: '2026-09-14 03:56'
updated_date: '2026-09-14 03:58'
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
