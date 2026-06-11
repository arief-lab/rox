Status: ready-for-agent

## What to build

The project skeleton and the first vertical slice through the Pairing layer: encode a hardcoded SDP into a QR text, display the QR, scan it (in Playwright via text-to-QR), and confirm the round trip matches. No WebRTC yet — this slice proves the QR/clipboard convention works end-to-end before any real peer connection is built.

Modules touched:

- `apps/web/package.json` — add Vitest, Playwright, a QR library (e.g. `qrcode` for encoding, `jsqr` for decoding), `vitest.config.ts`, `playwright.config.ts`
- `apps/web/src/lib/pairing/` — `encodeOffer(sdp)` → `string`, `decodeQr(text)` → `{ sdp: string }`, plus a thin React UI
- `apps/web/src/app/page.tsx` — the home screen with a "Generate QR" button and a paste box

User stories covered (from `docs/prd/0001-p2p-file-sharing.md`): 4, 5, 7, 8 (partial).

## Acceptance criteria

- [ ] `apps/web` runs `bun run test` (Vitest) and `bun run test:e2e` (Playwright) without error
- [ ] `lib/pairing/encode-offer.ts` exports `encodeOffer(sdp: string): string` that produces a QR text containing the SDP
- [ ] `lib/pairing/decode-qr.ts` exports `decodeOffer(text: string): { sdp: string, name?: string }` (matches the PRD's symbol name — not `decodeQr` as the original draft said) that recovers the SDP
- [ ] Vitest unit test: encode → decode round trip on a representative SDP string
- [ ] Vitest integration test: clipboard write/read helpers using a stubbed `navigator.clipboard`
- [ ] Playwright E2E with two browser contexts: context A renders the QR; context B uses `jsqr` on the QR's PNG (or Playwright's `evaluate` to read the QR data URL) to decode; the decoded SDP matches the encoded one
- [ ] A `turbo.json` `test` and `test:e2e` task is added, with `test` cached and `test:e2e` not cached

## Blocked by

None - can start immediately.
