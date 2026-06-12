// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionTimer } from "@/components/session-timer";
import type { Session } from "@/lib/webrtc";

/**
 * Build a mock Session with the given return values for its
 * lifecycle methods. `getRemainingIdleMs` and `isClosed` are
 * required; `getCloseReason` defaults to null.
 */
function mockSession(overrides: {
  getRemainingIdleMs?: () => number;
  isClosed?: () => boolean;
  getCloseReason?: () => string | null;
}): Session {
  return {
    getRemainingIdleMs: overrides.getRemainingIdleMs ?? (() => 300_000),
    isClosed: overrides.isClosed ?? (() => false),
    getCloseReason: overrides.getCloseReason ?? (() => null),
  } as Session;
}

function render(session: Session) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<SessionTimer session={session} />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const TIMER = '[data-testid="session-timer"]';

describe("SessionTimer", () => {
  it("renders the idle countdown when the session is open", () => {
    const session = mockSession({ getRemainingIdleMs: () => 300_000 });
    const { container, unmount } = render(session);
    expect(container.querySelector(TIMER)?.textContent).toBe("Idle in 5:00");
    unmount();
  });

  it("formats 30 seconds as 0:30", () => {
    const session = mockSession({ getRemainingIdleMs: () => 30_000 });
    const { container, unmount } = render(session);
    expect(container.querySelector(TIMER)?.textContent).toBe("Idle in 0:30");
    unmount();
  });

  it("formats 1 minute 5 seconds as 1:05", () => {
    const session = mockSession({ getRemainingIdleMs: () => 65_000 });
    const { container, unmount } = render(session);
    expect(container.querySelector(TIMER)?.textContent).toBe("Idle in 1:05");
    unmount();
  });

  it("shows 'Session ended' when isClosed returns true", () => {
    const session = mockSession({
      isClosed: () => true,
      getRemainingIdleMs: () => 0,
    });
    const { container, unmount } = render(session);
    expect(container.querySelector(TIMER)?.textContent).toBe("Session ended");
    unmount();
  });

  it("shows the close reason when available", () => {
    const session = mockSession({
      isClosed: () => true,
      getRemainingIdleMs: () => 0,
      getCloseReason: () => "Idle timeout",
    });
    const { container, unmount } = render(session);
    expect(container.querySelector(TIMER)?.textContent).toBe(
      "Session ended (Idle timeout)"
    );
    unmount();
  });

  it("polls getRemainingIdleMs on the 1-second interval", () => {
    const getRemainingIdleMs = vi.fn().mockReturnValue(300_000);
    const session = mockSession({ getRemainingIdleMs });
    const { unmount } = render(session);

    // After render: called once by useState initializer, once by useEffect
    expect(getRemainingIdleMs).toHaveBeenCalledTimes(2);

    // Advance 1 second — interval fires
    vi.advanceTimersByTime(1000);
    expect(getRemainingIdleMs).toHaveBeenCalledTimes(3);

    // Advance another second
    vi.advanceTimersByTime(1000);
    expect(getRemainingIdleMs).toHaveBeenCalledTimes(4);

    unmount();
  });

  it("clears the interval on unmount", () => {
    const getRemainingIdleMs = vi.fn().mockReturnValue(300_000);
    const session = mockSession({ getRemainingIdleMs });
    const { unmount } = render(session);

    const callsBefore = getRemainingIdleMs.mock.calls.length;
    unmount();

    // Advance 5 seconds — interval should be cleared, no more calls
    vi.advanceTimersByTime(5000);
    expect(getRemainingIdleMs).toHaveBeenCalledTimes(callsBefore);
  });

  it("does not set up an interval when session is already closed", () => {
    const getRemainingIdleMs = vi.fn().mockReturnValue(0);
    const session = mockSession({
      isClosed: () => true,
      getRemainingIdleMs,
    });
    const { unmount } = render(session);

    const callsBefore = getRemainingIdleMs.mock.calls.length;

    // Advance 5 seconds — no interval should be running
    vi.advanceTimersByTime(5000);
    expect(getRemainingIdleMs).toHaveBeenCalledTimes(callsBefore);
    unmount();
  });

  it("shows 'Idle in 0:00' when remaining reaches 0", () => {
    const getRemainingIdleMs = vi.fn().mockReturnValue(0);
    const session = mockSession({ getRemainingIdleMs });
    const { container, unmount } = render(session);

    // Math.ceil(0 / 1000) = 0 → shows 0:00
    expect(container.querySelector(TIMER)?.textContent).toBe("Idle in 0:00");
    unmount();
  });

  it("does not re-check isClosed when session identity is unchanged", () => {
    // This documents that the component's useEffect depends on
    // [session] identity — mutating the same session object
    // won't trigger the isClosed() check. If the parent passes
    // a new session object, the effect re-runs.
    const isClosed = vi.fn().mockReturnValue(false);
    const session = mockSession({ isClosed });
    const { container, unmount } = render(session);

    expect(container.querySelector(TIMER)?.textContent).toContain("Idle in");

    // Mutate the same session's mock (identity unchanged)
    isClosed.mockReturnValue(true);
    vi.advanceTimersByTime(1000);
    flushSync(() => undefined);

    // Effect didn't re-run — still shows idle countdown
    expect(container.querySelector(TIMER)?.textContent).toContain("Idle in");
    unmount();
  });
});
