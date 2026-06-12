---
name: rox-apps-architecture
description: Codified architecture, component hierarchy, and conventions for the rox-apps monorepo (P2P file sharing). Use when modifying components, creating views, writing hooks, or adding UI primitives to prevent introducing patterns that will need refactoring.
---

# Rox Apps Architecture

## Project Overview

Monorepo with Turborepo (bun workspaces) for a P2P file-sharing web app.

```
/
├── apps/web/                     # Next.js 16 app (React 19)
│   ├── src/
│   │   ├── components/           # React components (flat + view dirs)
│   │   ├── lib/                  # Business logic, state machines, domain
│   │   └── ...
│   └── tests/
│       ├── unit/                 # Vitest unit tests (jsdom)
│       ├── integration/          # Vitest integration tests
│       └── e2e/                  # Playwright E2E tests (chromium)
├── packages/
│   ├── ui/src/components/        # Shared UI primitives (Button, Card, Input, etc.)
│   ├── env/                      # Environment variable schemas
│   └── config/                   # Shared tsconfigs
├── docs/
│   ├── prd/                      # Product requirement documents
│   ├── issues/                   # Implementation issues by feature
│   └── agents/                   # Agent configuration docs
├── CONTEXT.md                    # Domain glossary (single source of truth)
├── AGENTS.md                     # Code standards + project status
├── bts.jsonc                     # Better-T-Stack config (Next.js + Turborepo + Ultracite)
└── .claude/settings.json         # PostToolUse hook: `bun run fix`
```

## App Layout Structure

The root layout lives at `apps/web/src/app/layout.tsx`:

```tsx
<Providers>                                ← ThemeProvider + Toaster
  <div className="grid h-svh grid-rows-[auto_1fr]">
    <Header />                              ← nav links + ModeToggle
    {children}                              ← page content
  </div>
  <PwaRegistration />                       ← service worker registration
  <InstallPrompt />                          ← Add to Home Screen banner
</Providers>
```

Key patterns:
- `"use client"` — Required on every component that uses React hooks, browser APIs, event listeners, or state. Server components (layout.tsx) do NOT have it.
- `suppressHydrationWarning` — Applied to `<html>` for SSR theme hydration compatibility with `next-themes`.
- `Geist` / `Geist_Mono` fonts from `next/font/google` — Applied via CSS variables `--font-geist-sans` / `--font-geist-mono`.
- `h-svh` — Tailwind CSS 4 `svh` (small viewport height) unit for full-height layout on mobile.
- `grid-rows-[auto_1fr]` — Auto-height header + fill-remaining content.
- PWA: `manifest` metadata, `appleWebApp` config, service worker registration, install prompt all wired from the root layout.

## Core Rules (Do NOT Break These)

### 1. Use Shared UI Primitives First

Never use native HTML elements when a shared primitive exists in `@rox-apps/ui`. Before adding any HTML element, check this list:

| Primitive | Import Path | Replaces |
|-----------|-------------|----------|
| `Button` | `@rox-apps/ui/components/button` | `<button>`, `<a>` styled as button. Variants: `default`, `destructive`, `secondary`, `outline`, `ghost`, `success`, `alt-action`. Sizes: `xs`, `sm`, `default`, `lg`. |
| `Input` | `@rox-apps/ui/components/input` | `<input type="text">` (uses `@base-ui/react/input`) |
| `Label` | `@rox-apps/ui/components/label` | `<label>` |
| `Checkbox` | `@rox-apps/ui/components/checkbox` | `<input type="checkbox">` (renders `<button role="checkbox">` — use `onCheckedChange` not `onChange`, query `aria-checked` not `.checked`) |
| `Card` + subcomponents | `@rox-apps/ui/components/card` | Container divs with `rounded-lg border p-4` |
| `Textarea` | `@rox-apps/ui/components/textarea` | `<textarea>` |
| `Skeleton` | `@rox-apps/ui/components/skeleton` | Loading placeholder |
| `DropdownMenu` | `@rox-apps/ui/components/dropdown-menu` | Dropdown menus |

