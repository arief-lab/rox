# UI Package (shadcn + HeroUI Native)

## Purpose

- `packages/ui` — shared UI primitives for both web (shadcn/Radix-based) and native (HeroUI Native) clients
- Shared styling tokens in `src/styles/globals.css`
- Shared design tokens (send/receive accents, radii, spacing, typography) in `src/lib/tokens.ts`

## Ownership

- Components in `src/components/`, shared hooks in `src/hooks/`, utils in `src/lib/`
- Does not own app screens; apps compose these primitives

## Local Contracts

- `components.json` — shadcn registry config; add new shadcn components via the CLI
- `src/lib/utils.ts` — `cn()` helper for class merging
- `src/lib/tokens.ts` — framework-agnostic token values; `globals.css` CSS variables must mirror `tokens.ts` colors (emerald = send, sky = receive). Use `bg-send`/`text-receive`/`*-muted` utilities on web; import `colors` on native
- Web components must not import server-only or native-only modules

## Work Guidance

- Root AGENTS.md React rules apply (function components, ref-as-prop, no components defined inside components)
- Keep components app-agnostic; no business logic or API calls here

## Verification

- `bun run check-types` (turbo) must pass

## Child DOX Index

- (none)
