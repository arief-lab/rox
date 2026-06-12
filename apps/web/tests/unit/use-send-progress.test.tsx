// SPDX-License-Identifier: AGPL-3.0-or-later
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSendProgress } from "@/components/use-send-progress";
import type { SendHandle } from "@/lib/transfer";
import type { Transport } from "@/lib/webrtc";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSend = vi.fn();

vi.mock("@/lib/transfer", () => ({
  send: (...args: unknown[]) => mockSend(...args),
}));

/**
 * Create a mock SendHandle with configurable promise and machine state.
 */
function mockHandle(overrides: {
  promise?: Promise<void>;
  getStateKind?: string;
  cancel?: () => void;
}): SendHandle {
  return {
    fileId: "mock-file-id",
    promise: overrides.promise ?? Promise.resolve(),
    cancel: overrides.cancel ?? vi.fn(),
    getState: () =>
      ({ kind: overrides.getStateKind ?? "completed" }) as ReturnType<
        SendHandle["getState"]
      >,
  };
}

const NOOP_TRANSPORT = {} as Transport;

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

/**
 * Wrapper component that exposes the hook's return values via a getter
 * object stored on the container element.  The test harness pattern
 * mirrors how other unit tests in this project interact with React
 * hooks (act + createRoot).
 */
interface HookAPI {
  handleCancelSend: () => void;
  progress: { bytes: number; total: number } | null;
  reset: () => void;
  sendFile: ReturnType<typeof useSendProgress>["sendFile"];
}

