# Hardware UX Redesign Spec

**Status:** Draft — ready for review  
**Project:** Rox Apps — P2P File Sharing Web App  
**Requested by:** User  
**Date:** 2026-07-30

---

## 1. Background & Motivation

The current Rox web app uses a header, a light/dark mode toggle, and an explicit “Send / Receive” home screen. The user wants to rethink the entire UI/UX around a simpler mental model: **connecting two pieces of hardware** (PC-to-PC or PC-to-mobile) with as little chrome as possible. This spec captures the desired flow, layout, and interaction patterns before any code is written.

Reference inspiration: **LocalSend** — a cross-platform local file-transfer app that uses a clean, single-screen pairing model.

### Current Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 with CSS variables in `packages/ui/src/styles/globals.css`
- **Component base:** shadcn/ui + beUI-style motion primitives in `@rox-apps/ui`
- **Pairing:** WebRTC offer/answer via QR code, manual paste, or link share
- **Fonts:** Geist Sans & Geist Mono via `next/font`
- **Build tooling:** Bun + Turborepo
- **Testing:** Vitest unit tests, Playwright E2E tests

---

## 2. Constraints & Non-Negotiables

| # | Constraint | Rationale |
|---|---|---|
| 1 | **No header** | Maximize usable screen real estate; the app is a utility, not a content destination. |
| 2 | **No light/dark mode toggle** | One less decision for the user. The app will be **light only** by default. |
| 3 | **Manual pairing only** | No auto-discovery; more predictable and privacy-preserving across networks. |
| 4 | **Ephemeral sessions** | No persistent trusted devices. Each transfer session requires fresh pairing. |
| 5 | **Cross-form factor** | Must work for PC-to-PC, PC-to-mobile, and mobile-to-mobile. |
| 6 | **Full keyboard + screen reader support** | Accessibility from day one. |

---

## 3. Design Principles

1. **One screen, one job.** Each view should have a single clear purpose.
2. **Hardware-first language.** Talk about “this device” and “the other device,” not “sender” and “receiver.”
3. **Pairing is the hero.** The default state immediately exposes the pairing QR/code so another device can connect.
4. **Touch-first, mouse-ok.** Large tap targets, simple gestures, but no hover-dependent actions.
5. **Motion with purpose.** Use the existing beUI motion primitives for feedback, not decoration.

---

## 4. User Flow

### 4.1 Open the app

The user opens Rox on a device. There is no header, no dark-mode toggle, no navigation.

**Default screen:**
- A large, centered card titled **“Ready to connect.”**
- A big QR code representing this device’s offer.
- Below the QR: a short code and a **Copy link** / **Share** button.
- A small floating settings icon in the bottom-right corner.

### 4.2 Connect a second device

**PC-to-PC:**
- On the second PC, the user opens Rox and clicks **“Connect to another device.”**
- They paste the first device’s code or click a **“Paste from clipboard”** button.
- The second PC generates an answer and automatically copies it to the clipboard.
- The user pastes the answer on the first PC (or the app reads the clipboard automatically if permission is granted).
- Connection is established.

**PC-to-mobile:**
- On the PC, the user opens Rox. The big QR code is visible.
- On the mobile device, the user opens Rox and taps **“Scan QR code.”**
- Mobile scans the PC’s QR code and automatically generates the answer.
- Mobile shows a confirmation: **“Connecting to <device name>…”**
- Connection is established.

**Link share fallback:**
- Either device can generate a shareable link (e.g. `https://rox.app/?offer=<token>`).
- Opening the link on the other device pre-fills the offer and jumps into the answer flow.

### 4.3 Connected state

Once paired, both devices show the same connected screen:
- **Peer name** and connection status at the top of the card.
- **Send file** button (prominent, large tap target).
- **Received files** list (inbox) with Save / Discard actions.
- A **Disconnect** action.

### 4.4 Send a file

1. User taps **“Send file.”**
2. Native file picker opens.
3. Sender sees a transfer progress toast.
4. Receiver sees an incoming-file prompt: **“<Device name> wants to send <filename> (<size>). Accept / Decline.”**
5. Receiver taps **Accept**; the file downloads.
6. Both sides see a completion toast.

### 4.5 Disconnect / drop

- User taps **Disconnect** → session ends, both devices return to the default “Ready to connect” screen.
- If the connection drops unexpectedly, the app briefly auto-retries (silent, ~3–5 s with a subtle spinner). If it fails, show: **“Connection lost. Reconnect or start over.”** with two buttons: **Retry** and **Start over**.

---

## 5. Screen-by-Screen Layout

### 5.1 Default / Idle State

```
┌─────────────────────────────────────┐
│                                     │
│          [Floating settings]        │
│                                     │
│            Ready to connect         │
│                                     │
│           ┌─────────────┐           │
│           │             │           │
│           │   QR CODE   │           │
│           │             │           │
│           └─────────────┘           │
│                                     │
│    Code: ABC-123-XYZ  [Copy]        │
│                                     │
│    [Share link]  [Paste to connect]   │
│                                     │
└─────────────────────────────────────┘
```

**Elements:**
- **QR code:** 256×256 px on desktop, 200×200 px on mobile. Centered. Always rendered (this device is always “open” for pairing).
- **Short code:** Human-readable fallback. Displayed as `XXX-XXX-XXX`.
- **Copy link:** Copies a shareable URL to the clipboard.
- **Paste to connect:** For PC-to-PC; opens an input where the user pastes the other device’s answer or link.
- **Settings icon:** Floating bottom-right, opens a bottom sheet or modal with device name and app info.

