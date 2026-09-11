---
id: TASK-3
title: Implement peer pairing over Hyperswarm
status: Done
assignee:
  - '@buffy'
created_date: '2026-09-10 05:23'
updated_date: '2026-09-11 14:15'
labels:
  - desktop
  - core
  - pairing
dependencies:
  - TASK-1
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Signaling is currently same-process only (LocalTransport pair in apps/desktop/main/transfer/session.ts), so the QR flow works but two devices cannot actually exchange offers. Pairing must carry the hyper-offer/accepted/release signaling across a real peer connection so the seeder and receiver are separate processes on separate machines. Design open question for the worker: reuse one Hyperswarm instance for both signaling and drive replication (topic join per session) vs a separate signaling channel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A seeded offer from app instance A is received and decoded by app instance B on another machine (or a second local instance with isolated userData)
- [ ] #2 Signaling messages (hyper-offer/accepted/release) flow over the peer connection, not the in-process LocalTransport
- [ ] #3 The Transport port in @rox/core is implemented by the new peer transport without changes to the domain
- [ ] #4 A failed/closed peer connection surfaces as a failed transfer state in the renderer
<!-- AC:END -->
