import type { Transport } from "@/lib/webrtc";
import {
  CHUNK_SIZE,
  decodeCancel,
  decodeChunk,
  decodeStart,
  isCancelMessage,
  type StartMessage,
} from "./chunk-frame";
import { TransferMachine, type TransferState } from "./state-machine";

/**
 * Receive a file over the Transport. Listens for a start message,
 * then collects chunks until the final chunk arrives (detected by
 * `offset + length === totalSize`), then reassembles them into a Blob.
 *
 * Returns a handle with:
 * - promise: resolves with { name, blob } when the file is complete
 * - cancel(): aborts the transfer
 * - getState(): returns the current TransferState
 */
export interface ReceiveOptions {
  machine?: TransferMachine;
  onProgress?: (bytesReceived: number, total: number) => void;
}

export interface ReceiveResult {
  blob: Blob;
  name: string;
}

export interface ReceiveHandle {
  cancel(): void;
  getState(): Readonly<TransferState>;
  readonly promise: Promise<ReceiveResult>;
}

interface ReceiveContext {
  chunks: Map<number, ArrayBuffer>;
  fileId: string | null;
  name: string;
  totalSize: number;
}

interface SubscriptionHandles {
  offClose: (() => void) | null;
  offMessage: (() => void) | null;
}

function handleStartMessage(
  ctx: ReceiveContext,
  text: string,
  machine: TransferMachine
): void {
  const start: StartMessage = decodeStart(text);
  ctx.fileId = start.fileId;
  ctx.name = start.name;
  ctx.totalSize = start.totalSize;
  machine.startReceiving(start.fileId, start.name, start.totalSize);
}

function handleChunk(
  ctx: ReceiveContext,
  buffer: ArrayBuffer,
  onProgress?: (bytesReceived: number, total: number) => void
): { blob?: Blob; done: boolean; error?: string } {
  const chunk = decodeChunk(buffer);
  if (ctx.fileId === null) {
    return { done: false, error: "Chunk received before start message" };
  }
  if (chunk.fileId !== ctx.fileId) {
    // Different fileId — ignore (stale chunk from a previous transfer).
    return { done: false };
  }
  ctx.chunks.set(chunk.offset, chunk.payload);
  const received = chunk.offset + chunk.length;
  onProgress?.(received, ctx.totalSize);

  // Per the PRD: "The last chunk of a file is marked by
  // offset + length === totalBytes".
  if (chunk.offset + chunk.length !== ctx.totalSize) {
    return { done: false };
  }
  const parts: ArrayBuffer[] = [];
  for (let off = 0; off < ctx.totalSize; off += CHUNK_SIZE) {
    const part = ctx.chunks.get(off);
    if (!part) {
      return { done: false, error: `Missing chunk at offset ${off}` };
    }
    parts.push(part);
  }
  return { done: true, blob: new Blob(parts) };
}

function cleanup(subs: SubscriptionHandles): void {
  if (subs.offMessage) {
    subs.offMessage();
    subs.offMessage = null;
  }
  if (subs.offClose) {
    subs.offClose();
    subs.offClose = null;
  }
}

export function receive(
  transport: Transport,
  options: ReceiveOptions = {}
): ReceiveHandle {
  const machine = options.machine ?? new TransferMachine();
  const subs: SubscriptionHandles = { offMessage: null, offClose: null };
  let cancelled = false;

  const cancel = (): void => {
    if (cancelled) {
      return;
    }
    cancelled = true;
    if (machine.getState().kind === "receiving") {
      machine.cancel();
    }
    cleanup(subs);
  };

  const promise = new Promise<ReceiveResult>((resolve, reject) => {
    const ctx: ReceiveContext = {
      chunks: new Map(),
      fileId: null,
      name: "unnamed",
      totalSize: 0,
    };

    const settleReject = (err: Error): void => {
      machine.fail(err.message);
      cleanup(subs);
      reject(err);
    };

    const settleResolve = (result: ReceiveResult): void => {
      machine.complete();
      cleanup(subs);
      resolve(result);
    };

    const onTextMessage = (text: string): void => {
      // A cancel frame from the sender aborts the current transfer
      // (so the Inbox stays untouched). The DataChannel stays open
      // so the next receive() call can accept more files.
      if (isCancelMessage(text)) {
        const cancel = decodeCancel(text);
        if (cancel.fileId === ctx.fileId) {
          // Sender-initiated cancel — machine goes to "cancelled"
          // (not "failed") so the Inbox stays untouched and the
          // session can continue for subsequent transfers.
          machine.cancel();
          cleanup(subs);
          reject(new Error("Transfer cancelled by sender"));
        }
        // Cancel for a different fileId — ignore (stale frame).
        return;
      }
      handleStartMessage(ctx, text, machine);
    };

    const onMessage = (data: string | ArrayBuffer): void => {
      if (cancelled) {
        return;
      }
      if (typeof data === "string") {
        onTextMessage(data);
        return;
      }
      const result = handleChunk(ctx, data, options.onProgress);
      if (result.error) {
        settleReject(new Error(result.error));
        return;
      }
      if (result.done && result.blob) {
        settleResolve({ blob: result.blob, name: ctx.name });
      }
    };

    // If the transport closes mid-transfer, reject so the caller can
    // handle the failure (and the Inbox stays untouched per PRD).
    subs.offClose = transport.onclose(() => {
      if (cancelled) {
        return;
      }
      const reason = transport.closeReason ?? "unknown";
      if (machine.getState().kind === "receiving") {
        machine.fail(`transport closed: ${reason}`);
      }
      cleanup(subs);
      reject(new Error(`transport closed: ${reason}`));
    });

    subs.offMessage = transport.onmessage((event) => {
      try {
        onMessage(event.data);
      } catch (err) {
        settleReject(err instanceof Error ? err : new Error("receive failed"));
      }
    });
  });

  return {
    promise,
    cancel,
    getState: () => machine.getState(),
  };
}