In-app shared components (in `apps/web/src/components/`):

| Component | Path | Exports | Purpose |
|-----------|------|---------|---------|
| `ErrorText` | `@/components/error-text` | Named | Red error message, renders nothing when `error` is falsy. Pass `data-testid` to override default. |
| `IdleScreen` | `@/components/idle-screen` | Named | Shared Card layout: title + ConnectionStatus + description + children + ErrorText |
| `CardHeaderWithStatus` | `@/components/card-header-with-status` | Named | Shared `CardHeader > CardTitle + CardAction(ConnectionStatus)` pattern |
| `ConnectionStatus` | `@/components/connection-status` | Named | Connection status indicator, uses `ConnectionStatusKind` type |
| `Loader` | `@/components/loader` | **Default** | Centered spinning `Loader2` icon (flex + justify-center). No props. |
| `Providers` | `@/components/providers` | **Default** | Wraps `ThemeProvider` + `Toaster` (richColors). Used in root layout. |
| `ThemeProvider` | `@/components/theme-provider` | Named | Re-export of `next-themes` `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. |
| `SessionTimer` | `@/components/session-timer` | Named | Polls `session.getRemainingIdleMs()` every 1s via `useEffect` + `setInterval`. Shows `"Idle in m:ss"` or `"Session ended (reason)"`. |
| `InboxScreen` | `@/components/inbox-screen` | Named | Multi-select Inbox list with typed observable subscription (list-changed/saved-changed), save/discard actions, async save with event-loop yield between downloads. |
| `InboxRow` | `@/components/inbox-row` | Named | Single Inbox row: checkbox (use `onCheckedChange` + `aria-checked`), save/discard buttons, sender name, file size, Saved badge. |
| `ModeToggle` | `@/components/mode-toggle` | Named | Theme toggle dropdown using `Moon`/`Sun` icons from `lucide-react`, `Button` with `size="icon" variant="outline"` as trigger. |
| `TransferProgress` | `@/components/transfer-progress` | Named | Transfer progress UI with progress bar and cancel button. |
| `SettingsScreen` | `@/components/settings-screen` | Named | Device name settings using `Card > Input + Label` pattern with save/cancel/reset. |

**Export convention tip:** Most shared components use named exports. `Loader` and `Providers` are default exports (historical). When adding new components, prefer named exports unless the component is a direct wrapper being `<Suspense>`-loaded.

**If no primitive exists**, create it in `packages/ui/src/components/` following the existing pattern (named export, `cn()` for class merging, `data-slot` attribute, `rounded-none`, `border-input`, `bg-transparent`, `text-xs`, proper focus-visible/disabled/aria-invalid states, dark mode overrides).

### 2. Component Architecture: Screen → View Sub-components

**Never inline render branches directly in screen components.** The cognitive complexity limit (`noExcessiveCognitiveComplexity`) will fail.

**Machine ref initialization pattern:** Initialize class-based state machines lazily in a ref:
```ts
const machineRef = useRef<PairingMachine | null>(null);
if (machineRef.current === null) {
  machineRef.current = new PairingMachine();
}
const machine = machineRef.current;
```
This avoids creating a new machine instance on every render while keeping the initialization inline (no `useEffect` delay). The `if (current === null)` guard is executed once on mount; on subsequent renders the ref already holds the instance and the condition is skipped.

```
screen-component.tsx          ← state machine + handlers + branch logic
├── screen-component/
│   ├── idle-view.tsx          ← one view per machine state
│   ├── offering-view.tsx
│   └── connected-view/        ← shared view (used by multiple screens)
│       └── connected-view.tsx
```

**Pattern for screens:**
- Screen component owns: machine ref, state, screen-specific state, `useSession()` hook, async handlers
- Each render branch is a sub-component file that receives only the props it needs
- Shared views (e.g., `ConnectedView`) go in their own directory and are used by multiple screens
- Sub-components use `IdleScreen` or `Card` + `CardHeaderWithStatus` for layout scaffolding
- **Avoid boolean props for behavioral variants** → use string union props or separate components instead (e.g. `TransferProgress` uses `direction: "send" | "receive"`, not `isReceive: boolean`). Boolean props create an implicit branch that grows exponentially — every `||` in the render tree is a hidden variant.
- **Never define components inside other components.** A component defined inside another is re-created on every render, causing React to unmount and remount its children every time — all local state is lost. Always extract inner components to module scope.
- **Never put static JSX inside the component body.** Static JSX that doesn't depend on props or state (e.g. `<p>No files received yet.</p>`) should be defined outside the component as a `const` or extracted into its own component. This avoids re-creating the element tree on every render.

### 3. Session Lifecycle Must Use `useSession` Hook

Both `PairingScreen` and `AnswererScreen` extract their session lifecycle into the shared `useSession` hook at `@/components/use-session`.

**Never duplicate the session lifecycle pattern.** The hook owns:
- `transport`, `session`, `sendLog`, `wasDisconnected` state
- `useReceiveProgress()` and `useSendProgress()` hook calls
- Transport→Session `useEffect` (creates Session, stamps peer name, wires onClose, starts receiveLoop)
- `handleSend`, `handleClose`, `resetToIdle`
- `connectionStatus` derivation

Also returns `sessionRef` (a `MutableRefObject<Session | null>`) for use in callbacks that need the current session without triggering re-renders.

**Standalone progress hooks** used internally by `useSession` — also usable independently:
- `useReceiveProgress` at `@/components/use-receive-progress`
- `useSendProgress` at `@/components/use-send-progress`

**Parameterization pattern:** Use callback refs (`getPeerName`, `onBeforeReset`, `onBeforeClose`) for screen-specific differences instead of copying the hook.

### 4. Library Architecture: `@/lib/` Modules

The domain logic lives in `apps/web/src/lib/`. Each module has a clear responsibility:

| Module | Path | Key exports | Purpose |
|--------|------|-------------|---------|
| **webrtc** | `@/lib/webrtc` | `Session`, `RealTransport`, `FakeTransport`, `createSession()`, `createOffer()`, `acceptOffer()`, `waitForIce()` | WebRTC transport layer: ICE negotiation, data channel, session lifecycle. `FakeTransport` for integration tests. |
| **transfer** | `@/lib/transfer` | `send()`, `receive()`, `startReceiveLoop()`, `TransferMachine`, `MAX_TRANSFER_BYTES` (500 MB), `Chunk`, `StartMessage` | Chunked file transfer: encode/decode chunks, state machine (idle→sending→done/failed/cancelled), send/receive handles with progress callbacks. |
| **inbox** | `@/lib/inbox` | `Inbox` class, `triggerBrowserDownload()`, `DownloadFn` type | Observable in-memory store with typed events (`"list-changed"`, `"saved-changed"`, `"pending-changed"`). Injectable `DownloadFn` for testability. See subscription pattern below. |
| **pairing** | `@/lib/pairing` | `PairingMachine`, `encodeOffer()`, `decodeOffer()`, `generateAnswer()`, `parseAnswer()`, `readClipboard()`, `writeClipboard()`, `base64urlEncode()`/`decode()` | Pairing flow: QR code encode/decode, clipboard I/O, offer/answer generation, state machine (idle→offering→pasting→connected→error). |
| **pwa** | `@/lib/pwa` | `register-sw.ts`, `PwaRegistration`, `shouldShowPrompt()`, `incrementDismissCount()`, `install-store.ts`, `share-cache.ts` | Service worker registration, install prompt persistence (localStorage dismissal tracking, max 3 dismissals), share target cache. |
| **device-name** | `@/lib/device-name` | `getDeviceName()`, `setDeviceName()`, `resetDeviceName()`, `generateDeviceName(ua)` | Device name auto-generation from User-Agent, localStorage override persistence, in-memory caching for page lifetime. |

**Import pattern:** All modules have barrel files (`index.ts`) with an explicit biome-ignore:
```ts
// biome-ignore lint/performance/noBarrelFile: reason
export { ... } from "./...";
```
This is the only case where barrel files are allowed — they define the public API of each module.

### 5. Domain Vocabulary (from CONTEXT.md)

Use these terms **exactly** as defined. Do not drift to synonyms.

| Term | Definition | Avoid |
|------|------------|-------|
| **Session** | Live paired state between two devices | "connection", "call" |
| **Pairing** | One-time establishment of a Session | "connect", "add friend", "match" |
| **Transfer** | Moving one file under a Session | "send" (noun), "share", "sync" |
| **Inbox** | Session-scoped list of received Transfers | "downloads", "history" |
| **Device Name** | User-visible device label | "username", "nickname", "device ID" |
| **Offerer** | Device that displays the pairing code | "host", "Alice" |
| **Answerer** | Device that reads the pairing code | "guest", "Bob" |
| **Sender** | Device initiating a Transfer | "uploader" |
| **Receiver** | Device receiving a Transfer | "downloader" |
| **File Transfer** | Chunked streaming, max 500 MB | "upload", "download", "sync" |
| **Role** | Device's part in Pairing or Transfer | - |

### 6. Icons, Toasts & Theme

- **Icons:** `lucide-react` (already a dependency). Common icons used: `Loader2` (Loader), `Moon`/`Sun` (ModeToggle), `CheckIcon` (Checkbox, DropdownMenu), `ChevronRightIcon` (DropdownMenu). Import directly from `"lucide-react"`.
- **Toasts:** `sonner` via `@rox-apps/ui/components/sonner`. The `Toaster` is wired in `Providers` with `richColors`. To trigger a toast from any component:
  ```ts
  import { toast } from "sonner";
  toast.success("File sent!");
  toast.error("Transfer failed");
  ```
  Import sonner directly (`"sonner"`), not through `@rox-apps/ui`.
- **Theme:** `next-themes`. The `ThemeProvider` is already wired in `Providers` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. Use `useTheme()` from `"next-themes"` to read/set theme.

### 7. Styling Conventions

- Use **Tailwind CSS 4** utility classes (`text-sm`, `mb-2`, `flex`, etc.)
- Use `cn()` from `@rox-apps/ui/lib/utils` for class merging
- Default text size: `text-xs` for component content, `text-sm` for labels/headings
- Default card style: `rounded-none`, `border border-input`, `bg-card` (from `Card` component)
- Variants: `default` (blue), `destructive` (red), `secondary`/`outline`/`ghost` (gray), `success` (green), `alt-action` (purple)
- **Use explicit string union variants, not booleans.** The `Button` component's `variant` prop and `TransferProgress`'s `direction: "send" | "receive"` are canonical examples. A boolean `isReceive` would create a two-valued prop that can't be extended to a third variant — a union type scales to N variants without refactoring call sites.
- Use `data-testid` attributes for test selectors (kebab-case: `"my-component"`)
- Use `dark:` variants for dark mode support
- `gap-{n}` for flex/grid spacing, `mb-{n}` for block spacing
- Color: `text-gray-500` for secondary text, `text-red-500` for errors, `text-foreground` for primary

### 8. Observable Store / Subscription Pattern

The `Inbox` class is the canonical example of the observable store pattern:

```ts
class Inbox {
  private readonly listSubscribers = new Set<() => void>();
  private readonly savedSubscribers = new Set<() => void>();

