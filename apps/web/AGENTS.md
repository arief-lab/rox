# Web App (Next.js)

## Purpose

- `apps/web` — marketing site built with Next.js 16 App Router
- Static pages composed from `@rox/ui` primitives; theming via `next-themes`
- No transfer logic, no API surface (enforced by fallow boundaries)

## Ownership

- Web pages (`src/app`), web-only components
- Does not own transfer domain (owned by `packages/core`)

## Local Contracts

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
