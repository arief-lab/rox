import type { Inbox } from "@/lib/inbox";
import type { Transport } from "./types";

/**
 * Configuration for a Session. All options are optional; the defaults
 * give a 5-minute idle window and bind to `pagehide` (when running in
 * a browser).
 */
export interface SessionOptions {
  /**
   * Subscribes to `pagehide` (when `bindPageHide` is true).
   * Override for tests so jsdom's `pagehide` event can be triggered
   * without a real browser. Default: `window.addEventListener`.
   */
  addPageHideListener?: (handler: () => void) => () => void;
  /**
   * When true (the default in a browser environment), the Session
   * listens for `pagehide` and closes itself with reason
   * `"page hidden"`. The other side sees the DataChannel close and
   * closes its own Session within the normal handshake time.
   *
   * Set to false in non-browser environments (tests, SSR) or if
   * the caller wants to manage the pagehide lifecycle itself.
   */
  bindPageHide?: boolean;
  /**
   * Cancels a scheduled callback. Default: the global `clearTimeout`.
   * The handle type is left loose (`unknown`) so the default Node /
   * browser `clearTimeout` (which expects `number | undefined`) is
   * assignable; the Session only ever passes back handles it got
   * from `setTimeoutFn`.
   */
  clearTimeoutFn?: (handle: unknown) => void;
  /**
   * How long the Session may sit without any activity (send or
   * receive) before it auto-closes. Default: 5 minutes.
   */
  idleWindowMs?: number;
  /**
   * Returns "now" in milliseconds. Override for tests. Default:
   * `Date.now`.
   */
  now?: () => number;
  /**
   * Schedules a callback after `ms` milliseconds. Override for
   * tests so the idle timer can be advanced under fake timers.
   * Default: the global `setTimeout`.
   */
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
}

/**
 * The reason the Session ended, exposed to onClose subscribers.
 */
export type SessionCloseReason =
  | "idle timeout"
  | "page hidden"
  | "data channel closed"
  | "peer connection failed"
  | "peer connection closed"
  | "user closed"
  | "closed";

/**
 * Session — the live, paired state between two devices.
 *
 * Per the PRD glossary: "the period after a Pairing succeeds and
 * before either side ends it. Ephemeral: the Session ends
 * automatically when the underlying connection closes, when either
 * side closes the app, or after a short idle window."
 *
 * Wraps a Transport (the data channel) and an Inbox (the session-
 * scoped list of received files). Responsible for:
 *
 * - Closing the Session when the DataChannel closes (via
 *   `transport.onclose`).
 * - Closing the Session when the page is hidden (via
 *   `window.pagehide`).
 * - Closing the Session after a configurable idle window with no
 *   send or receive activity.
 * - Clearing the Inbox on close.
 *
 * Consumers subscribe to `onClose` to react to the end of the
 * Session (typically: navigate back to the idle screen). They call
 * `notifyActivity()` after each successful send or receive to keep
 * the idle timer fresh.
 */
export class Session {
  private readonly transport: Transport;
  private readonly inbox: Inbox;
  private readonly idleWindowMs: number;
  private readonly now: () => number;
  private readonly setTimeoutFn: (fn: () => void, ms: number) => unknown;
  // Cast through `unknown` so the default `clearTimeout` (typed as
  // `(handle: number | undefined) => void` in Node) is assignable
  // to our looser `(handle: unknown) => void` field. The Session
  // only ever round-trips handles it got from `setTimeoutFn`, so
  // the looser type is safe at runtime.
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly addPageHideListener:
    | ((handler: () => void) => () => void)
    | null;

  private readonly closeHandlers = new Set<(reason: string) => void>();
  private readonly activityHandlers = new Set<() => void>();

  private started = false;
  private closed = false;
  private closeReason: string | null = null;
  private idleDeadlineMs: number | null = null;
  private idleTimer: unknown = null;
  private unsubscribeTransport: (() => void) | null = null;
  private removePageHideListener: (() => void) | null = null;

  constructor(
    transport: Transport,
    inbox: Inbox,
    options: SessionOptions = {}
  ) {
    this.transport = transport;
    this.inbox = inbox;
    this.idleWindowMs = options.idleWindowMs ?? 5 * 60 * 1000;
    this.now = options.now ?? Date.now;
    // Wrap the global timer functions in arrow function adapters so the
    // `this` binding (window.setTimeout in the browser, globalThis.setTimeout
    // in Node) is preserved. Destructuring `setTimeout` directly into a
    // field and calling `this.setTimeoutFn(...)` throws "Illegal invocation"
    // in browsers because the underlying Web API requires `this === window`.
    this.setTimeoutFn =
      options.setTimeoutFn ??
      ((fn: () => void, ms: number) => setTimeout(fn, ms));
    this.clearTimeoutFn =
      options.clearTimeoutFn ??
      ((handle: unknown) => {
        clearTimeout(handle as Parameters<typeof clearTimeout>[0]);
      });
    this.addPageHideListener =
      options.addPageHideListener ?? defaultAddPageHideListener;
    if (options.bindPageHide === false) {
      this.addPageHideListener = null;
    }
  }

