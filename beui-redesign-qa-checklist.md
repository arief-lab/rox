# beUI Redesign — Manual Visual QA Checklist

Use this checklist when verifying the Rox web app redesign in a real browser.

## Environment

- [ ] Build/dev server running: `cd apps/web && bun run dev`
- [ ] URL: http://localhost:3001
- [ ] Test in at least two browsers (e.g., Chrome/Chromium, Safari/Firefox)
- [ ] Test on desktop and a mobile viewport (≤ 375px width)
- [ ] Test light, dark, and system theme modes

## Home Page

- [ ] Header shows the brand **Rox** on the left and the theme toggle on the right.
- [ ] Hero heading reads **P2P File Sharing** with descriptive subtext.
- [ ] Two large role-selection cards are visible: **Receive a file** and **Send a file**.
- [ ] Each card has an icon, a title, a short description, and a call-to-action button.
- [ ] The **Receive** card uses the primary (violet) button style.
- [ ] The **Send** card uses the secondary button style.
- [ ] A **Settings** button/link is visible at the top.
- [ ] Buttons respond to hover and press with a subtle spring animation.

## Theme / Dark Mode

- [ ] Toggle between **Light**, **Dark**, and **System** themes via the header toggle.
- [ ] No flashes, inverted text, or broken borders when switching themes.
- [ ] The primary violet color is visible on both light and dark backgrounds.
- [ ] Cards remain readable and maintain contrast in both modes.

## Receive a File (Offerer) Flow

- [ ] Clicking **Receive** opens the offerer screen.
- [ ] A **Back** button returns to the home page.
- [ ] The idle state shows **Receive a file** with a **Start receiving** button and a status indicator.
- [ ] Clicking **Start receiving** transitions to a state with a QR code canvas and the offer SDP snippet.
- [ ] Buttons for reading the clipboard and pasting the answer are styled and accessible.
- [ ] Paste answer text area uses the new rounded input style.
- [ ] On valid answer paste, the view transitions to the **Connected** state.
- [ ] Error text appears in a consistent red/destructive style.

## Send a File (Answerer) Flow

- [ ] Clicking **Send** opens the answerer screen.
- [ ] The idle state shows **Send a file** with a textarea and **Scan** button.
- [ ] The **Use camera** button is styled consistently.
- [ ] After entering/pasting offer text, the scanning view appears with **Generate answer & copy**.
- [ ] The generated answer snippet is displayed in a readable code style.
- [ ] On successful connection, the view transitions to the **Connected** state.

## Connected View

- [ ] The header shows **Connected** and the connection status indicator.
- [ ] Peer name is displayed.
- [ ] Session timer shows the idle countdown.
- [ ] **Send file** button uses the new Button component and triggers a file picker.
- [ ] Selected file shows a progress bar with the primary color and animated width.
- [ ] Cancel button is styled in the destructive variant.
- [ ] Inbox list renders file rows with checkboxes, file name, size, and sender.
- [ ] **Save**, **Discard**, **Select all**, **Save selected**, etc. buttons are reachable and styled.
- [ ] Saved files show a green "Saved" badge.
- [ ] The **Close session** button is visible and styled.

## Settings Screen

- [ ] Settings card opens from the home page.
- [ ] Device name input is styled with the new rounded input.
- [ ] **Save**, **Cancel**, and **Reset** buttons are present and functional.
- [ ] Save is disabled while the name is empty or only whitespace.
- [ ] Changes persist and are reflected in pairing/connection UI.

## Install Prompt

- [ ] On a supported browser, trigger the `beforeinstallprompt` event.
- [ ] The install banner appears with an **Install** button and a dismiss × button.
- [ ] Dismissing the banner hides it and increments the dismissal count.
- [ ] On iOS, the passive hint appears after a few seconds with Share → Add to Home Screen instructions.
- [ ] The banner uses the new popover/card styling and close button.

## Share Target Page

- [ ] Navigate to `/share-target?id=<uuid>` with a valid shared file.
- [ ] The file card shows name, size, type, and a **Ready** badge.
- [ ] **Send this file** and **Cancel** buttons are styled and functional.
- [ ] Error states (no file, expired file) are readable and link back to home.

## Motion & Polish

- [ ] Buttons scale slightly on hover/tap without lag or jank.
- [ ] Progress bars animate smoothly when progress updates.
- [ ] Cards have rounded corners and a subtle shadow/border.
- [ ] The loader is a smooth motion spinner, not a static icon.
- [ ] No excessive or distracting animations.

## Accessibility

- [ ] Focus rings are visible on buttons, inputs, and links when navigating with the keyboard.
- [ ] Buttons have visible disabled states.
- [ ] No color-only indicators (status dots also have labels).
- [ ] Text remains readable at 200% zoom.

## Console & Errors

- [ ] Open the browser DevTools console.
- [ ] No JavaScript errors on initial load.
- [ ] No errors after switching themes.
- [ ] No errors after navigating between Receive / Send / Settings / Home.
- [ ] No 404 or failed requests in the Network tab.

## Mobile / Responsive

- [ ] Home cards stack vertically on narrow viewports.
- [ ] Buttons remain large enough to tap (≥ 44×44px touch target).
- [ ] Text does not overflow or wrap awkwardly.
- [ ] Share-target and install prompt banners are fully visible and dismissible.

---

**How to run the app for QA:**

```bash
cd apps/web
bun run dev
# open http://localhost:3001
```

**Known issue:** The `browser-use` agent currently returns no output, so this manual checklist is used for visual verification until the agent is fixed.
