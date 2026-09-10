# DB Package (Drizzle + libSQL)

## Purpose

- `packages/db` — database schema, client factory, and migrations (Drizzle ORM over libSQL/Turso)

## Ownership

- Schema definitions in `src/schema/`, migration files in `src/migrations/`, client in `src/index.ts`
- Does not own env config (`packages/env` provides `DATABASE_URL`)

## Local Contracts

- `createDb()` — factory returning a Drizzle instance bound to `env.DATABASE_URL`
- `drizzle.config.ts` — points schema at `./src/schema`, migrations to `./src/migrations`, dialect `turso`
- Schema changes require a migration; never edit `src/migrations/` by hand

## Work Guidance

- Define tables in `src/schema/` and re-export from `src/schema/index.ts`
- Generate migrations via drizzle-kit rather than hand-writing SQL

## Verification

- `bun run check-types` (turbo) must pass

## Child DOX Index

- (none)