  subscribe(fn: () => void, event: InboxEvent = "list-changed"): () => void {
    // Pick set by event type, add fn, return unsubscribe
    const set = event === "saved-changed" ? this.savedSubscribers : this.listSubscribers;
    set.add(fn);
    return () => { set.delete(fn); };
  }

  private notifyListChanged(): void {
    for (const fn of [...this.listSubscribers]) { fn(); }  // Copy → iterate
  }
}
```

**Rules:**
- Subscriber callbacks are invoked **synchronously** after the mutation.
- Always copy the set before iterating (`[...this.set]`) so a callback that (un)subscribes mid-iteration doesn't mutate the set being iterated.
- Events are typed (`InboxEvent = "list-changed" | "saved-changed" | "pending-changed"`), not generic strings.
- The subscribe method returns an **unsubscribe function** — wire it into `useEffect` cleanup.
- The notification carries **no payload** — subscribers re-read the relevant state from the store.

### 9. SSR-Safe Patterns

Any code that touches browser APIs (`window`, `navigator`, `localStorage`, `document`) must guard against SSR:

```ts
// localStorage guard
if (typeof window === "undefined" || typeof localStorage === "undefined") { return null; }

// Navigator guard for iOS detection
if (typeof navigator !== "undefined" && ...) { ... }

