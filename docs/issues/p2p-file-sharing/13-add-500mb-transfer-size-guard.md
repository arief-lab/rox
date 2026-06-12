Status: done

## What to build

Add an explicit file-size guard in `receive()` that rejects any Transfer whose start message declares `totalSize > 500 * 1024 * 1024` (500 MB). The receiver currently buffers all chunks in memory (`ctx.chunks.set(offset, payload)`) before creating the final Blob, so a 2 GB file would crash low-RAM devices, 1-devices. The guard is a single check after decoding the start message: if `totalSize` exceeds the bound, send a cancel frame back to the sender (via `transport.send(encodeCancel(fileId))`) and throw, so no chunks are buffered and the Inbox is untouched.

Important: the current `receive()` doesn't have a cancel-frame send path for early rejection — it just throws and the receive-loop catches it. The implementer must add the cancel-frame send BEFORE throwing so the sender stops transmitting.

Modules touched:

- `apps/web/src/lib/transfer/receive.ts` — add `MAX_TRANSFER_BYTES` constant and early-reject check (including cancel-frame send) in the start-message handler

User stories covered: (implicit — protects the "500 MB upper bound" guarantee in the PRD Implementation Decisions).

## Acceptance criteria

- [x] `receive()` rejects any start message with `totalSize > 500 * 1024 * 1024` (strictly greater than)
- [x] A 500 MB file (exactly at the bound) is **accepted** — the guard uses `>` not `>=`
- [x] A cancel frame is sent back to the sender before throwing, so the sender stops transmitting
- [x] The Inbox is never updated (no partial entry)
- [x] Unit test: fake transport delivers a start message with totalSize = 501 MB; assert the receive promise rejects, no Inbox entry is created, and a cancel frame was sent
- [x] Unit test: fake transport delivers a start message with totalSize = 500 MB (exactly); assert the receive proceeds normally (startReceiving state entered)
- [x] Existing tests continue to pass

## Blocked by

None.
