import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Inbox } from "@/lib/inbox";
import { createFakeTransportPair, Session } from "@/lib/webrtc";

describe("Session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeSession(idleWindowMs = 5000) {
    const [t] = createFakeTransportPair();
    const inbox = new Inbox();
    const session = new Session(t, inbox, {
      idleWindowMs,
      bindPageHide: false,
    });
    return { transport: t, inbox, session };
  }

  it("does nothing until start() is called", () => {
    const { session, inbox } = makeSession(1000);
    const onClose = vi.fn();
    session.onClose(onClose);
    vi.advanceTimersByTime(2000);
    expect(onClose).not.toHaveBeenCalled();
    expect(session.isClosed()).toBe(false);
    expect(inbox.size()).toBe(0);
  });

  it("fires onClose after the idle window elapses with no activity", () => {
    const { session } = makeSession(1000);
    session.start();
    const onClose = vi.fn();
    session.onClose(onClose);

    vi.advanceTimersByTime(999);
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledWith("idle timeout");
    expect(session.isClosed()).toBe(true);
    expect(session.getCloseReason()).toBe("idle timeout");
  });

  it("notifyActivity() resets the idle timer", () => {
    const { session } = makeSession(1000);
    session.start();
    const onClose = vi.fn();
    session.onClose(onClose);

    vi.advanceTimersByTime(900);
    session.notifyActivity();
    vi.advanceTimersByTime(900);
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onClose).toHaveBeenCalledWith("idle timeout");
  });

  it("onActivity subscribers fire on each notifyActivity", () => {
    const { session } = makeSession(1000);
    session.start();
    const onActivity = vi.fn();
    session.onActivity(onActivity);

    session.notifyActivity();
    session.notifyActivity();

    expect(onActivity).toHaveBeenCalledTimes(2);
  });

  it("transport.close() triggers session.close() with the transport's reason", () => {
    const { transport, session, inbox } = makeSession(10_000);
    session.start();
    const onClose = vi.fn();
    session.onClose(onClose);
    inbox.push({
      id: "x",
      name: "x.txt",
      size: 1,
      blob: new Blob([new Uint8Array(1)]),
      receivedAt: Date.now(),
    });
    expect(inbox.size()).toBe(1);

    transport.close("peer gone");

    expect(onClose).toHaveBeenCalledWith("peer gone");
    expect(session.isClosed()).toBe(true);
    // The Session clears the Inbox on close.
    expect(inbox.size()).toBe(0);
  });

  it("session.close() is idempotent (second call is a no-op)", () => {
    const { session } = makeSession(10_000);
    session.start();
    const onClose = vi.fn();
    session.onClose(onClose);

    session.close("user closed");
    session.close("user closed again");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("user closed");
  });

  it("session.close() clears the Inbox and closes the transport", () => {
    const { transport, session, inbox } = makeSession(10_000);
    session.start();
    inbox.push({
      id: "a",
      name: "a.txt",
      size: 1,
      blob: new Blob([new Uint8Array(1)]),
      receivedAt: Date.now(),
    });
    expect(inbox.size()).toBe(1);

    session.close("user closed");

    expect(inbox.size()).toBe(0);
    expect(transport.state).toBe("closed");
  });

  it("pagehide closes the Session when bindPageHide is enabled", () => {
    const [t] = createFakeTransportPair();
    const inbox = new Inbox();
    let registeredHandler: (() => void) | null = null;
    const removePageHide = vi.fn();
    const addPageHideListener = (handler: () => void) => {
      registeredHandler = handler;
      return removePageHide;
    };
    const session = new Session(t, inbox, {
      idleWindowMs: 10_000,
      addPageHideListener,
    });
    session.start();
    expect(registeredHandler).not.toBeNull();
    const onClose = vi.fn();
    session.onClose(onClose);

    // Fire the registered pagehide handler. The non-null assertion
    // is safe here because the `expect(registeredHandler).not.toBeNull()`
    // assertion above is the runtime guard; TypeScript just can't
    // carry the narrowing through the opaque `session.onClose` call.
    // biome-ignore lint/style/noNonNullAssertion: runtime-guarded by expect().not.toBeNull() above
    registeredHandler!();

    expect(onClose).toHaveBeenCalledWith("page hidden");
    expect(session.isClosed()).toBe(true);
    // The Session unsubscribes its pagehide listener on close.
    expect(removePageHide).toHaveBeenCalled();
  });

  it("getRemainingIdleMs() decreases as time passes", () => {
    const { session } = makeSession(5000);
    session.start();
    expect(session.getRemainingIdleMs()).toBe(5000);
    vi.advanceTimersByTime(1000);
    expect(session.getRemainingIdleMs()).toBe(4000);
    vi.advanceTimersByTime(4000);
    expect(session.getRemainingIdleMs()).toBe(0);
  });

  it("getRemainingIdleMs() returns 0 after the Session is closed", () => {
    const { session } = makeSession(1000);
    session.start();
    vi.advanceTimersByTime(1000);
    expect(session.isClosed()).toBe(true);
    expect(session.getRemainingIdleMs()).toBe(0);
  });

  it("default idle window is 5 minutes when not configured", () => {
    const [t] = createFakeTransportPair();
    const inbox = new Inbox();
    const session = new Session(t, inbox, { bindPageHide: false });
    expect(session.getIdleWindowMs()).toBe(5 * 60 * 1000);
  });

  it("onClose unsubscribe stops the handler from firing", () => {
    const { session } = makeSession(1000);
    session.start();
    const onClose = vi.fn();
    const unsubscribe = session.onClose(onClose);
    unsubscribe();

    vi.advanceTimersByTime(1000);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("subscribe/unsubscribe for both signals is independent", () => {
    const { session } = makeSession(1000);
    session.start();
    const onActivity = vi.fn();
    const onClose = vi.fn();
    const unsubActivity = session.onActivity(onActivity);
    const unsubClose = session.onClose(onClose);
    unsubActivity();
    session.notifyActivity();
    session.close("user closed");
    unsubClose();
    session.notifyActivity();
    vi.advanceTimersByTime(1000);

    expect(onActivity).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
