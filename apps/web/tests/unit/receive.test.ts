// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";

import {
  encodeChunk,
  encodeStart,
  receive,
  TransferMachine,
} from "@/lib/transfer";
import { createFakeTransportPair } from "@/lib/webrtc";

/**
 * Helper: yield to the microtask queue so the fake transport
 * dispatches messages to handlers before we assert.
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("receive — normal flow", () => {
  it("completes a normal receive successfully", async () => {
    const [a, b] = createFakeTransportPair();

    const handle = receive(b);

    const fileId = "normal-file";
    const content = "Hello, world!";
    const data = new TextEncoder().encode(content);

    a.send(encodeStart(fileId, "hello.txt", data.byteLength));
    a.send(
      encodeChunk({
        fileId,
        offset: 0,
        length: data.byteLength,
        payload: data.buffer,
      })
    );

    await flush();

    const result = await handle.promise;
    expect(result.name).toBe("hello.txt");
    const text = await result.blob.text();
    expect(text).toBe("Hello, world!");
  });

  it("handles cancel from the receiver side", async () => {
    const [a, b] = createFakeTransportPair();

    const handle = receive(b);

    const fileId = "cancel-file";
    const content = "should not complete";
    const data = new TextEncoder().encode(content);

    a.send(encodeStart(fileId, "cancel-me.txt", data.byteLength));
    await flush();

    // Cancel before chunks arrive.
    handle.cancel();

    await expect(handle.promise).rejects.toThrow(
      "Transfer cancelled by receiver"
    );
  });
});

describe("receive — stale chunks before start message", () => {
  /**
   * Chain the promise rejection handler BEFORE flushing microtasks.
   * The fake transport dispatches messages via queueMicrotask, so
   * the rejection fires on the microtask after flush(). Without
   * the pre-chained .catch() or expect.rejects, vitest detects an
   * unhandled rejection because no handler is attached at the time
   * the microtask fires.
   *
   * Pattern: create the expect chain before flush(), then flush(),
   * then await the expect chain.
   */
  it("rejects with 'Chunk received before start message' when a stale chunk arrives before the start message", async () => {
    const [a, b] = createFakeTransportPair();
    const machine = new TransferMachine();

    const handle = receive(b, { machine });

    // Send a stale chunk BEFORE any start message — this simulates
    // leftover ArrayBuffer data from a previous cancelled transfer
    // arriving on the transport before the next file's start message.
    const staleContent = new TextEncoder().encode("stale-data");
    a.send(
      encodeChunk({
        fileId: "stale-file-id",
        offset: 0,
        length: staleContent.byteLength,
        payload: staleContent.buffer,
      })
    );

    // Chain the assertion before flushing — the rejection fires
    // on the microtask after flush(), and expect.rejects attaches
    // a .catch() handler BEFORE that microtask runs.
    const assertion = expect(handle.promise).rejects.toThrow(
      "Chunk received before start message"
    );
    await flush();
    await assertion;

    // The machine must still be in a clean state (idle, not corrupted).
    expect(machine.getState().kind).toBe("idle");
  });

  it("recovers from a stale chunk when a proper file is sent next", async () => {
    const [a, b] = createFakeTransportPair();

    const handle = receive(b);

    // Step 1: send a stale chunk (no matching start message).
    const staleContent = new TextEncoder().encode("stale");
    a.send(
      encodeChunk({
        fileId: "stale-id",
        offset: 0,
        length: staleContent.byteLength,
        payload: staleContent.buffer,
      })
    );

    // Pre-chain assertion before flush.
    const assertion1 = expect(handle.promise).rejects.toThrow(
      "Chunk received before start message"
    );
    await flush();
    await assertion1;

    // Step 2: start a new receive and send a proper file.
    // The transport is reusable after a clean rejection (cleanup(subs)
    // unsubscribes the old handlers; receive(b) registers new ones).
    const handle2 = receive(b);
    const fileId = "real-file";
    const content = "hello after stale chunk";
    const data = new TextEncoder().encode(content);

    a.send(encodeStart(fileId, "recovery.txt", data.byteLength));
    a.send(
      encodeChunk({
        fileId,
        offset: 0,
        length: data.byteLength,
        payload: data.buffer,
      })
    );

    await flush();

    const result = await handle2.promise;
    expect(result.name).toBe("recovery.txt");
    const text = await result.blob.text();
    expect(text).toBe("hello after stale chunk");
  });

  it("does NOT throw 'Cannot fail from idle' — the specific state-machine guard works", async () => {
    const [a, b] = createFakeTransportPair();

    const handle = receive(b);

    a.send(
      encodeChunk({
        fileId: "any-id",
        offset: 0,
        length: 10,
        payload: new ArrayBuffer(10),
      })
    );

    // Pre-chain assertion before flush.
    const assertion = expect(handle.promise).rejects.toThrow();
    await flush();
    await assertion;

    // The error must NOT be the raw state-machine crash.
    let thrown: unknown = null;
    try {
      await handle.promise; // already settled, this runs synchronously
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    const errMsg = (thrown as Error).message;
    expect(errMsg).toBe("Chunk received before start message");
    expect(errMsg).not.toContain("Cannot fail from idle");
  });
});

describe("receive — callbacks", () => {
  it("calls onStart when a start message is received, then onProgress on chunks", async () => {
    const [a, b] = createFakeTransportPair();
    const onStart = vi.fn();
    const onProgress = vi.fn();

    const handle = receive(b, { onStart, onProgress });

    const fileId = "cb-file";
    const content = "callback test";
    const data = new TextEncoder().encode(content);

    a.send(encodeStart(fileId, "cb.txt", data.byteLength));
    await flush();

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ name: "cb.txt", totalSize: data.byteLength })
    );
    expect(onProgress).not.toHaveBeenCalled(); // no chunks yet

    a.send(
      encodeChunk({
        fileId,
        offset: 0,
        length: data.byteLength,
        payload: data.buffer,
      })
    );
    await flush();

    const result = await handle.promise;
    expect(result.name).toBe("cb.txt");
    expect(onProgress).toHaveBeenCalled();
  });
});
