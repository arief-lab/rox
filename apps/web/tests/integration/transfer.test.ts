import { describe, expect, it } from "vitest";

import {
  encodeStart,
  MAX_TRANSFER_BYTES,
  receive,
  type SendHandle,
  send,
} from "@/lib/transfer";
import { isCancelMessage } from "@/lib/transfer/chunk-frame";
import { createFakeTransportPair } from "@/lib/webrtc";

/**
 * End-to-end Transfer round trip via the fake transport pair.
 * The sender (A) sends a 1 KB file; the receiver (B) reassembles it
 * and the bytes match the original byte-for-byte.
 */
describe("Transfer round trip via fake transport", () => {
  it("sends a 1 KB file from A to B and the bytes match", async () => {
    const [a, b] = createFakeTransportPair();
    const original = new Uint8Array(1024);
    for (let i = 0; i < original.length; i++) {
      original[i] = i % 256;
    }
    const blob = new Blob([original], { type: "application/octet-stream" });

    const sender = send(blob, a);
    const receiver = receive(b);

    await sender.promise;
    const { name, blob: received } = await receiver.promise;

    expect(name).toBe("unnamed");
    const receivedBytes = new Uint8Array(await received.arrayBuffer());
    expect(receivedBytes).toEqual(original);
  });

  it("sends a file with a custom name", async () => {
    const [a, b] = createFakeTransportPair();
    const data = new TextEncoder().encode("hello world");
    const blob = new Blob([data], { type: "text/plain" });

    const sender = send(blob, a, {});
    const receiver = receive(b);

    await sender.promise;
    const { name, blob: received } = await receiver.promise;
    expect(name).toBe("unnamed");
    expect(await received.text()).toBe("hello world");
  });

  it("sends a file larger than CHUNK_SIZE (multi-chunk)", async () => {
    const [a, b] = createFakeTransportPair();
    // 40 KB = 3 chunks (16K + 16K + 8K)
    const original = new Uint8Array(40 * 1024);
    for (let i = 0; i < original.length; i++) {
      original[i] = (i * 7) % 256;
    }
    const blob = new Blob([original]);

    const sender = send(blob, a);
    const receiver = receive(b);

    await sender.promise;
    const { blob: received } = await receiver.promise;
    const receivedBytes = new Uint8Array(await received.arrayBuffer());
    expect(receivedBytes).toEqual(original);
  });

  it("reports progress during the transfer", async () => {
    const [a, b] = createFakeTransportPair();
    const data = new Uint8Array(32 * 1024); // 32 KB = 2 chunks
    const blob = new Blob([data]);

    const progressUpdates: number[] = [];
    const sender = send(blob, a, {
      onProgress: (sent) => progressUpdates.push(sent),
    });
    const receiver = receive(b);

    await sender.promise;
    await receiver.promise;

    // Should have at least 2 progress updates (one per chunk), ending at total
    expect(progressUpdates.length).toBeGreaterThanOrEqual(2);
    expect(progressUpdates.at(-1)).toBe(32 * 1024);
  });

  it("a transfer that fails before sending leaves no partial entry in the caller", async () => {
    // The PRD invariant: "A Transfer that fails partway through leaves the
    // Inbox untouched". The Inbox is only populated when receive() resolves
    // successfully. If receive() rejects, the caller doesn't push to the
    // Inbox, so it stays empty.
    //
    // Close the transport from inside onProgress to guarantee mid-transfer
    // timing — Bun's synchronous blob.arrayBuffer() can run the entire
    // send loop before the test regains control, making an external
    // a.close() fire after the sender already resolved.  An onProgress
    // callback fires inside the send loop, so the close is guaranteed to
    // happen mid-transfer on every runtime.
    const [a, b] = createFakeTransportPair();
    const data = new Uint8Array(40 * 1024);
    const blob = new Blob([data]);

    const sender = send(blob, a, {
      onProgress: (sent) => {
        if (sent > 0) {
          a.close("simulated failure");
        }
      },
    });
    const receiver = receive(b);

    // On Bun, the entire send loop may have completed synchronously
    // before we reach this point.  Use try/catch instead of
    // expect().rejects to avoid an unhandled-rejection race: the
    // promise may already be settled.
    let senderErr: unknown = null;
    let receiverErr: unknown = null;
    try {
      await sender.promise;
    } catch (err) {
      senderErr = err;
    }
    try {
      await receiver.promise;
    } catch (err) {
      receiverErr = err;
    }

    expect(senderErr).toBeInstanceOf(Error);
    expect(receiverErr).toBeInstanceOf(Error);
  });

  it("sends a single-byte file", async () => {
    const [a, b] = createFakeTransportPair();
    const blob = new Blob([new Uint8Array([42])]);
    const sender = send(blob, a);
    const receiver = receive(b);
    await sender.promise;
    const { blob: received } = await receiver.promise;
    const bytes = new Uint8Array(await received.arrayBuffer());
    expect(bytes).toEqual(new Uint8Array([42]));
  });

  it("sends a file of exactly CHUNK_SIZE (16 KB)", async () => {
    const [a, b] = createFakeTransportPair();
    const data = new Uint8Array(16 * 1024);
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }
    const blob = new Blob([data]);
    const sender = send(blob, a);
    const receiver = receive(b);
    await sender.promise;
    const { blob: received } = await receiver.promise;
    expect(new Uint8Array(await received.arrayBuffer())).toEqual(data);
  });

  /**
   * Cancel protocol: a sender-initiated cancel is distinguishable
   * from a failure. The sender rejects with "Transfer cancelled",
   * the receiver rejects with "Transfer cancelled by sender", and
   * BOTH machines transition to "cancelled" — NOT "failed". The
   * Inbox stays untouched (per the PRD) and the session continues.
   *
   * We cancel from within `onProgress` (synchronously from the send
   * loop) to guarantee mid-flight cancellation — after at least one
   * chunk, before all chunks are sent. The 1 MB file = 64 chunks
   * so the sender is nowhere near done when the first progress
   * update fires.
   */
  it("cancels mid-flight: sender rejects, receiver rejects with 'Transfer cancelled by sender', both machines transition to 'cancelled'", async () => {
    const [a, b] = createFakeTransportPair();
    // 1 MB = 64 chunks. Content doesn't matter — we cancel before
    // the file completes — so the zero-filled default is fine.
    const blob = new Blob([new Uint8Array(1024 * 1024)]);

    // `let` because the onProgress callback closes over `sender`
    // and calls `sender.cancel()`. The callback fires from inside
    // the async send loop, after `sender` is assigned.
    let sender: SendHandle;
    sender = send(blob, a, {
      onProgress: (sent) => {
        if (sent > 0) {
          sender.cancel();
        }
      },
    });
    const receiver = receive(b);

    // On Bun, the entire send loop may have completed synchronously
    // before we reach this point — both promises may already be
    // settled.  Use try/catch instead of expect().rejects to avoid
    // an unhandled-rejection race (the second promise may reject
    // while we're awaiting the first).
    let senderErr: Error | null = null;
    let receiverErr: Error | null = null;
    try {
      await sender.promise;
    } catch (err) {
      senderErr = err instanceof Error ? err : new Error(String(err));
    }
    try {
      await receiver.promise;
    } catch (err) {
      receiverErr = err instanceof Error ? err : new Error(String(err));
    }

    expect(senderErr?.message).toBe("Transfer cancelled");
    expect(receiverErr?.message).toBe("Transfer cancelled by sender");
    // Both machines in "cancelled" (not "failed"). The explicit
    // .not.toBe("failed") next to each catches any future regression
    // where the catch block starts calling machine.fail() without
    // checking the current state.
    expect(sender.getState().kind).toBe("cancelled");
    expect(sender.getState().kind).not.toBe("failed");
    expect(receiver.getState().kind).toBe("cancelled");
    expect(receiver.getState().kind).not.toBe("failed");

    // Transport stays open after the cancel (PRD invariant: the
    // DataChannel stays open so subsequent transfers on the same
    // session are not affected by a cancel).
    expect(a.state).toBe("open");
    expect(b.state).toBe("open");
  });

  /**
   * Sibling to the sender-cancel test: the RECEIVER cancels
   * mid-receive. The cancel must propagate to the sender via a
   * cancel frame (NOT a transport close — the DataChannel stays
   * open for subsequent transfers per the PRD), and BOTH machines
   * must transition to "cancelled" — NOT "failed". The Inbox
   * stays untouched (per the PRD) and the session can continue.
   *
   * This is the symmetric path to the sender-cancel test: the
   * sender.cancel() path sends a cancel frame and rejects with
   * "Transfer cancelled by sender"; this path sends a cancel
   * frame (the other direction) and rejects with "Transfer
   * cancelled by receiver" / "Transfer cancelled".
   */
  it("cancels mid-receive: receiver.cancel() signals the sender via a cancel frame, both machines transition to 'cancelled'", async () => {
    const [a, b] = createFakeTransportPair();
    // 1 MB = 64 chunks — large enough to cancel mid-receive.
    const blob = new Blob([new Uint8Array(1024 * 1024)]);

    // Wait for the first chunk to be RECEIVED (not just sent) before
    // cancelling. The receive() function's onProgress fires after each
    // chunk is processed, so resolving here guarantees the receiver
    // is past the start message and has actually buffered at least
    // one chunk — i.e. the cancel is genuinely mid-receive.
    let resolveFirstChunk: () => void;
    const firstChunkPromise = new Promise<void>((resolve) => {
      resolveFirstChunk = resolve;
    });

    const sender = send(blob, a);
    const receiver = receive(b, {
      onProgress: (received) => {
        if (received > 0) {
          resolveFirstChunk();
        }
      },
    });

    await firstChunkPromise;

    // Cancel mid-receive. This:
    // 1. Transitions the receiver's machine to "cancelled"
    // 2. Sends a cancel frame back to the sender (so the sender
    //    stops sending — the DataChannel stays open)
    // 3. Rejects the receiver's promise with "Transfer cancelled
    //    by receiver" (previously it was left pending, which meant
    //    the caller waited forever)
    receiver.cancel();

    // Receiver's promise rejects with "Transfer cancelled by receiver"
    // (the exact string distinguishes a receiver-initiated cancel
    // from a sender-initiated cancel or a transport close).
    await expect(receiver.promise).rejects.toThrow(
      "Transfer cancelled by receiver"
    );

    // Sender's promise rejects with "Transfer cancelled" (from the
    // send loop's `if (cancelled) throw` check on the next chunk
    // attempt, triggered by the cancel frame from the receiver).
    // The user spec said "transport closed or similar" — "Transfer
    // cancelled" is the symmetric message to the sender-cancel path.
    await expect(sender.promise).rejects.toThrow("Transfer cancelled");

    // Both machines in "cancelled" (NOT "failed"). Same guard pattern
    // as the sender-cancel test: explicit .not.toBe("failed") next to
    // each .toBe("cancelled") catches any future regression where a
    // catch block starts calling machine.fail() unconditionally.
    expect(receiver.getState().kind).toBe("cancelled");
    expect(receiver.getState().kind).not.toBe("failed");
    expect(sender.getState().kind).toBe("cancelled");
    expect(sender.getState().kind).not.toBe("failed");

    // Transport stays open (PRD invariant: the DataChannel stays
    // open so subsequent transfers on the same session are not
    // affected by a cancel — symmetric to the sender-cancel test).
    expect(a.state).toBe("open");
    expect(b.state).toBe("open");
  });

  /**
   * 500 MB guard (issue 13): reject any start message whose
   * totalSize exceeds MAX_TRANSFER_BYTES (500 MiB). The receiver
   * must send a cancel frame back so the sender stops transmitting,
   * and the Inbox must stay untouched (no partial entry).
   *
   * A 501 MB claim should be rejected BEFORE any chunks are
   * buffered, with a cancel frame sent to the sender.
   */
  it("rejects a start message with totalSize > 500MB and sends a cancel frame", async () => {
    const [a, b] = createFakeTransportPair();

    // Listen for the cancel frame on the sender side (b.send()
    // delivers to a's messageHandlers via the fake transport).
    const receivedOnSender: string[] = [];
    a.onmessage((event) => {
      if (typeof event.data === "string") {
        receivedOnSender.push(event.data);
      }
    });

    const receiver = receive(b);

    // Deliver a start message claiming 501 MB (1 byte over the bound).
    const oversizeMsg = encodeStart(
      "file-oversize",
      "huge.bin",
      MAX_TRANSFER_BYTES + 1
    );
    a.send(oversizeMsg);

    await expect(receiver.promise).rejects.toThrow("File too large");

    // Let microtasks flush so the cancel frame is delivered.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Confirm a cancel frame was sent back to the sender, for the correct file.
    expect(receivedOnSender.length).toBe(1);
    expect(isCancelMessage(receivedOnSender[0])).toBe(true);
    expect(JSON.parse(receivedOnSender[0]).fileId).toBe("file-oversize");
  });

  /**
   * 500 MB guard (issue 13): a file of exactly MAX_TRANSFER_BYTES
   * (500 MiB) must be ACCEPTED — the guard uses `>` not `>=`.
   * The start message should be processed normally (onStart fires,
   * machine enters "receiving").
   */
  it("accepts a start message with totalSize exactly at 500MB", async () => {
    const [a, b] = createFakeTransportPair();

    let startFired: { name: string; totalSize: number } | null = null;
    const receiver = receive(b, {
      onStart: (info) => {
        startFired = info;
      },
    });

    // Deliver a start message claiming exactly 500 MB.
    const atLimitMsg = encodeStart(
      "file-at-limit",
      "big.bin",
      MAX_TRANSFER_BYTES
    );
    a.send(atLimitMsg);

    // Wait for microtasks.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // onStart must have fired, proving the start message was processed.
    // toEqual gives a clear diff if startFired is still null.
    expect(startFired).toEqual({
      name: "big.bin",
      totalSize: MAX_TRANSFER_BYTES,
    });

    // Machine must be in "receiving" (not "idle" or "failed").
    expect(receiver.getState().kind).toBe("receiving");
  });
});