  /**
   * Begin the Session lifecycle. Subscribes to the Transport's
   * `onclose` and (if `bindPageHide` is true) to `window.pagehide`,
   * then starts the idle timer.
   *
   * Idempotent: calling `start()` a second time is a no-op.
   */
  start(): void {
    if (this.started || this.closed) {
      return;
    }
    this.started = true;

    this.unsubscribeTransport = this.transport.onclose((event) => {
      this.close(event.reason);
    });

    if (this.addPageHideListener) {
      this.removePageHideListener = this.addPageHideListener(() => {
        this.close("page hidden");
      });
    }

    this.resetIdleTimer();
  }

  /**
   * Mark a send or receive as activity. Resets the idle timer and
   * fires any `onActivity` subscribers. No-op after the Session is
   * closed.
   */
  notifyActivity(): void {
    if (this.closed) {
      return;
    }
    this.resetIdleTimer();
    for (const fn of [...this.activityHandlers]) {
      fn();
    }
  }

  /**
   * Subscribe to activity events (each `notifyActivity` call fires
   * all subscribers). Returns an unsubscribe function.
   */
  onActivity(handler: () => void): () => void {
    this.activityHandlers.add(handler);
    return () => {
      this.activityHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to close events. The handler is invoked with the
   * close reason. Returns an unsubscribe function.
   */
  onClose(handler: (reason: string) => void): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  /**
   * End the Session. Closes the Transport, clears the Inbox, fires
   * `onClose` subscribers, and removes the pagehide listener.
   *
   * The reason is typed as `string` (not the narrow
   * `SessionCloseReason` union) because the Session is most often
   * closed in response to a Transport close event, which carries
   * an arbitrary string reason (e.g., "data channel closed",
   * "peer connection failed"). The well-known SessionCloseReason
   * values are used by the Session's own triggers (idle timeout,
   * pagehide, user close) but any string is valid.
   *
   * Idempotent: a second `close` call is a no-op.
   */
  close(reason = "closed"): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.closeReason = reason;
    this.clearIdleTimer();
    this.unsubscribeTransport?.();
    this.unsubscribeTransport = null;
    this.removePageHideListener?.();
    this.removePageHideListener = null;
    // Clear the Inbox before notifying subscribers so they see an
    // empty Inbox in the onClose handler.
    this.inbox.clear();
    try {
      this.transport.close(reason);
    } catch {
      // transport may already be closed
    }
    for (const fn of [...this.closeHandlers]) {
      fn(reason);
    }
  }

  /** Whether the Session has ended. */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * The reason the Session ended, or null if it's still active.
   * Useful for showing the user a "Session ended: X" message.
   */
  getCloseReason(): string | null {
    return this.closeReason;
  }

  /**
   * Milliseconds remaining before the idle timer fires, or 0 if the
   * Session is closed. Useful for the SessionTimer display.
   */
  getRemainingIdleMs(): number {
    if (this.closed || this.idleDeadlineMs === null) {
      return 0;
    }
    return Math.max(0, this.idleDeadlineMs - this.now());
  }

  /**
   * Total idle window configured for this Session.
   */
  getIdleWindowMs(): number {
    return this.idleWindowMs;
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleDeadlineMs = this.now() + this.idleWindowMs;
    this.idleTimer = this.setTimeoutFn(() => {
      this.close("idle timeout");
    }, this.idleWindowMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      this.clearTimeoutFn(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

/**
 * Default `addPageHideListener` for the browser: subscribes to
 * `window`'s `pagehide` event and returns the cleanup function.
 * Returns a no-op unsubscribe in non-browser environments (SSR,
 * Node tests) so the Session can still be constructed.
 */
function defaultAddPageHideListener(handler: () => void): () => void {
  if (typeof window === "undefined") {
    // Non-browser: bind nothing, return a no-op unsubscribe.
    return () => undefined;
  }
  window.addEventListener("pagehide", handler);
  return () => {
    window.removeEventListener("pagehide", handler);
  };
}
