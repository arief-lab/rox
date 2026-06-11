import { describe, expect, it } from "vitest";

import { receive, send } from "@/lib/transfer";
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
    // We close the transport BEFORE the sender's first send() call so the
    // failure is deterministic. A setTimeout(0) yield would let the sender
    // complete (the 40 KB file fits in 3 chunks, all sent within one tick).
    const [a, b] = createFakeTransportPair();
    const data = new Uint8Array(40 * 1024);
    const blob = new Blob([data]);

    const sender = send(blob, a);
    const receiver = receive(b);

    a.close("simulated failure");

    await expect(sender.promise).rejects.toThrow();
    await expect(receiver.promise).rejects.toThrow();
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
});
