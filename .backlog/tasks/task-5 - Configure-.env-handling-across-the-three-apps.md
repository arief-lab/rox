---
id: TASK-5
title: Configure .env handling across the three apps
status: Done
assignee: []
created_date: '2026-09-10 05:24'
updated_date: '2026-09-14 07:25'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
IMPLEMENTED: (1) new @rox/env/desktop schema (ROX_USER_DATA_SUFFIX optional); desktop main/env.ts is first import in main.ts — dotenv loads apps/desktop/.env, createEnv validates eagerly. ROX_USER_DATA_SUFFIX read migrated to env. NODE_ENV remains the one sanctioned direct read (toolchain-set). (2) native schema documented: EXPO_PUBLIC_* only, bundle-time inlined, never secrets. (3) .env.example added to all three apps; .gitignore already covers per-app .env. (4) turbo build already hashes .env* per package; dev is uncached. (5) DOX updated: env AGENTS.md (convention + ownership), desktop + native AGENTS.md env contracts. Verified: typecheck, ultracite, runtime smoke (env validates + loads).
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Env handling configured across all three apps: per-app .env (gitignored) + .env.example, @rox/env/desktop added and wired as first import of desktop main (dotenv + eager zod validation), native pattern documented (EXPO_PUBLIC_ only), turbo build hashes .env* per package, conventions recorded in env/desktop/native AGENTS.md. Typecheck + lint + runtime smoke pass.
<!-- SECTION:FINAL_SUMMARY:END -->