function createTestHarness() {
  const api: HookAPI = {} as HookAPI;
  const outcomes: Array<{ kind: string; message?: string }> = [];

  function Harness() {
    const { handleCancelSend, progress, reset, sendFile } = useSendProgress();
    api.handleCancelSend = handleCancelSend;
    api.progress = progress;
    api.reset = reset;
    api.sendFile = sendFile;

    return (
      <div>
        <button
          data-testid="btn-send"
          onClick={() => {
            sendFile({
              file: new File(["hello"], "test.txt"),
              transport: NOOP_TRANSPORT,
              onComplete: (outcome) => {
                outcomes.push(outcome);
              },
            });
          }}
          type="button"
        >
          Send
        </button>
        <button
          data-testid="btn-cancel"
          onClick={handleCancelSend}
          type="button"
        >
          Cancel
        </button>
        <button data-testid="btn-reset" onClick={reset} type="button">
          Reset
        </button>
        <span data-testid="progress-value">
          {progress === null ? "null" : `${progress.bytes}/${progress.total}`}
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
    outcomes,
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

describe("useSendProgress — initial state", () => {
  it("starts with null progress", () => {
    const { api, unmount } = createTestHarness();
    expect(api.progress).toBeNull();
    unmount();
  });

  it("exposes handleCancelSend, reset, and sendFile functions", () => {
    const { api, unmount } = createTestHarness();
    expect(typeof api.handleCancelSend).toBe("function");
    expect(typeof api.reset).toBe("function");
    expect(typeof api.sendFile).toBe("function");
    unmount();
  });
});

describe("useSendProgress — sendFile happy path", () => {
  it("calls send() with the file, transport, and onProgress", async () => {
    const handle = mockHandle({});
    mockSend.mockReturnValue(handle);

    const { api, unmount } = createTestHarness();

    await act(async () => {
      api.sendFile({
        file: new File(["hello world"], "doc.txt"),
        transport: NOOP_TRANSPORT,
      });
      await Promise.resolve();
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const [sentFile, sentTransport, sentOptions] = mockSend.mock.calls[0];
    expect(sentFile.name).toBe("doc.txt");
    expect(sentTransport).toBe(NOOP_TRANSPORT);
    expect(typeof sentOptions.onProgress).toBe("function");
    unmount();
  });

  it("sets progress to { bytes: 0, total: file.size } when send starts", () => {
    // Use a never-resolving promise so the send stays in flight
    // and progress isn't cleared by the finally block.
    const handle = mockHandle({
      promise: new Promise<void>(() => undefined),
    });
    mockSend.mockReturnValue(handle);

    const { api, unmount } = createTestHarness();

    act(() => {
      api.sendFile({
        file: new File(["x".repeat(500)], "file.bin"),
        transport: NOOP_TRANSPORT,
      });
    });

    // The hook calls setProgress({ bytes: 0, total: file.size })
    // synchronously before awaiting handle.promise, so the state
    // update is flushed by act() and visible here.
    expect(api.progress).toEqual({ bytes: 0, total: 500 });
    unmount();
  });

  it("calls onComplete with { kind: 'sent' } on success", async () => {
    const handle = mockHandle({ promise: Promise.resolve() });
    mockSend.mockReturnValue(handle);

    const { api, outcomes, unmount } = createTestHarness();

    await act(async () => {
      api.sendFile({
        file: new File(["ok"], "ok.txt"),
        transport: NOOP_TRANSPORT,
        onComplete: (outcome) => {
          outcomes.push(outcome);
        },
      });
      await handle.promise;
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toEqual({ kind: "sent" });
    unmount();
  });

  it("clears progress in finally block after send resolves", async () => {
    const resolvePromise = Promise.resolve();
    const handle = mockHandle({ promise: resolvePromise });
    mockSend.mockReturnValue(handle);

    const { api, unmount } = createTestHarness();

    await act(async () => {
      api.sendFile({
        file: new File(["data"], "data.bin"),
        transport: NOOP_TRANSPORT,
      });
      await resolvePromise;
    });

    // After the finally block runs, progress should be null.
    expect(api.progress).toBeNull();
    unmount();
  });
});

describe("useSendProgress — sendFile onProgress", () => {
  it("updates progress via the onProgress callback", async () => {
    // Create the send promise FIRST so we can pass it into the mock
    // handle constructor (avoiding a readonly reassignment later).
    let resolveSend: () => void = () => undefined;
    const sendPromise = new Promise<void>((resolve) => {
      resolveSend = resolve;
    });

    let capturedOnProgress: ((bytes: number, total: number) => void) | null =
      null;
    const handle = mockHandle({ promise: sendPromise });

    // Use mockImplementation (not mockReturnValue) so we can capture
    // the onProgress callback passed by the hook.
    mockSend.mockImplementation(
      (
        _blob: Blob,
        _transport: Transport,
        options: { onProgress?: (bytes: number, total: number) => void }
      ) => {
        capturedOnProgress = options.onProgress ?? null;
        return handle;
      }
    );

    const { api, unmount } = createTestHarness();

    act(() => {
      api.sendFile({
        file: new File(["x".repeat(100)], "progress.bin"),
        transport: NOOP_TRANSPORT,
      });
    });

    // Verify onProgress was captured
    expect(capturedOnProgress).not.toBeNull();

    // Fire onProgress with partial progress
    const onProgress = capturedOnProgress as unknown as (
      bytes: number,
      total: number
    ) => void;
    act(() => {
      onProgress(50, 100);
    });
    expect(api.progress).toEqual({ bytes: 50, total: 100 });

    // Fire onProgress with completion
    act(() => {
      onProgress(100, 100);
    });
    expect(api.progress).toEqual({ bytes: 100, total: 100 });

    // Resolve the send, verify cleanup
    await act(async () => {
      resolveSend();
      await sendPromise;
    });
    expect(api.progress).toBeNull();

    unmount();
  });
});

describe("useSendProgress — cancelled vs failed discrimination", () => {
  it("calls onComplete with { kind: 'cancelled' } when machine is cancelled", async () => {
    const rejectPromise = Promise.reject(new Error("Transfer cancelled"));
    const handle = mockHandle({
      promise: rejectPromise,
      getStateKind: "cancelled",
    });
    mockSend.mockReturnValue(handle);

    const { api, outcomes, unmount } = createTestHarness();

    await act(async () => {
      api.sendFile({
        file: new File(["x"], "cancel.txt"),
        transport: NOOP_TRANSPORT,
        onComplete: (outcome) => {
          outcomes.push(outcome);
        },
      });
      // Catch the rejection so it doesn't cause an unhandled rejection
      await rejectPromise.catch(() => undefined);
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].kind).toBe("cancelled");
    expect(outcomes[0].message).toBe("Transfer cancelled");
    unmount();
  });

  it("calls onComplete with { kind: 'failed' } when machine is still sending", async () => {
    const rejectPromise = Promise.reject(new Error("transport closed"));
    const handle = mockHandle({
      promise: rejectPromise,
      getStateKind: "sending",
    });
    mockSend.mockReturnValue(handle);

    const { api, outcomes, unmount } = createTestHarness();

    await act(async () => {
      api.sendFile({
        file: new File(["x"], "fail.txt"),
        transport: NOOP_TRANSPORT,
        onComplete: (outcome) => {
          outcomes.push(outcome);
        },
      });
      await rejectPromise.catch(() => undefined);
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].kind).toBe("failed");
    expect(outcomes[0].message).toBe("transport closed");
    unmount();
  });

  it("clears progress even when the send rejects", async () => {
    const rejectPromise = Promise.reject(new Error("any error"));
    const handle = mockHandle({
      promise: rejectPromise,
      getStateKind: "failed",
    });
    mockSend.mockReturnValue(handle);

    const { api, unmount } = createTestHarness();

    await act(async () => {
      api.sendFile({
        file: new File(["x"], "fail.txt"),
        transport: NOOP_TRANSPORT,
      });
      await rejectPromise.catch(() => undefined);
    });

    expect(api.progress).toBeNull();
    unmount();
  });

  it("uses the error message from the rejection", async () => {
    const rejectPromise = Promise.reject(new Error("ICE connection dropped"));
    const handle = mockHandle({
      promise: rejectPromise,
      getStateKind: "failed",
    });
    mockSend.mockReturnValue(handle);

    const { api, outcomes, unmount } = createTestHarness();

    await act(async () => {
      api.sendFile({
        file: new File(["x"], "ice.txt"),
        transport: NOOP_TRANSPORT,
        onComplete: (outcome) => {
          outcomes.push(outcome);
        },
      });
      await rejectPromise.catch(() => undefined);
    });

    expect(outcomes[0].message).toBe("ICE connection dropped");
    unmount();
  });
});

describe("useSendProgress — handleCancelSend", () => {
  it("calls cancel on the in-flight send handle", () => {
    const cancelFn = vi.fn();
    const rejectPromise = new Promise<void>(() => undefined); // never resolves
    const handle = mockHandle({
      promise: rejectPromise,
      cancel: cancelFn,
    });
    mockSend.mockReturnValue(handle);

    const { api, unmount } = createTestHarness();

    act(() => {
      api.sendFile({
        file: new File(["x"], "cancel.txt"),
        transport: NOOP_TRANSPORT,
      });
    });

    act(() => {
      api.handleCancelSend();
    });

    expect(cancelFn).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("is a no-op when no send is in flight", () => {
    const { api, unmount } = createTestHarness();
    expect(() => api.handleCancelSend()).not.toThrow();
    unmount();
  });
});

describe("useSendProgress — reset", () => {
  it("cancels the in-flight send and clears progress synchronously", () => {
    const cancelFn = vi.fn();
    const rejectPromise = new Promise<void>(() => undefined); // never resolves
    const handle = mockHandle({
      promise: rejectPromise,
      cancel: cancelFn,
    });
    mockSend.mockReturnValue(handle);

    const { api, unmount } = createTestHarness();

    act(() => {
      api.sendFile({
        file: new File(["reset data"], "reset.txt"),
        transport: NOOP_TRANSPORT,
      });
    });

    expect(api.progress).toEqual({ bytes: 0, total: 10 });

    act(() => {
      api.reset();
    });

    expect(cancelFn).toHaveBeenCalledTimes(1);
    expect(api.progress).toBeNull();
    unmount();
  });

  it("is a no-op when no send is in flight", () => {
    const { api, unmount } = createTestHarness();
    expect(() => api.reset()).not.toThrow();
    expect(api.progress).toBeNull();
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
