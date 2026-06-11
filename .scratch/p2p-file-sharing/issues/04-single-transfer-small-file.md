Status: ready-for-agent

## What to build

End-to-end Transfer of a small file (1 KB) from phone to PC over an established Session. The phone sends a single file via the chunked stream; the PC receives, reassembles, and surfaces a "Received: filename (1 KB)" entry in its Inbox. No Save/Discard UI yet — just the receipt.

Modules touched:

- `apps/web/src/lib/transfer/chunk-frame.ts` — `Chunk` type, `encodeChunk`, `decodeChunk` (per the candidate shape in the PRD)
- `apps/web/src/lib/transfer/state-machine.ts` — Transfer state machine: `idle | sending | receiving | completed | failed | cancelled`
- `apps/web/src/lib/transfer/send.ts` — `send(blob, transport)` slices the blob into chunks and streams them
- `apps/web/src/lib/transfer/receive.ts` — `receive(transport, onProgress)` reassembles chunks into a Blob
- `apps/web/src/lib/inbox/` — minimal `Inbox` store: push, list, clear (no save/discard yet — that's slice 5)
- `apps/web/src/components/InboxRow.tsx` — renders a single received entry
- `apps/web/src/components/SendButton.tsx` — opens a file picker and triggers `send`

User stories covered: 13, 14, 16, 17, 22, 24, 25.

## Acceptance criteria

- [ ] `Chunk` type matches the candidate shape in the PRD: `{ fileId: string, offset: number, length: number, payload: ArrayBuffer }`
- [ ] `CHUNK_SIZE` is `16 * 1024` (16 KB)
- [ ] Vitest unit: chunk encode/decode round trip on a 1 KB blob
- [ ] Vitest unit: boundary cases — empty file, single byte, exact multiple of `CHUNK_SIZE`
- [ ] Vitest integration: full Transfer round trip via the fake transport; file bytes match byte-for-byte
- [ ] Playwright E2E: after Pairing (slice 3), phone sends a 1 KB file; PC's Inbox shows a row with the file name and size
- [ ] A transfer that fails mid-stream leaves the Inbox untouched (no partial entry)

## Blocked by

- `.scratch/p2p-file-sharing/issues/03-full-pairing-via-qr.md`
