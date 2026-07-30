# beUI Redesign Spec

**Status:** Draft — ready for review  
**Project:** Rox Apps — P2P File Sharing Web App  
**Requested by:** User  
**Date:** 2026-07-30

---

## 1. Background & Motivation

The Rox web app currently uses a custom shadcn/ui-based component layer (`@rox-apps/ui`) shared across the monorepo. The UI is functional but fairly plain. The user wants to redesign the UI using [beUI](https://beui.dev/), a shadcn/ui-compatible component and motion library, to raise the visual polish and interactivity of the app while staying compatible with the existing shadcn/ui token system and Tailwind CSS v4 setup.

### Current Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 with CSS variables in `packages/ui/src/styles/globals.css`
- **Component base:** shadcn/ui primitives (`button`, `card`, `input`, `textarea`, `dropdown-menu`, `checkbox`, `label`, `skeleton`, `sonner`) in `packages/ui/src/components`
- **Theme:** `next-themes` with `attribute="class"`, light / dark / system, neutral base color
- **Fonts:** Geist Sans & Geist Mono via `next/font`
- **Build tooling:** Bun + Turborepo
- **Testing:** Vitest unit tests, Playwright E2E tests

### beUI Context

beUI is a free, open-source shadcn/ui-compatible component library focused on motion-heavy React/Next.js interfaces. It uses `motion` (formerly Framer Motion), `clsx`, and `tailwind-merge`, and maps to shadcn semantic tokens (`bg-primary`, `text-muted-foreground`, etc.). Components can be installed via:

```bash
# Registry namespace
bunx --bun shadcn add @beui/<component>

# Direct endpoint
bunx --bun shadcn add https://beui.dev/r/<component>.json
```

beUI is split into **Motion primitives** (loaders, drawers, modals, text animations) and **Product blocks** (command palettes, dynamic islands, file upload queues, OTP inputs, feedback widgets). It supports Tailwind v4 and Next.js App Router (client components for animated parts).

---

## 2. Goals

1. **Polish the full app UI** with beUI components and motion patterns.
2. **Stay shadcn/ui-compatible** so the existing token/theme system keeps working.
3. **Adopt both motion primitives and product blocks** where they add value.
4. **Replace existing base shadcn components with beUI equivalents** wherever a beUI equivalent exists; keep only what beUI does not provide.
5. **Maintain the existing app functionality** (pairing, transfer, inbox, settings, PWA, share target).
6. **Keep the migration in a single big-bang redesign branch** rather than incremental screen-by-screen PRs.

---

## 3. Scope

### In Scope

- All user-facing screens in `apps/web/src/components`:
  - Pairing screen (offerer) and sub-views
  - Answerer screen and sub-views
  - Connected view (send/receive/progress)
  - Inbox screen and inbox row
  - Settings screen
  - Install prompt
  - Idle screen, header, mode toggle, transfer progress, connection status, session timer, error text, loader
- Shared UI package `packages/ui/src/components` where reusable beUI primitives make sense.
- Global styles / CSS variable updates needed for beUI tokens, custom easing curves, or glassmorphism utilities.
- Theme provider and dark/light/system switching.

### Out of Scope (for this redesign pass)

- New feature work outside UI redesign (no new transfer protocol features).
- Accessibility overhaul (see §8 for a11y posture).
- beUI Pro paid templates/blocks (free core only).

---

## 4. Design Direction

- **Aesthetic:** Polished but subtle. Avoid over-the-top motion; favor smooth, functional feedback.
- **Motion level:** Medium — smooth entrances, hover states, loading animations, and progress feedback.
- **Color:** Open to brand/accent color recommendations. Existing neutral palette can be kept or augmented with a single accent. If a recommendation is needed, propose a cool accent (indigo/violet) that pairs with the current neutral grays.
- **Shape & spacing:** Follow beUI defaults and existing `radius` tokens (`--radius: 0.625rem`).
- **Typography:** Keep Geist Sans/Mono fonts.

### Candidate beUI Components / Blocks

Based on user selection, prioritize these beUI categories:

| Category | Possible Use in Rox |
|---|---|
| **Animated loaders / spinners** | Pairing/scanning states, transfer progress, general loading |
| **Drawers / modals** | Settings, file details, install prompt, confirmation dialogs |
| **Dynamic island / toasts** | Connection status, transfer start/complete notifications |
| **Command palette** | Quick navigation or action menu |
| **File upload / feedback blocks** | Send button, transfer queue, receive progress |
| **Text / motion reveals** | Screen titles, status changes, empty states |

The final component list will be finalized during implementation based on what beUI exposes in its free registry.

---

## 5. Component Strategy

### 5.1 Relationship to Existing shadcn/ui Base

- **Full replacement where possible:** Where beUI provides a compatible `button`, `card`, `input`, etc., replace the existing `@rox-apps/ui/components/*` version.
- **Layer approach for custom components:** App-specific Rox components (e.g., `pairing-screen`, `connected-view`) will be rebuilt using beUI blocks/primitives while preserving the existing business logic hooks.
- **Keep shadcn-only primitives when no beUI equivalent exists:** For example, `checkbox`, `label`, `dropdown-menu` may remain shadcn unless beUI offers direct replacements.

### 5.2 Package Home

- **Both `apps/web` and `packages/ui`:**
  - **Reusable motion primitives / shared beUI components** live in `packages/ui/src/components` (or a new `packages/ui/src/beui/` folder) and are exported through the existing `@rox-apps/ui` package.
  - **App-specific composed blocks** live in `apps/web/src/components`.

### 5.3 Installation Method

Use a mix:

- **CLI via registry or direct endpoint** for simple, self-contained beUI primitives:
  ```bash
  bunx --bun shadcn add @beui/loader
  # or
  bunx --bun shadcn add https://beui.dev/r/loader.json
  ```
- **Manual copy-paste** for complex blocks that need customization to fit Rox data structures (e.g., file upload queue with WebRTC progress).

### 5.4 Licensing / Tier

- **Free core only.** No beUI Pro templates or paid blocks. If a Pro block becomes desirable later, it will be evaluated in a separate follow-up.

---

## 6. Theming & Styling

### 6.1 Tokens

- Keep existing CSS variables in `packages/ui/src/styles/globals.css` as the source of truth.
- Map beUI component classes to the existing semantic variables (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--border`, `--ring`, etc.).
- Add beUI-specific utilities (e.g., custom easing curves, spring configs, glassmorphism helpers) to `globals.css` or a dedicated `@theme` block if required by copied components.

### 6.2 Brand/Accent Color

- Decision: **Open to recommendation**.
- Recommendation to evaluate during implementation: a cool accent (indigo/violet) for primary actions, active rings, and success states, applied through the existing `--primary` and `--ring` variables.

### 6.3 Dark / Light / System

- Continue using `next-themes` with `attribute="class"`.
- Ensure every beUI component supports both `.dark` and default light mode by relying on shadcn semantic tokens.
- Avoid hard-coded color values in copied beUI components; replace them with token classes if necessary.

---

## 7. Motion & Interaction

### 7.1 Motion Intensity

- **Medium.** Use beUI defaults as a baseline but dial back decorative motion to keep the app feeling snappy and professional.
- Functional animations (button press, loading, progress, drawer entrance) are encouraged.
- Avoid purely decorative, long-running motion that could distract from the core file-transfer task.

### 7.2 Reduced Motion

- **No special handling for this redesign pass** per user input.
- Document as a known follow-up: add `prefers-reduced-motion` checks and fallback static states before any production release.

### 7.3 Accessibility

- **Accessibility is not the primary priority** for this pass, but the implementation should:
  - Preserve existing keyboard focusable elements.
  - Keep semantic HTML and ARIA labels already present in shadcn primitives.
  - Not remove any existing accessible labels or focus management.
- A dedicated a11y pass will be scheduled as a follow-up.

---

## 8. Edge Cases & Constraints

The redesign must explicitly preserve and account for the following:

| Edge Case | Requirement |
|---|---|
| **Dark / light / system theme switching** | All components must render correctly in each theme. |
| **Large file transfer feedback (up to 500MB)** | Progress bars, cancellation buttons, and status text must remain clear and usable. |
| **Offline / PWA install flow** | The install prompt and PWA registration UI must continue to function. |
| **Share target / mobile OS sharing** | The `app/share-target/page.tsx` UI must remain functional and styled consistently. |
| **Connection state changes** | Pairing/connected/disconnected states need distinct, motion-friendly visuals. |
| **Mobile form factors** | beUI components should be chosen with small-screen touch targets in mind. |

---

## 9. Migration & Phasing

- **Strategy:** Big-bang full redesign in a single feature branch.
- **Recommended branch name:** `feat/beui-redesign`.
- **Process:**
  1. Set up beUI dependencies (`motion`, registry config) and any global CSS additions.
  2. Audit existing components and list shadcn components to replace vs. keep.
  3. Install/copy beUI primitives into `packages/ui`.
  4. Rebuild app-specific screens using beUI in `apps/web`.
  5. Update or remove stale custom styles.
  6. Run typecheck, lint, unit tests, and E2E tests.
  7. Manual QA across light/dark/system themes and on mobile.
  8. Merge.

---

## 10. Testing Strategy

- **Manual QA is sufficient for this redesign pass** per user input.
- Still required before merge:
  - `bun x ultracite check` (lint/format)
  - `bun run check-types` (TypeScript typecheck for both `apps/web` and `packages/ui`)
  - `bun run test` in `apps/web` (Vitest)
  - `bun run test:e2e` in `apps/web` (Playwright)
- Update existing unit/E2E selectors or mocks if beUI changes component structure.

---

## 11. Risks & Assumptions

| Risk | Mitigation |
|---|---|
| beUI registry installation may conflict with Tailwind v4 monorepo setup. | Test `bunx shadcn add` in a throwaway branch first; fall back to manual copy if needed. |
| Replacing base shadcn components may break existing tests/mocks. | Update mocks and selectors as part of the redesign branch. |
| Free beUI core may not cover every needed component. | Keep existing shadcn primitives as fallback; document gaps. |
| Heavy motion could impact low-end devices. | Keep motion at the agreed medium level; test on a low-end device/emulator. |

---

## 12. Open Questions & Next Steps

1. Confirm the final brand/accent color palette before implementation begins.
2. Audit the exact list of beUI free components available and map each to a Rox screen/component.
3. Decide whether to add a dedicated `beui` subfolder inside `packages/ui/src/components` or merge beUI files with existing shadcn files.
4. Plan a follow-up accessibility and reduced-motion pass after the redesign lands.

---

## 13. Appendix: Example beUI Install Commands

```bash
# Add a motion primitive via the beUI registry namespace
bunx --bun shadcn add @beui/loader

# Add via direct endpoint
bunx --bun shadcn add https://beui.dev/r/drawer.json

# Copy-paste fallback
# Visit https://beui.dev/r/<component>.json or the component page,
# copy the source, and place it in packages/ui/src/components/ or apps/web/src/components/.
```

---

*End of spec.*
