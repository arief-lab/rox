# Config Package

## Purpose

- `packages/config` — shared build/TS configuration (base tsconfig consumed by all workspaces)

## Ownership

- `tsconfig.base.json` and any future shared tooling config

## Local Contracts

- Workspace tsconfigs extend `@rox/config/tsconfig.base.json`

## Work Guidance

- Changes here affect every package; keep them conservative and verify the full turbo typecheck

## Verification

- `bun run check-types` (turbo) across all packages must pass

## Child DOX Index

- (none)
