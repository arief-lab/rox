// SPDX-License-Identifier: AGPL-3.0-or-later
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReceiveProgress } from "@/components/use-receive-progress";
import type { ReceiveHandle } from "@/lib/transfer";

// ---------------------------------------------------------------------------
// Mock ReceiveHandle
// ---------------------------------------------------------------------------

function mockReceiveHandle(overrides?: { cancel?: () => void }): ReceiveHandle {
  return {
    cancel: overrides?.cancel ?? vi.fn(),
    getState: () =>
      ({ kind: "completed" }) as ReturnType<ReceiveHandle["getState"]>,
    promise: Promise.resolve({ blob: new Blob(), name: "test" }),
  };
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

interface HookAPI {
  handleCancelReceive: () => void;
  receiveLoopCallbacks: ReturnType<
    typeof useReceiveProgress
  >["receiveLoopCallbacks"];
  receiveProgress: { bytes: number; total: number } | null;
  reset: () => void;
}

function createTestHarness() {
  const api: HookAPI = {} as HookAPI;

  function Harness() {
    const {
      handleCancelReceive,
      receiveProgress,
      receiveLoopCallbacks,
      reset,
    } = useReceiveProgress();
    api.handleCancelReceive = handleCancelReceive;
    api.receiveProgress = receiveProgress;
    api.receiveLoopCallbacks = receiveLoopCallbacks;
    api.reset = reset;

    return (
      <div>
        <button
          data-testid="btn-cancel"
          onClick={handleCancelReceive}
          type="button"
        >
          Cancel
        </button>
        <button data-testid="btn-reset" onClick={reset} type="button">
          Reset
        </button>
        <button
          data-testid="btn-fire-start"
          onClick={() =>
            receiveLoopCallbacks.onReceiveStart({
              name: "incoming.bin",
              totalSize: 1000,
              handle: mockReceiveHandle(),
            })
          }
          type="button"
        >
          Fire start
        </button>
        <button
          data-testid="btn-fire-progress"
          onClick={() => receiveLoopCallbacks.onProgress(250, 1000)}
          type="button"
        >
          Fire progress
        </button>
        <button
          data-testid="btn-fire-end"
          onClick={receiveLoopCallbacks.onEnd}
          type="button"
        >
          Fire end
        </button>
        <span data-testid="progress-value">
          {receiveProgress === null
            ? "null"
            : `${receiveProgress.bytes}/${receiveProgress.total}`}
        </span>
      </div>
    );
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness />);
  });

  return {
    api,
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useReceiveProgress — initial state", () => {
  it("starts with null receiveProgress", () => {
    const { api, unmount } = createTestHarness();
    expect(api.receiveProgress).toBeNull();
    unmount();
  });

  it("exposes handleCancelReceive, reset, and receiveLoopCallbacks", () => {
    const { api, unmount } = createTestHarness();
    expect(typeof api.handleCancelReceive).toBe("function");
    expect(typeof api.reset).toBe("function");
    expect(api.receiveLoopCallbacks).toBeDefined();
    expect(typeof api.receiveLoopCallbacks.onEnd).toBe("function");
    expect(typeof api.receiveLoopCallbacks.onProgress).toBe("function");
    expect(typeof api.receiveLoopCallbacks.onReceiveStart).toBe("function");
    unmount();
  });
});

