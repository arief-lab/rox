---
id: TASK-5
title: Configure .env handling across the three apps
status: To Do
assignee: []
created_date: '2026-09-10 05:24'
labels:
  - env
  - tooling
dependencies: []
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Env handling is unconfigured for the desktop and native clients. apps/web/.env exists (DATABASE_URL, read by packages/db's drizzle config), packages/env has per-runtime schemas (server/web/native) but native and desktop have no env files and no documented convention. Desktop (Electron main) and native (Expo) need a documented pattern for secrets vs public config before the first feature that needs one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each app that needs env vars has a committed .env.example and a gitignored .env, per-app not at the repo root (turbo anti-pattern)
- [ ] #2 packages/env/native and a desktop equivalent validate the vars the apps actually use; apps import env only through @rox/env per its AGENTS.md contract
- [ ] #3 turbo.json declares env/inputs for tasks that read env files so cache invalidation is correct
- [ ] #4 README or AGENTS.md documents the convention
<!-- AC:END -->
