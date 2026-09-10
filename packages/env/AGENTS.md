# Env Package

## Purpose

- `packages/env` — typed environment-variable validation per runtime (server, web, native) using T3 env + zod

## Ownership

- `src/server.ts`, `src/web.ts`, `src/native.ts` — env schemas per target

## Local Contracts

- Import env from `@rox/env/server`, `@rox/env/web`, or `@rox/env/native` — never `process.env` directly in app code
- New env vars must be added to the matching schema and `.env.example`

## Work Guidance

- Keep validation strict (required vars fail fast); use `.default()` only for genuinely optional vars

## Verification

- `bun run check-types` (turbo) must pass

## Child DOX Index

- (none)
