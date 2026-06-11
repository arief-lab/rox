import { describe, expect, it, vi } from "vitest";

import {
  createFakeTransportPair,
  type Transport,
  type TransportMessage,
} from "@/lib/webrtc";

/** Matches the error thrown by FakeTransport.send when the state is not "open". */
const CANNOT_SEND_REGEX = /cannot send/;

/**
 * Wait for a single message matching `data` to arrive on `transport`.
 * Returns a promise that resolves with the matching event, or rejects
 * after a short timeout if the message never arrives.
 */
function waitForMessage(
  transport: Transport,
  data: string | ArrayBuffer
): Promise<TransportMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      off();
      reject(new Error("Timed out waiting for message"));
    }, 1000);
    const off = transport.onmessage((event) => {
      if (event.data === data) {
        clearTimeout(timeout);
        off();
        resolve(event);
      }
    });
  });
}

describe("createFakeTransportPair", () => {
  it("exchanges a 'ping' from A to B in < 100ms", async () => {
    const [a, b] = createFakeTransportPair();
    const received = vi.fn();
    b.onmessage(received);

    const start = performance.now();
    a.send("ping");
    await waitForMessage(b, "ping");
    const elapsed = performance.now() - start;

    expect(received).toHaveBeenCalledWith({ data: "ping" });
    expect(elapsed).toBeLessThan(100);
  });

  it("exchanges 'ping' in both directions", async () => {
    const [a, b] = createFakeTransportPair();
    const aReceived = vi.fn();
    const bReceived = vi.fn();
    a.onmessage(aReceived);
    b.onmessage(bReceived);

    a.send("ping-from-a");
    await waitForMessage(b, "ping-from-a");
    b.send("ping-from-b");
    await waitForMessage(a, "ping-from-b");

    expect(aReceived).toHaveBeenCalledWith({ data: "ping-from-b" });
    expect(bReceived).toHaveBeenCalledWith({ data: "ping-from-a" });
  });

  it("delivers ArrayBuffer messages unchanged", async () => {
    const [a, b] = createFakeTransportPair();
    const payload = new TextEncoder().encode("binary-payload").buffer;
    const received = vi.fn();
    b.onmessage(received);

    a.send(payload);
    await waitForMessage(b, payload);
    expect(received).toHaveBeenCalledWith({ data: payload });
  });

  it("tears down the peer when one side calls close()", () => {
    const [a, b] = createFakeTransportPair();
    const bClosed = vi.fn();
    b.onclose(bClosed);

    a.close("test reason");

    expect(bClosed).toHaveBeenCalledWith({ reason: "test reason" });
    expect(b.state).toBe("closed");
    expect(b.closeReason).toBe("test reason");
  });

  it("throws when sending on a closed transport", () => {
    const [a] = createFakeTransportPair();
    a.close("done");
    expect(() => a.send("ping")).toThrow(CANNOT_SEND_REGEX);
    expect(a.state).toBe("closed");
  });

  it("close() is idempotent: the first reason wins, no second onclose event fires", () => {
    const aClosed = vi.fn();
    const bClosed = vi.fn();
    const [a, b] = createFakeTransportPair();
    a.onclose(aClosed);
    b.onclose(bClosed);

    a.close("first");
    a.close("second");
    // Propagation already closed b with the same reason.
    expect(a.closeReason).toBe("first");
    expect(b.closeReason).toBe("first");
    expect(b.state).toBe("closed");

    // Subsequent close() calls do not fire onclose again.
    expect(aClosed).toHaveBeenCalledTimes(1);
    expect(bClosed).toHaveBeenCalledTimes(1);
  });

  it("supports multiple independent onmessage handlers", async () => {
    const [a, b] = createFakeTransportPair();
    const h1 = vi.fn();
    const h2 = vi.fn();
    b.onmessage(h1);
    b.onmessage(h2);

    a.send("broadcast");
    await waitForMessage(b, "broadcast");
    expect(h1).toHaveBeenCalledWith({ data: "broadcast" });
    expect(h2).toHaveBeenCalledWith({ data: "broadcast" });
  });

  it("unsubscribes onmessage handlers correctly", async () => {
    const [a, b] = createFakeTransportPair();
    const received = vi.fn();
    const off = b.onmessage(received);
    off();

    a.send("ping");
    await new Promise((r) => setTimeout(r, 0));
    expect(received).not.toHaveBeenCalled();
  });
});