### 5.2 Scanning / Connecting State (mobile or PC paste flow)

```
─────────────────────────────────────┐
│                                     │
│         Connecting...               │
│                                     │
│    [Spinner] Generating answer      │
│                                     │
│    Answer copied to clipboard.    │
│    Paste it on the other device.   │
│                                     │
└─────────────────────────────────────┘
```

**Behavior:**
- On mobile after scanning: auto-generate answer, copy it, show instructions.
- On PC after pasting an offer: same as above.
- If the other device pastes the answer, the connection resolves automatically.

### 5.3 Connected State

```
┌─────────────────────────────────────┐
│  Connected with <Device name>       │
│  [status dot] Online                │
│                                     │
│  [    Send file    ]                │
│                                     │
│  Received files:                    │
│  • file1.pdf  1.2 MB  [Save]         │
│  • file2.jpg  3.4 MB  [Saved]        │
│                                     │
│  [Disconnect]                       │
│                                     │
└─────────────────────────────────────┘
```

**Elements:**
- **Peer info card:** device name, connection status dot.
- **Send file button:** Large, primary, full-width on mobile.
- **Received files list:** Inline, scrollable if needed. Save/Discard per row.
- **Disconnect button:** Secondary, bottom of card.

### 5.4 Incoming File Prompt

When the peer sends a file, show a modal/bottom sheet:

```
┌─────────────────────────────────────┐
│                                     │
│  <Device name> wants to send:       │
│                                     │
│  [file icon]                        │
│  report.pdf                         │
│  1.2 MB                             │
│                                     │
│  [   Accept   ]  [  Decline  ]     │
│                                     │
└─────────────────────────────────────┘
```

### 5.5 Transfer Progress

Use toast notifications for transfer progress:
- **Sending:** “Sending report.pdf — 45%” with a progress bar.
- **Receiving:** “Receiving report.pdf — 45%” with Accept/Decline first, then progress.
- **Complete:** “report.pdf received” / “report.pdf sent.”
- **Failed:** “Failed to send report.pdf. Tap to retry.”

---

## 6. Component & Token Notes

### Remove
- `Header` component
- `ModeToggle` component and `next-themes` provider
- Dark mode CSS variables (keep only `:root` light values)

### Keep / Adapt
- `Button` (beUI-style motion button) — use large, full-width variant for primary actions.
- `Card` — main container for the centered pairing/connected UI.
- `Input` / `Textarea` — for manual paste fallback.
- `TransferProgress` — keep but trigger via toasts; possibly embed in toast body.
- `InboxScreen` / `InboxRow` — simplify for inline received-files list.
- `InstallPrompt` — keep, but restyle to match the no-header light theme.

### New Components Likely Needed
- `PairingCard` — the default QR/code card.
- `PeerList` / `PeerCard` — connected peer info and actions.
- `IncomingFileDialog` — accept/decline prompt.
- `ToastTransfer` — transfer progress rendered inside `sonner` toasts.
- `FloatingSettings` — settings trigger and sheet.

---

## 7. Accessibility

- **Focus order:** QR → Copy → Paste → Settings. No hidden tab stops.
- **Screen reader:** QR code has `aria-label="QR code for connecting to this device"`. Live region for connection status updates.
- **Keyboard:** All primary actions reachable via Tab; Enter/Space activate. Esc closes settings sheet.
- **Color contrast:** Maintain WCAG AA for all text. The status dot (green/yellow/red) must also be labeled textually.
- **Motion:** Respect `prefers-reduced-motion`; disable beUI motion when the user prefers reduced motion.

---

## 8. Edge Cases & Concerns

| Scenario | Expected Behavior |
|---|---|
| User opens app on mobile with no camera permission | Show paste fallback prominently; camera button is disabled with an explanation. |
| Clipboard read fails | Show inline error; do not crash. |
| Invalid pasted code | Show “Code not recognized. Please check and try again.” |
| Connection drops mid-transfer | Auto-retry briefly; show Retry / Start over if it fails. |
| Receiver declines file | Sender sees “Declined” toast; no file transfer occurs. |
| Multiple files sent in a row | Queue them; show per-file toasts and a small transfer queue. |
| Share-target entry | Open directly into “Send file” flow once paired, or pre-queue the file on the default screen. |
| Deep link with expired offer | Show error and return to default screen. |

---

## 9. Open Questions (for future iterations)

1. Should the app support a **transfer history** page, or keep only the current session’s inbox?
2. Should there be a **numeric PIN** fallback in addition to the short code and link?
3. Should the QR code auto-refresh periodically for security, or stay static during the session?
4. How should mobile handle **file download** when the browser blocks auto-downloads?

---

## 10. Success Criteria

- [ ] No visible header on any screen.
- [ ] No theme toggle; app is consistently light.
- [ ] Default screen shows QR/code/link immediately upon opening.
- [ ] PC-to-PC, PC-to-mobile, and mobile-to-mobile pairing all succeed within 3 taps/clicks.
- [ ] Receiver must explicitly accept each incoming file.
- [ ] All interactions are keyboard-accessible and screen-reader friendly.
- [ ] Unit and E2E tests pass after implementation.
