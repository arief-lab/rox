# API Package (oRPC)

## Purpose

- `packages/api` — shared oRPC router definitions used by both web and native clients
- Single source of truth for RPC contracts (`AppRouter`, `AppRouterClient`)

## Ownership

- Procedure/router definitions in `src/`, including `src/routers/`
- Does not own database schema (`packages/db`) or env validation (`packages/env`)

## Local Contracts

- `src/index.ts` — exports `o` (os.$context) and `publicProcedure`; clients must build on these
- `src/routers/index.ts` — `appRouter` object; every new RPC belongs here
- `AppRouter` type must remain the single exported contract type

## Work Guidance

- Add procedures to the router object, not as separate exported functions
- Keep handlers thin; delegate business logic to `packages/db` or future service modules

## Verification

- `bun run check-types` (turbo) must pass; clients typecheck against `AppRouterClient`

## Child DOX Index

- (none)
