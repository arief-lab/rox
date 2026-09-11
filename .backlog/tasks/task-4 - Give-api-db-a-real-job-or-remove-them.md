---
id: TASK-4
title: Give api/db a real job or remove them
status: Done
assignee:
  - '@buffy'
created_date: '2026-09-10 05:23'
updated_date: '2026-09-11 14:59'
labels:
  - architecture
  - decisions
dependencies: []
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
packages/api (oRPC healthCheck router) and packages/db (empty Drizzle schema) came from the scaffold's chat-starter shape. The transfer path does not use them: desktop goes UI -> IPC -> core directly, and web is marketing-only. They are currently topology decoration adding dependency surface (orpc, libsql, drizzle catalog entries) and must either earn their place with the first real feature or be cut. Likely earning feature: transfer history / inbox persistence so the desktop app remembers past transfers across restarts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is made: either a concrete first consumer feature is specified (e.g. transfer history stored via @rox/db, exposed through @rox/api, consumed by desktop renderer) or the packages are deleted from the workspace including catalog deps and fallow zones
- [ ] #2 If kept: a schema migration and router endpoint exist with at least one consumer, and the fallow boundary rules are updated to match reality
- [ ] #3 If removed: bun install, turbo check-types, and fallow boundaries all pass without them
<!-- AC:END -->
