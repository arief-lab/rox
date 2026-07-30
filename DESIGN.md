---
name: Rox
description: Clinical-grade, light-only P2P file transfer; the device itself stays center stage.
colors:
  bone-paper: "oklch(1 0 0)"
  bone-charcoal: "oklch(0.145 0 0)"
  surface-bone: "oklch(0.97 0 0)"
  raised-bone: "oklch(0.985 0 0)"
  bone-border: "oklch(0.922 0 0)"
  muted-text: "oklch(0.45 0 0)"
  slate-violet: "oklch(0.55 0.22 274)"
  slate-violet-foreground: "oklch(0.985 0 0)"
  alt-action: "oklch(0.56 0.23 295)"
  destructive: "oklch(0.58 0.22 27)"
  success: "oklch(0.63 0.19 145)"
typography:
  display:
    fontFamily: "Geist Sans, Inter Variable, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.5vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist Sans, Inter Variable, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist Sans, Inter Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "Geist Sans, Inter Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  2xl: "1.125rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.slate-violet}"
    textColor: "{colors.slate-violet-foreground}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-primary-press:
    backgroundColor: "{colors.slate-violet}"
    textColor: "{colors.slate-violet-foreground}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-secondary:
    backgroundColor: "{colors.surface-bone}"
    textColor: "{colors.bone-charcoal}"
    rounded: "{rounded.lg}"
    padding: "0.625rem 1.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone-charcoal}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.raised-bone}"
    textColor: "{colors.bone-charcoal}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.bone-paper}"
    textColor: "{colors.bone-charcoal}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.875rem"
---

# Design System: Rox

## Overview

**Creative North Star: "The Device Pair."** Two pieces of hardware — a PC and a phone, or two PCs — sit across from each other. Rox is the quiet, clinical instrument that lets them pass a file through the air between them. The interface does not impose its own personality on those devices; it steps back so the user's two machines remain the protagonists. Where decoration would compete, the design refuses it.

Rox is **calm-grade, light-only, and physically tactile without theatrics.** Each surface sits on a flat, single-definable plane; depth is communicated by lightness, not by shadows or borders. The accent color is rare, used only on actions the user can take — never as decoration. Motion speaks in inertia, mass, and resistance: the app behaves like a real instrument that mechanically responds when you reach for it.

**Key Characteristics:**
- **One activity per surface.** A screen has one job; the user reads the primary action within the first viewport.
- **Stateless hero.** No header, no light/dark/system toggle, no navigation chrome. The product, the device, and the action are all that appears.
- **Hardware-as-color-blind.** The accent never carries meaning about state alone; status labels carry the meaning, and the color reinforces.
- **Reading the device, not the brand.** Copy names devices and actions ("this device", "the other device", "Connect") rather than roles or product concepts.

## Colors

Rox's palette is restrained on purpose: a bone family for surfaces and ink, with a single violet accent that appears only on primary actions, current selection, and active focus rings. Status colors are used sparingly and always paired with a text label, never behind color alone.

### Primary
- **Slate Violet** (`oklch(0.55 0.22 274)`): the primary action surface — the main CTA on each screen. Used on the Connect button, the Send button when a Session is established, and the QR-display surface when the Offerer is ready to be scanned.

### Secondary
- **Alt-Action Magenta** (`oklch(0.56 0.23 295)`): reserved for the device-name-edit pencil and the secondary "Use camera" actions; never paired as a co-primary next to Slate Violet on a single screen.

### Status
- **Success Green** (`oklch(0.63 0.19 145)`): "Connected" status and successful transfer states.
- **Destructive Ember** (`oklch(0.58 0.22 27)`): the "Disconnect / Start over" action and explicit error messages.

### Neutral
- **Bone Paper** (`oklch(1 0 0)`): the page surface and the "open" state for inputs.
- **Surface Bone** (`oklch(0.97 0 0)`): one lightness step in — container backgrounds inside a split-screen layout, idle controls.
- **Raised Bone** (`oklch(0.985 0 0)`): the lightest tonal step used for cards that float above `Surface Bone` within the same image (the handshake pairing card, the connected-state card).
- **Bone Border** (`oklch(0.922 0 0)`): reserved for input strokes and chip outlines only. Never used as a card border.
- **Bone Charcoal** (`oklch(0.145 0 0)`): primary text — titles, body copy, button labels.
- **Muted Text** (`oklch(0.45 0 0)`): secondary text — device name hints, status descriptions, helper copy.

### Named Rules
**The Accent Sparingly Rule.** Slate Violet carries ≤ 10% of any given viewport. Its rarity is its meaning: when it appears, the user knows an action is here. The QR surface is the largest legitimate display.

