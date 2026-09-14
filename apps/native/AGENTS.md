# Native App (Expo)

## Purpose

- `apps/native` — mobile client built with Expo Router, React Native, and Tailwind (uniwind)
- Future transfer client: will embed a Bare worklet (`react-native-bare-kit`) running the Pear stack against `@rox/core` (see TASK-6)
- File-based routes under `app/` (drawer + tabs layout scaffolded)

## Ownership

- Mobile screens, navigation structure, native-specific components and contexts
- Does not own the transfer domain (owned by `packages/core`)

## Local Contracts

- **Beam (optical transfer, `app/(drawer)/beam.tsx` + `app/beam-send.tsx` + `app/beam-receive.tsx`, glue in `lib/beam.ts`)**: screen-to-camera file transfer on the core optical codec (`domain/optical`). One-way, unencrypted (both screens say so). Sender: text in → looping base64-text symbol frames via `createBeamSession`, rendered as white-on-black QRs fullscreen with brightness maxed (restore on exit). Receiver: `CameraView` `onBarcodeScanned` → `BeamReceiver.ingest` → live decoded/needed progress → SHA-256-verified completion screen. Frame cadence 250 ms (tune on device). Scanner path returns strings only — that's why frames use the text encoding; the header frame re-airs each loop so mid-join receivers always get it, and `BeamReceiver` resets state if the fileId changes (new sender run).
- `lib/beam.ts` never imports camera/QR libs; screens never import `@rox/core` internals — the seam is the session/receiver API. Sender takes pasted text only (file picking needs a dev build + expo-document-picker, follow-up).

- `app.json` — Expo app config; app identifier follows the `rox` naming
- Theme via `contexts/app-theme-context.tsx`; shared UI primitives live in `@rox/ui`

## Work Guidance

- Follow root AGENTS.md code standards (Ultracite/Biome)
- Use React Native rules from root: text inside `<Text>`, safe-area-aware scrolling, native modals where appropriate

## Verification

- `bun run check-types` (turbo) must pass

## Child DOX Index

- (none)
