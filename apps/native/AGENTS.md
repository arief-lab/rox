# Native App (Expo)

## Purpose

- `apps/native` — mobile client built with Expo Router, React Native, and Tailwind (uniwind)
- Shares the oRPC API surface with the web app via the typed client in `utils/orpc.ts`
- File-based routes under `app/` (drawer + tabs layout scaffolded)

## Ownership

- Mobile screens, navigation structure, native-specific components and contexts
- Does not own API contracts (owned by `packages/api`)

## Local Contracts

- `utils/orpc.ts` — typed oRPC client; keep aligned with `@rox/api`'s `AppRouter`
- `app.json` — Expo app config; app identifier follows the `rox` naming
- Theme via `contexts/app-theme-context.tsx`; shared UI primitives live in `@rox/ui`

## Work Guidance

- Follow root AGENTS.md code standards (Ultracite/Biome)
- Use React Native rules from root: text inside `<Text>`, safe-area-aware scrolling, native modals where appropriate

## Verification

- `bun run check-types` (turbo) must pass

## Child DOX Index

- (none)
