import type { Transport } from "@/lib/webrtc";
import {
  CHUNK_SIZE,
  type Chunk,
  decodeCancel,
  encodeCancel,
  encodeChunk,
  encodeStart,
  isCancelMessage,
} from "./chunk-frame";
import { TransferMachine, type TransferState } from "./state-machine";

/**
 * Send a file over the Transport in CHUNK_SIZE-sized pieces.
 *
 * Flow:
 * 1. Generate a fileId.
 * 2. Send a start message with the metadata.
 * 3. Read the blob in CHUNK_SIZE slices, encode each as a chunk, send.
 * 4. Call onProgress with cumulative bytes sent.
 *
 * Returns a handle with:
 * - promise: resolves when all chunks have been queued for sending
 * - cancel(): aborts the transfer (caller should also close the transport)
 * - getState(): returns the current TransferState
 */
export interface SendOptions {
  machine?: TransferMachine;
  onProgress?: (bytesSent: number, total: number) => void;
}

export interface SendHandle {
  cancel(): void;
  readonly fileId: string;
  getState(): Readonly<TransferState>;
  readonly promise: Promise<void>;
}

export function send(
  blob: Blob,
  transport: Transport,
  options: SendOptions = {}
): SendHandle {
  const machine = options.machine ?? new TransferMachine();
  const fileId = crypto.randomUUID();
  // Blob in lib.dom.d.ts doesn't have a `name` property; File does.
  // The send() function accepts Blob (the broader type), so we cast
  // to access the optional `name` that File and most Blob implementations
  // carry. Falls back to "unnamed" for raw Blobs without a name.
  const name = (blob as Blob & { name?: string }).name || "unnamed";
  const totalSize = blob.size;

  let cancelled = false;
  const cancel = (): void => {
    if (cancelled) {
      return;
    }
    cancelled = true;
    // Tell the receiver to abort the current reassembly (so the Inbox
    // stays untouched). The DataChannel stays open so subsequent
    // transfers on the same session are not affected.
    if (transport.state === "open") {
      transport.send(encodeCancel(fileId));
    }
    machine.cancel();
  };

  // Subscribe to cancel frames from the receiver. The receive() function
  // sends a cancel frame when the user calls receiver.cancel() (see the
  // symmetric path in receive.ts). When a matching cancel frame arrives,
  // we set the `cancelled` flag so the send loop throws on the next
  // iteration, and transition the machine to "cancelled" (not "failed")
  // so the catch block doesn't re-fail it. The subscription is cleaned
  // up in the finally block so we don't leak a handler.
  const offCancelFrame = transport.onmessage((event) => {
    if (typeof event.data !== "string") {
      return;
    }
    if (!isCancelMessage(event.data)) {
      return;
    }
    const cancelMsg = decodeCancel(event.data);
    // Stale frame for a different fileId (e.g. a previous transfer's
    // cancel arriving after we started a new one) — ignore.
    if (cancelMsg.fileId !== fileId) {
      return;
    }
    // Guard against (a) the cancel frame arriving after we already
    // completed (machine.cancel() throws from "completed") and
    // (b) duplicate cancel frames (a stale one arriving back-to-back
    // with a fresh one). Both cases no-op cleanly via this guard.
    if (machine.getState().kind === "sending") {
      cancelled = true;
      machine.cancel();
    }
  });

  const promise = (async () => {
    machine.startSending(fileId, name, totalSize);

    if (transport.state !== "open") {
      machine.fail("transport not open");
      throw new Error(`Cannot send: transport state is ${transport.state}`);
    }
    transport.send(encodeStart(fileId, name, totalSize));

    let offset = 0;
    while (offset < totalSize) {
      if (cancelled) {
        throw new Error("Transfer cancelled");
      }
      const end = Math.min(offset + CHUNK_SIZE, totalSize);
      const slice = blob.slice(offset, end);
      const payload = await slice.arrayBuffer();
      const chunk: Chunk = {
        fileId,
        offset,
        length: payload.byteLength,
        payload,
      };
      transport.send(encodeChunk(chunk));
      offset += payload.byteLength;
      options.onProgress?.(offset, totalSize);
    }

    machine.complete();
  })()
    .catch((err: unknown) => {
      if (machine.getState().kind === "sending") {
        machine.fail(err instanceof Error ? err.message : "send failed");
      }
      throw err;
    })
    .finally(() => {
      offCancelFrame();
    });

  return {
    fileId,
    promise,
    cancel,
    getState: () => machine.getState(),
  };
}
