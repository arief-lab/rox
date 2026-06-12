import { describe, expect, it, vi } from "vitest";

import type { InboxEntry } from "@/lib/inbox";
import { encodeChunk, encodeStart, startReceiveLoop } from "@/lib/transfer";
import { encodeCancel } from "@/lib/transfer/chunk-frame";
import { createFakeTransportPair } from "@/lib/webrtc";

/**
 * Helpers to create an inbox-like stub and a session-like stub for
 * the receive-loop tests. The loop takes structural types
 * (InboxLike, SessionLike) so we can pass plain objects.
 */

interface InboxSnapshot {
  entries: Array<{ name: string; size: number }>;
}

function createInboxStub() {
  const entries: InboxEntry[] = [];
  return {
    push: vi.fn(
      (entry: {
        blob: Blob;
        id: string;
        name: string;
        receivedAt: number;
        size: number;
      }) => {
        entries.push(entry as InboxEntry);
      }
    ),
    snapshot: (): InboxSnapshot => ({
      entries: entries.map((e) => ({ name: e.name, size: e.size })),
    }),
  };
}

function createSessionStub() {
  return {
    notifyActivity: vi.fn(),
  };
}

/**
 * Helper: yield to the microtask queue so the fake transport's
 * queueMicrotask dispatches messages to handlers before we assert.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("startReceiveLoop", () => {
  it("starts a loop and waits for incoming files", async () => {
    const [a, b] = createFakeTransportPair();
    const inbox = createInboxStub();
    const session = createSessionStub();

    startReceiveLoop(b, inbox, session);

    // Send a start message and enough chunks to complete a file.
    const fileId = "file-1";
    const name = "hello.txt";
    const content = "Hello, world!";
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    a.send(encodeStart(fileId, name, data.byteLength));
    // Send all data as a single chunk (fits in one CHUNK_SIZE).
    a.send(
      encodeChunk({
        fileId,
        offset: 0,
        length: data.byteLength,
        payload: data.buffer,
      })
    );

    // Flush microtasks so the fake transport delivers the messages.
    await flushMicrotasks();

    // The inbox should have received the file.
    expect(inbox.push).toHaveBeenCalledTimes(1);
    const pushCall = inbox.push.mock.calls[0][0] as {
      name: string;
      size: number;
    };
    expect(pushCall.name).toBe(name);
    expect(pushCall.size).toBe(data.byteLength);

    // Session activity should have been notified.
    expect(session.notifyActivity).toHaveBeenCalledTimes(1);
  });

  it("continues looping after a cancelled transfer", async () => {
    const [a, b] = createFakeTransportPair();
    const inbox = createInboxStub();
    const session = createSessionStub();

    startReceiveLoop(b, inbox, session);

    // Send a start message but then cancel it (simulates sender cancel).
    const fileId = "cancelled-file";
    a.send(encodeStart(fileId, "cancel.txt", 1000));
    a.send(encodeCancel(fileId));

    // Flush microtasks.
    await flushMicrotasks();

    // Inbox should NOT have been pushed (cancelled transfer).
    expect(inbox.push).not.toHaveBeenCalled();

    // Now send a second file — the loop should still be alive.
    const fileId2 = "file-2";
    const content2 = "second attempt";
    const data2 = new TextEncoder().encode(content2);
    a.send(encodeStart(fileId2, "second.txt", data2.byteLength));
    a.send(
      encodeChunk({
        fileId: fileId2,
        offset: 0,
        length: data2.byteLength,
        payload: data2.buffer,
      })
    );

    await flushMicrotasks();

    // Second file should have been received.
    expect(inbox.push).toHaveBeenCalledTimes(1);
    const pushCall = inbox.push.mock.calls[0][0] as {
      name: string;
    };
    expect(pushCall.name).toBe("second.txt");

    // Session notified twice: once per attempt (cancel doesn't notify).
    expect(session.notifyActivity).toHaveBeenCalledTimes(1);
  });

  it("cancelling the loop stops it from receiving further files", async () => {
    const [a, b] = createFakeTransportPair();
    const inbox = createInboxStub();
    const session = createSessionStub();

    const handle = startReceiveLoop(b, inbox, session);

    // Cancel the loop immediately.
    handle.cancel();

    // Send a file — it should NOT be received.
    const fileId = "late-file";
    const data = new TextEncoder().encode("too late");
    a.send(encodeStart(fileId, "late.txt", data.byteLength));
    a.send(
      encodeChunk({
        fileId,
        offset: 0,
        length: data.byteLength,
        payload: data.buffer,
      })
    );

    await flushMicrotasks();
    expect(inbox.push).not.toHaveBeenCalled();
  });

  it("calls onReceiveStart when a new file starts arriving", async () => {
    const [a, b] = createFakeTransportPair();
    const inbox = createInboxStub();
    const session = createSessionStub();
    const onReceiveStart = vi.fn();

    startReceiveLoop(b, inbox, session, { onReceiveStart });

    const fileId = "file-start";
    a.send(encodeStart(fileId, "start-test.txt", 500));
    await flushMicrotasks();

    expect(onReceiveStart).toHaveBeenCalledTimes(1);
    expect(onReceiveStart).toHaveBeenCalledWith(
      expect.objectContaining({ name: "start-test.txt", totalSize: 500 })
    );
  });

  it("calls onEnd after a successful receive", async () => {
    const [a, b] = createFakeTransportPair();
    const inbox = createInboxStub();
    const session = createSessionStub();
    const onEnd = vi.fn();

    startReceiveLoop(b, inbox, session, { onEnd });

    const fileId = "file-end";
    const data = new TextEncoder().encode("done");
    a.send(encodeStart(fileId, "end-test.txt", data.byteLength));
    a.send(
      encodeChunk({
        fileId,
        offset: 0,
        length: data.byteLength,
        payload: data.buffer,
      })
    );

    await flushMicrotasks();

    // onEnd fires once after the file is received (in the finally block).
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("calls onEnd after a cancelled transfer", async () => {
    const [a, b] = createFakeTransportPair();
    const inbox = createInboxStub();
    const session = createSessionStub();
    const onEnd = vi.fn();

    startReceiveLoop(b, inbox, session, { onEnd });

    const fileId = "cancel-end";
    a.send(encodeStart(fileId, "cancel-end.txt", 1000));
    a.send(encodeCancel(fileId));

    await flushMicrotasks();

    // onEnd should have been called (in the finally block after catch).
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("stops the loop on transport close (non-cancelled error)", async () => {
    const [a, b] = createFakeTransportPair();
    const inbox = createInboxStub();
    const session = createSessionStub();

    startReceiveLoop(b, inbox, session);

    // Start sending a file first, then close the transport mid-flight.
    // This triggers a non-cancelled error in the loop, which should
    // break the loop entirely.
    const fileId = "mid-close";
    const data = new TextEncoder().encode("interrupted");
    a.send(encodeStart(fileId, "interrupted.txt", data.byteLength));
    await flushMicrotasks();

    // Close the transport mid-transfer (simulating a connection drop).
    a.close("peer disconnected");
    await flushMicrotasks();

    // The inbox should NOT have been pushed (transport closed before
    // chunks arrived).
    expect(inbox.push).not.toHaveBeenCalled();
  });

  it("does not call onReceiveStart after the loop is cancelled", async () => {
    const [a, b] = createFakeTransportPair();
    const inbox = createInboxStub();
    const session = createSessionStub();
    const onReceiveStart = vi.fn();
    const onEnd = vi.fn();

    const handle = startReceiveLoop(b, inbox, session, {
      onReceiveStart,
      onEnd,
    });

    // Cancel before any file is sent.
    handle.cancel();

    // Send a file.
    const fileId = "late-file-2";
    const data = new TextEncoder().encode("should not trigger callbacks");
    a.send(encodeStart(fileId, "late2.txt", data.byteLength));
    a.send(
      encodeChunk({
        fileId,
        offset: 0,
        length: data.byteLength,
        payload: data.buffer,
      })
    );

    await flushMicrotasks();

    expect(onReceiveStart).not.toHaveBeenCalled();
    // onEnd fires once in the finally block when the cancelled
    // receive handle rejects and the loop exits (cancelled=true).
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(inbox.push).not.toHaveBeenCalled();
  });
});