// Wrap in try-catch for disabled/storage-full scenarios
```

All calls to `localStorage` must be wrapped in try-catch — the API can throw when storage is disabled, full, or in private browsing mode.

**Cache localStorage reads in memory** — the `device-name` module is the canonical pattern:
```ts
let cached: string | null = null;
export function getDeviceName(): string {
  if (cached !== null) { return cached; }
  const stored = readStored();  // reads localStorage
  if (stored) { cached = stored; return cached; }
  cached = generateDeviceName(ua);  // fallback
  return cached;
}

export function resetDeviceName(): void {
  cached = null;  // Invalidate the cache
  // Also clear localStorage
}
```
Cache the result in a module-level variable so repeated calls in the same page load don't re-read `localStorage` (a synchronous I/O operation). The cache is automatically cleared on page reload. To invalidate the cache (e.g., user resets a setting), set the cached variable to `null` alongside clearing the storage key with `localStorage.removeItem(...)`.

### 10. PWA Patterns

- **Install prompt:** `InstallPrompt` listens for `beforeinstallprompt` event (Chrome/Android) + falls back to an iOS hint for Safari. Dismissals are counted in `localStorage` (max 3).
- **Standalone detection:** `isRunningStandalone()` checks `matchMedia("(display-mode: standalone)")` (standard) + `navigator.standalone` (iOS fallback).
- **Service worker:** `PwaRegistration` component renders in root layout.
- **Share target:** `share-cache.ts` stores files shared into the app via the OS share sheet (PendingEntry pattern in Inbox).

### 11. Writing Hooks

- Use refs for values that should be stable across renders but need current values in callbacks
- Callback ref pattern: `const fnRef = useRef(fn); fnRef.current = fn;` — prevents effect re-runs when inline callbacks change
- Use `useCallback` with empty deps for stable callback references
- Use `useMemo` for bundling multiple stable values into a stable object
- Export a clean interface type for the hook's return value
- Follow existing patterns: `useSendProgress`, `useReceiveProgress`, `useSession`

**State initialization patterns (used in InboxScreen):**
- **Lazy useState init:** Pass a function to `useState` for values that require iteration or allocation: `useState(() => [...inbox.list()])`, `useState(() => new Set())`. The function runs only once (on mount), not on every render. This avoids rebuilding the array/set on every render for no reason, since only the subscription callback calls `setEntries`/`setSelected` to update the value.
- **Functional setState:** Use `setState((prev) => ...)` when the new value depends on the previous one: `setSelected((prev) => new Set([...prev, id]))`. This keeps the callback stable and avoids needing `selected` in the dependency array of `useCallback`/`useEffect` — the updater function receives the current value at the time the update is applied, not the captured closure value.
- **Force re-render:** Use `useReducer((x) => x + 1, 0)` with destructured `[, forceRender]` for cheap re-render triggers that don't carry a meaningful value.

**React 19 notes (this project uses React 19):**
- **No `forwardRef`** — pass `ref` as a regular prop instead of wrapping with `forwardRef`. The project already follows this convention (no `forwardRef` calls anywhere).
- **`use()` API available** — prefer `use()` for consuming context (replaces `useContext`) and streaming promise data. Not yet used in this codebase, but available for new code.

### 12. Polling Pattern (setInterval in useEffect)

The `SessionTimer` component is the canonical polling pattern:

```tsx
useEffect(() => {
  if (session.isClosed()) { setRemaining(0); return; }
  setRemaining(session.getRemainingIdleMs());
  const id = setInterval(() => {
    setRemaining(session.getRemainingIdleMs());
  }, 1000);
  return () => { clearInterval(id); };
}, [session]);
```

**Rules:**
- Always call the getter **before** `setInterval` to show the current value immediately, not after a 1s delay.
- Always check terminal state before starting the interval.
- Always return a cleanup function that calls `clearInterval`.
- The dependency array should include only the stable dependency (the `session` object), not the interval id or the state setter (React guarantees setter stability).

### 13. State Machines

- Flow control uses `PairingMachine` (class-based state machine in `@/lib/pairing`)
- Screen mirrors machine state via `useState(machine.getState())`
- All transitions go through machine methods; screen updates via `setState(machine.getState())`
- Never bypass the machine — set state directly only after machine transition
- On errors: machine transitions to failure state, then `machine.reset()`, then sync React state

### 14. Testing

- **Unit tests:** `vitest` with `jsdom`. Use `createRoot` + `act` pattern (see existing tests).
- **E2E tests:** Playwright with chromium. Dev server on port 3001.
- **Test commands:** `bun run test` (unit), `bun run test:e2e` (E2E)
- **Typecheck:** `bun run check-types` (runs `turbo check-types`)
- **Lint/format:** `bun x ultracite fix` (auto-fix), `bun x ultracite check` (verify)
- **Pre-commit hook** (`.husky/pre-commit`): Runs `check-types` → `turbo test` → `ultracite fix` in that order. Fails fast on type errors before running tests.
- All test assertions use `data-testid` selectors, not CSS classes or text content
- Mock external dependencies at module level with `vi.mock()`
- Test hooks via a harness component pattern (see `use-receive-progress.test.tsx`)

### 15. Package Management

- **Package manager:** `bun` (not npm, not pnpm, not yarn)
- Adding a package: use the basher agent to run the install command (avoids guessing version numbers)
- Install locally in the workspace: `cd apps/web && bun add <package>`
- **Never install packages globally** (`npm install -g`)
- UI packages live in `packages/ui/`, imported as `@rox-apps/ui/components/<name>`
- New shared primitives go in `packages/ui/src/components/`

### 16. TypeScript

- TypeScript 6 (strict mode)
- Prefer `unknown` over `any`
- Test files pass `tsc --noEmit` — import vitest globals explicitly (`beforeEach`, `vi`, etc.)
- For incompatible type casts (e.g., `Navigator` → `Record<string, unknown>`), use `as unknown as` intermediate cast
- Store discriminated union results before narrowing across function calls
- Ref types must match the stored function's signature (including parameters)
- Async callback refs: wrap in `async` to normalize return type to `Promise<void>`

### 17. Import Conventions

- App components: `@/components/<name>` (alias for `apps/web/src/components/`)
- App libraries: `@/lib/<name>` (alias for `apps/web/src/lib/`)
- UI primitives: `@rox-apps/ui/components/<name>`
- UI utilities: `@rox-apps/ui/lib/utils`
- Type-only imports: `import type { ... }` (not `import { type ... }`)
- No barrel files (no `index.ts` re-exports) **except** in `@/lib/` modules, where barrel files define the module's public API and must include an explicit `// biome-ignore lint/performance/noBarrelFile: reason` comment above the exports.

### 18. Commit Conventions

- Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Each logical change gets its own commit
- Run `bun x ultracite fix` before committing
- Verify typecheck + tests before push