describe("useReceiveProgress — handleCancelReceive", () => {
  it("is a no-op when no receive is in flight", () => {
    const { api, unmount } = createTestHarness();
    expect(() => api.handleCancelReceive()).not.toThrow();
    unmount();
  });

  it("calls cancel on the in-flight receive handle", () => {
    const cancelFn = vi.fn();
    const handle = mockReceiveHandle({ cancel: cancelFn });
    const { api, unmount } = createTestHarness();

    // Simulate a receive starting (stores the handle in the ref)
    act(() => {
      api.receiveLoopCallbacks.onReceiveStart({
        name: "incoming.bin",
        totalSize: 1000,
        handle,
      });
    });

    act(() => {
      api.handleCancelReceive();
    });

    expect(cancelFn).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe("useReceiveProgress — callback lifecycle", () => {
  it("onProgress updates receiveProgress", () => {
    const { api, unmount } = createTestHarness();

    act(() => {
      api.receiveLoopCallbacks.onProgress(500, 1000);
    });

    expect(api.receiveProgress).toEqual({ bytes: 500, total: 1000 });
    unmount();
  });

  it("onProgress updates from a different value", () => {
    const { api, unmount } = createTestHarness();

    act(() => {
      api.receiveLoopCallbacks.onProgress(100, 500);
    });
    expect(api.receiveProgress).toEqual({ bytes: 100, total: 500 });

    act(() => {
      api.receiveLoopCallbacks.onProgress(300, 500);
    });
    expect(api.receiveProgress).toEqual({ bytes: 300, total: 500 });
    unmount();
  });

  it("onEnd clears receiveProgress", () => {
    const { api, unmount } = createTestHarness();

    act(() => {
      api.receiveLoopCallbacks.onProgress(500, 1000);
    });
    expect(api.receiveProgress).toEqual({ bytes: 500, total: 1000 });

    act(() => {
      api.receiveLoopCallbacks.onEnd();
    });
    expect(api.receiveProgress).toBeNull();
    unmount();
  });

  it("onEnd is idempotent when called multiple times", () => {
    const { api, unmount } = createTestHarness();

    act(() => {
      api.receiveLoopCallbacks.onProgress(500, 1000);
    });

    act(() => {
      api.receiveLoopCallbacks.onEnd();
    });
    expect(api.receiveProgress).toBeNull();

    act(() => {
      api.receiveLoopCallbacks.onEnd();
    });
    expect(api.receiveProgress).toBeNull();
    unmount();
  });

  it("onReceiveStart does not set receiveProgress directly", () => {
    const { api, unmount } = createTestHarness();

    act(() => {
      api.receiveLoopCallbacks.onReceiveStart({
        name: "incoming.bin",
        totalSize: 1000,
        handle: mockReceiveHandle(),
      });
    });

    // onReceiveStart only stores the handle in the ref, it doesn't
    // set progress. Progress stays null until onProgress fires.
    expect(api.receiveProgress).toBeNull();
    unmount();
  });

  it("full lifecycle: start → progress → end", () => {
    const { api, unmount } = createTestHarness();

    // Start
    act(() => {
      api.receiveLoopCallbacks.onReceiveStart({
        name: "photo.jpg",
        totalSize: 5000,
        handle: mockReceiveHandle(),
      });
    });
    expect(api.receiveProgress).toBeNull();

    // Progress updates
    act(() => {
      api.receiveLoopCallbacks.onProgress(1000, 5000);
    });
    expect(api.receiveProgress).toEqual({ bytes: 1000, total: 5000 });

    act(() => {
      api.receiveLoopCallbacks.onProgress(3000, 5000);
    });
    expect(api.receiveProgress).toEqual({ bytes: 3000, total: 5000 });

    // End
    act(() => {
      api.receiveLoopCallbacks.onEnd();
    });
    expect(api.receiveProgress).toBeNull();
    unmount();
  });
});

describe("useReceiveProgress — reset", () => {
  it("clears receiveProgress synchronously", () => {
    const { api, unmount } = createTestHarness();

    act(() => {
      api.receiveLoopCallbacks.onProgress(500, 1000);
    });
    expect(api.receiveProgress).toEqual({ bytes: 500, total: 1000 });

    act(() => {
      api.reset();
    });
    expect(api.receiveProgress).toBeNull();
    unmount();
  });

  it("cancels the in-flight receive handle", () => {
    const cancelFn = vi.fn();
    const handle = mockReceiveHandle({ cancel: cancelFn });
    const { api, unmount } = createTestHarness();

    act(() => {
      api.receiveLoopCallbacks.onReceiveStart({
        name: "incoming.bin",
        totalSize: 1000,
        handle,
      });
    });

    act(() => {
      api.reset();
    });

    expect(cancelFn).toHaveBeenCalledTimes(1);
    expect(api.receiveProgress).toBeNull();
    unmount();
  });

  it("is a no-op when no receive is in flight", () => {
    const { api, unmount } = createTestHarness();
    expect(() => api.reset()).not.toThrow();
    expect(api.receiveProgress).toBeNull();
    unmount();
  });

  it("calls reset multiple times safely", () => {
    const { api, unmount } = createTestHarness();
    expect(() => {
      api.reset();
      api.reset();
      api.reset();
    }).not.toThrow();
    unmount();
  });
});

describe("useReceiveProgress — memo stability", () => {
  it("receiveLoopCallbacks object is stable across re-renders", () => {
    const { api, unmount } = createTestHarness();
    const first = api.receiveLoopCallbacks;

    // Trigger a re-render by calling onProgress
    act(() => {
      api.receiveLoopCallbacks.onProgress(100, 500);
    });

    // The callbacks object should be the same reference
    expect(api.receiveLoopCallbacks).toBe(first);
    unmount();
  });

  it("individual callbacks are stable across re-renders", () => {
    const { api, unmount } = createTestHarness();
    const { onEnd, onProgress, onReceiveStart } = api.receiveLoopCallbacks;

    // Trigger multiple re-renders via state changes
    act(() => {
      api.receiveLoopCallbacks.onProgress(100, 500);
    });
    act(() => {
      api.receiveLoopCallbacks.onProgress(200, 500);
    });
    act(() => {
      api.receiveLoopCallbacks.onEnd();
    });

    expect(api.receiveLoopCallbacks.onEnd).toBe(onEnd);
    expect(api.receiveLoopCallbacks.onProgress).toBe(onProgress);
    expect(api.receiveLoopCallbacks.onReceiveStart).toBe(onReceiveStart);
    unmount();
  });
});