**The Tonal Layering Rule.** Distance between overlapping surfaces is expressed through a lightness shift between **Bone Paper** → **Surface Bone** → **Raised Bone**, never through a `box-shadow` or a border.

## Typography

**Display Font:** Geist Sans (loaded via `next/font/google` at the root layout, fallback Inter Variable at `--font-sans`, finally `system-ui, sans-serif`).
**Body Font:** Geist Sans (same stack as Display).
**Mono Font:** Geist Mono (loaded via `next/font/google` as `--font-geist-mono`).

**Character:** Workhorse geometric sans, tracking tight at the display end, breathing easy at the body end. Geist reads simultaneously clinical (in the Q&A no-decoration sense) and conversational (in its low-key humanistic letterforms). It is the font of the device, not the brand.

### Hierarchy
- **Display** (weight 500, `clamp(2rem, 3.5vw, 3rem)`, line-height 1.1, tracking `-0.025em`): the hero headline on the handshake screen ("Send files directly to another device.").
- **Headline** (weight 500, `1.5rem`, line-height 1.2, tracking `-0.02em`): card titles ("Connected", "Almost there", "Connect to a device").
- **Body** (weight 400, `1rem`, line-height 1.6): explanatory paragraphs under each headline.
- **Label** (weight 500, `0.875rem`, line-height 1.4): section headers, button text, status-dot labels.
- **Mono** (weight 400, `0.8125rem`, line-height 1.5): QR-paired connection codes and error payloads; never used as decoration.

### Named Rules
**The Compute-Only Rule.** Geist Mono appears only where the user must read machine-encoded output (the short connection code, the offer / answer payload, error payloads). It is never a "technical style" decoration.

## Layout

Rox uses an **asymmetric split-screen handshake** on desktop (≥1024 px), stacking vertically on tablet and mobile. The split is held by a single container; surfaces inside it inherit the tonal layering rule rather than competing containers.

- **Desktop (≥1024 px):** Two columns at `1:1` minimum, leftward weight sits flush with the device edge; rightward column is the action column with the pairing card.
- **Tablet (640–1023 px):** Single column, hero above, action card below; the hero simplifies to a one-line headline + sub-subtitle.
- **Mobile (<640 px):** Single column, hero collapses to a status dot + the device name (edited inline). The pairing card carries the screen on its own.

Container max-width is `28rem` (`448 px`) on the action column; the hero column uses the rest of the viewport.

### Spacing Rhythm
`xs 0.5rem · sm 0.75rem · md 1rem · lg 1.5rem · xl 2rem · 2xl 3rem`

- Headline-to-subtitle: `md` to `lg`.
- Subtitle-to-action-card edge: `xl`.
- Within the pairing card, vertical rhythm is `md` between primary actions and `sm` between secondary controls.

## Elevation & Depth

Rox does **not** use shadows or borders for separation. Distance is expressed by lightness steps inside the bone family:

- **Bone Paper** (`oklch(1 0 0)`) — the page, the resting canvas.
- **Surface Bone** (`oklch(0.97 0 0)`) — one lightness step in; containers holding an action card.
- **Raised Bone** (`oklch(0.985 0 0)`) — the lightest nesting step; a card sitting inside `Surface Bone`.

This is the entire elevation system. Adding `box-shadow` or a 1 px border around a card is a regression because it doubles the elevation signal and degrades the silhouette.

### Named Rules
**The One-Depth Rule.** A surface declares exactly one level of elevation, never two. A card with `Raised Bone` background cannot also carry a `border` and cannot also carry a `box-shadow`.

**The No-Outline-Halo Rule.** Focus rings are 2 px Slate Violet at 60% opacity, sitting just inside the element (`:focus-visible` outline-offset `-2px`). No glow, no offset shadow.

## Shapes

Corner radius is the only form language in Rox. There are no clipping treatments, no diagonal cuts, no decorative shape language.

- **Card corners:** `xl` (`0.875rem`) for the pairing card and the connected-state card.
- **Button corners:** `lg` (`0.625rem`) for primary, secondary, and ghost buttons.
- **Input corners:** `md` (`0.5rem`).
- **Pill controls:** `lg` permanently; control chips stay compact rather than fully pill.

### Named Rules
**The Square-Chrome Rule.** The viewport boundary holds a 0-rad bezel — there is no internal frame, no decorative shell. Container edges are made by tonal layering alone.

## Components

### Buttons
- **Shape:** `0.625rem` radius (`lg`). Per physical-instrument rule: scale to `0.95` on `:active`, scale to `1.02` on `:hover`, spring back via `motion/react`'s `spring` preset.
- **Primary:** Slate Violet background, Slate Violet Foreground text, `0.625rem` radius, `0.625rem 1.25rem` padding, weight 500.
- **Secondary:** Surface Bone background, Bone Charcoal text, weight 500. Used when the action is meaningful but a step down from the primary (e.g., "Scan QR with camera").
- **Ghost:** transparent background, Bone Charcoal text, weight 500. Used for safe actions: "← Back to my QR", "Connect to another device".
- **Hover / Focus:** every variant triggers an opacity transition (0.92 → 1.0) and the scale transform. Focus adds a 2 px Slate Violet ring at 60% opacity, sitting inside the element.

