# Web App (Next.js)

## Purpose

- `apps/web` — web client built with Next.js 16 App Router
- Serves the oRPC API handler at `/api/rpc/[[...rest]]` backed by `@rox/api`
- UI composed from `@rox/ui` primitives; theming via `next-themes`

## Ownership

- Web pages (`src/app`), web-only components, web client utils
- Does not own API contracts (owned by `packages/api`) or DB schema (owned by `packages/db`)

## Local Contracts

- `src/utils/orpc.ts` — typed oRPC client; must match `@rox/api`'s `AppRouter`
- `src/app/api/rpc/[[...rest]]/route.ts` — the single RPC entry point
- `next.config.ts` — Next 16; read `node_modules/next/dist/docs/` for breaking changes before editing config
- Env via `@rox/env/web`

## Work Guidance

- Root AGENTS.md standards apply (Ultracite/Biome)
- Server Components by default; client components only where needed
- No barrel files; prefer specific imports

## Verification

- `bun run check-types` (turbo) must pass

## Child DOX Index

- (none)
