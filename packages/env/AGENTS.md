# Env Package

## Purpose

- `packages/env` — typed environment-variable validation per runtime (server, web, native, desktop) using T3 env + zod

## Ownership

- `src/server.ts`, `src/web.ts`, `src/native.ts`, `src/desktop.ts` — env schemas per target

## Local Contracts

- Import env from `@rox/env/server`, `@rox/env/web`, `@rox/env/native`, or `@rox/env/desktop` — never `process.env` directly in app code (one sanctioned exception: desktop main reads `process.env.NODE_ENV` for the toolchain-set prod flag; see `apps/desktop/main/main.ts`)
- New env vars must be added to the matching schema and the app's `.env.example`
- Per-runtime file convention (one of each per app needing env):
  - `apps/web`: `.env` (gitignored) + `.env.example` — server-side, `DATABASE_URL` etc.
  - `apps/desktop`: `.env` + `.env.example` — loaded by `main/env.ts` via dotenv at startup; main-process only
  - `apps/native`: `.env` + `.env.example` — `EXPO_PUBLIC_*` vars only, inlined at bundle time, never secrets
- `.env` files are per-app, never repo-root (turbo hashes them per package for cache invalidation; root envs are an anti-pattern)

## Work Guidance

- Keep validation strict (required vars fail fast); use `.default()` only for genuinely optional vars
- Native has no server runtime: `src/native.ts` only validates public config — secrets have no home there

## Verification

- `bun run check-types` (turbo) must pass

## Child DOX Index

- (none)