### Inputs / Fields
- **Style:** Bone Paper background, Bone Border stroke `1px` (the only legitimate use of border color), `md` radius, `0.5rem 0.875rem` padding. The stroke is the exception that proves the Tonal Layering Rule — inputs need it for affordance, cards do not.
- **Focus:** bone-border stroke dissolves into a Slate Violet stroke at 2 px; the rest of the surface stays flat.
- **Disabled:** bone-paper becomes surface-bone, text switches to muted-text, the border stays but at 60% opacity.
- **Error:** right-aligned destructive ember text message + `1px` destructive ember border, never a halo glow.

### Cards / Containers
- **Corner Style:** `xl` (`0.875rem`).
- **Background:** `Raised Bone` when nested inside `Surface Bone`, else `Bone Paper`.
- **Shadow Strategy:** none. The Tonal Layering Rule applies; cards never carry `box-shadow`.
- **Border:** none. Tonal steps carry the silhouette.
- **Internal Padding:** `1.5rem` (`lg`) on the pairing card and the connected-state card; `1rem` (`md`) on the inbox rows.

### Navigation
- None. **No header**, no top bar, no side rail. The settings surface is the Floating action in the bottom-right of the viewport (only when there is space) or its absence is intentional on narrow mobile widths.

### Floating Settings (signature component)
- **Position:** bottom-right of viewport on desktop (`xl`/`1.5rem` from edge), bottom-center on mobile.
- **Trigger:** Slate-Bone Button — a circular `2.5rem` button carrying the gear glyph (Lucide `SettingsIcon`, 16 px stroke).
- **Card:** `Raised Bone` background, `xl` radius, `1.5rem` padding, list of device-name actions only — there is no light/dark toggle by design.

### Pairing Card (signature component)
- **Position:** action column on desktop, full-width below the hero on mobile.
- **Composition:** QR canvas (`oklch(0.985 0 0)` surface, 256×256 on desktop, 200×200 on mobile), short connection code (Geist Mono, `0.8125rem`), a "Copy link" Button (primary on desktop, secondary on mobile), an "Connect to another device" ghost Button.
- **Status dot:** `0.5rem` circle, Slate Violet, pulse-loop with `prefers-reduced-motion` respected.

### Inbox Row (signature component)
- **Position:** appears inside the connected-state card on the Receiver side.
- **Shape:** horizontal row with `Raised Bone` background, radius `md`, padding `md`.
- **Typography:** file name in `Label`, file size and type in `Muted Text`.
- **Actions:** right-aligned "Save" (primary, scale on press) and "Discard" (ghost) buttons; never a Delete icon for the discard action.

### Do's and Don'ts

#### Do
- **Do** treat the QR surface as the largest legitimate display of Slate Violet.
- **Do** use lightness steps (Bone Paper → Surface Bone → Raised Bone) to indicate hierarchy, never shadows or borders.
- **Do** author motion as spring physics on every primary CTA, disabled-state-aware, reduced-motion-aware.
- **Do** keep Slate Violet under 10% of any given viewport.
- **Do** label device names, status, and transfer progress in non-color text alongside the color cue.
- **Do** maintain a tracking value no tighter than `-0.025em` on display, no tighter than `-0.02em` on headline.

#### Don't
- **Don't** use `box-shadow` on any card — the Tonal Layering Rule supersedes it. The previous `shadow-2xl shadow-primary/5` is a landing-page leftover and must be scrubbed during the live iteration.
- **Don't** use `border-…/60` or any colored border above `1px` on cards, list items, or callouts.
- **Don't** introduce a kicker or eyebrow above a heading; the headline carries its own weight.
- **Don't** write copy in sender/receiver, host/guest, or client/server language; speak about devices.
- **Don't** ship a `Dark Mode` toggle, a `.dark` CSS variable set, `next-themes`, or any `dark:` Tailwind variant — light-only is durable per PRODUCT.md Brand Commitments. The `dark:/60` and `dark:aria-invalid:…` stragglers in `input.tsx`/`textarea.tsx` are to be removed during the live iteration.
- **Don't** use the alt-action magenta as a co-primary next to Slate Violet on a single screen; the alt-action is for the device-name pencil and the camera fallback only.
- **Don't** introduce a header, top bar, or side rail — the design has no navigation chrome by intent.
- **Don't** use Geist Mono as a stylistic decoration; it is reserved for machine-encoded output.
