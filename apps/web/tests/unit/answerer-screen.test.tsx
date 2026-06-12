import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnswererScreen } from "@/components/answerer-screen";
import { Inbox } from "@/lib/inbox";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockDecodeOffer = vi.fn();
const mockGenerateAnswer = vi.fn();
const mockWriteClipboard = vi.fn();
const mockReadClipboard = vi.fn();
const mockStartReceiveLoop = vi.fn();
const mockUseReceiveProgress = vi.fn();
const mockUseSendProgress = vi.fn();
const mockGetDeviceName = vi.fn();

vi.mock("@/components/answerer-screen/idle-view", () => ({
  AnswererIdleView: ({
    connectionStatus,
    error,
    onScan,
    onScannedTextChange,
    onUseCamera,
    scannedText,
  }: {
    connectionStatus: string;
    error: string;
    onScan: () => void;
    onScannedTextChange: (text: string) => void;
    onUseCamera: () => void;
    scannedText: string;
  }) => (
    <div data-testid="answerer-idle-state">
      <span data-testid="mock-connection-status">{connectionStatus}</span>
      <span data-testid="mock-error">{error}</span>
      <button data-testid="mock-scan" onClick={onScan} type="button">
        Scan
      </button>
      <textarea
        data-testid="mock-scan-area"
        onChange={(e) => onScannedTextChange(e.target.value)}
        value={scannedText}
      />
      <button data-testid="mock-use-camera" onClick={onUseCamera} type="button">
        Use camera
      </button>
    </div>
  ),
}));

vi.mock("@/components/answerer-screen/scanning-view", () => ({
  ScanningView: ({
    answerText,
    connectionStatus,
    error,
    onGenerate,
    peerName,
  }: {
    answerText: string;
    connectionStatus: string;
    error: string;
    onGenerate: () => void;
    peerName: string | undefined;
  }) => (
    <div data-testid="answerer-scanning-state">
      <span data-testid="mock-connection-status">{connectionStatus}</span>
      <span data-testid="mock-error">{error}</span>
      <span data-testid="mock-peer-name">{peerName ?? "(unknown)"}</span>
      <button data-testid="mock-generate" onClick={onGenerate} type="button">
        Generate
      </button>
      <span data-testid="mock-answer-text">{answerText}</span>
    </div>
  ),
}));

vi.mock("@/components/connected-view/connected-view", () => ({
  ConnectedView: (props: Record<string, unknown>) => (
    <div data-testid="connected-state">
      <span data-testid="mock-peer-name">
        {String(props.peerName ?? "(unknown)")}
      </span>
      <button
        data-testid="mock-close"
        onClick={props.handleClose as () => void}
        type="button"
      >
        Close
      </button>
    </div>
  ),
}));

vi.mock("@/lib/pairing", () => ({
  decodeOffer: (...args: unknown[]) => mockDecodeOffer(...args),
  generateAnswer: (...args: unknown[]) => mockGenerateAnswer(...args),
  writeClipboard: (...args: unknown[]) => mockWriteClipboard(...args),
  readClipboard: (...args: unknown[]) => mockReadClipboard(...args),
  PairingMachine: class {
    private _state: { kind: string; offerSdp?: string; peerName?: string } = {
      kind: "idle",
    };
    getState = vi.fn(() => this._state);
    startScanning = vi.fn(() => {
      this._state = { kind: "scanning" };
    });
    completeScan = vi.fn((peerName?: string) => {
      this._state = { kind: "connected", peerName };
    });
    failMalformedQr = vi.fn();
    failIce = vi.fn();
    close = vi.fn(() => {
      if (this._state.kind !== "idle" && this._state.kind !== "closing") {
        this._state = { kind: "closing" };
      }
    });
    reset = vi.fn(() => {
      this._state = { kind: "idle" };
    });
  },
}));

vi.mock("@/lib/webrtc", () => ({
  Session: class {
    start = vi.fn();
    onClose = vi.fn(() => vi.fn());
    close = vi.fn();
    notifyActivity = vi.fn();
    isClosed = vi.fn(() => false);
    getCloseReason = vi.fn(() => null);
    getRemainingIdleMs = vi.fn(() => 300_000);
  },
}));

vi.mock("@/lib/transfer", () => ({
  startReceiveLoop: (...args: unknown[]) => mockStartReceiveLoop(...args),
}));

vi.mock("@/components/use-receive-progress", () => ({
  useReceiveProgress: (...args: unknown[]) => mockUseReceiveProgress(...args),
}));

vi.mock("@/components/use-send-progress", () => ({
  useSendProgress: (...args: unknown[]) => mockUseSendProgress(...args),
}));

vi.mock("@/lib/device-name", () => ({
  getDeviceName: (...args: unknown[]) => mockGetDeviceName(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDefaultHooks() {
  mockUseReceiveProgress.mockReturnValue({
    handleCancelReceive: vi.fn(),
    receiveLoopCallbacks: {
      onEnd: vi.fn(),
      onProgress: vi.fn(),
      onReceiveStart: vi.fn(),
    },
    receiveProgress: null,
    reset: vi.fn(),
  });
  mockUseSendProgress.mockReturnValue({
    handleCancelSend: vi.fn(),
    progress: null,
    reset: vi.fn(),
    sendFile: vi.fn(),
  });
  mockStartReceiveLoop.mockReturnValue({ cancel: vi.fn() });
  mockGetDeviceName.mockReturnValue("Test Device");
}

/** Helper: simulate typing into the scanned-text textarea. */
function typeScanArea(container: HTMLElement, text: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  const textarea = container.querySelector(
    '[data-testid="mock-scan-area"]'
  ) as HTMLTextAreaElement;
  if (nativeSetter) {
    nativeSetter.call(textarea, text);
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultHooks();
});

afterEach(() => {
  vi.restoreAllMocks();
  // Clean up navigator stub set in describe blocks
  (navigator as Record<string, unknown>).mediaDevices = undefined;
});

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<AnswererScreen inbox={new Inbox()} />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnswererScreen — idle state", () => {
  it("renders the answerer idle view by default", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="answerer-idle-state"]')
    ).not.toBeNull();
    unmount();
  });
});

describe("AnswererScreen — handleScan", () => {
  it("transitions to scanning state after valid scan", () => {
    mockDecodeOffer.mockReturnValue({ sdp: "test-sdp", name: "Peer Device" });

    const { container, unmount } = render();

    typeScanArea(container, "offer-text");
    const scanBtn = container.querySelector(
      '[data-testid="mock-scan"]'
    ) as HTMLButtonElement;
    act(() => {
      scanBtn.click();
    });

    expect(mockDecodeOffer).toHaveBeenCalledWith("offer-text");
    expect(
      container.querySelector('[data-testid="answerer-scanning-state"]')
    ).not.toBeNull();
    unmount();
  });

  it('shows "QR not recognized" when decodeOffer throws', () => {
    mockDecodeOffer.mockImplementation(() => {
      throw new Error("bad payload");
    });

    const { container, unmount } = render();

    typeScanArea(container, "bad-offer");
    const scanBtn = container.querySelector(
      '[data-testid="mock-scan"]'
    ) as HTMLButtonElement;
    act(() => {
      scanBtn.click();
    });

    // Back in idle view with error visible
    expect(
      container.querySelector('[data-testid="answerer-idle-state"]')
    ).not.toBeNull();
    const errorEl = container.querySelector('[data-testid="mock-error"]');
    expect(errorEl?.textContent).toContain("QR not recognized");
    unmount();
  });
});

describe("AnswererScreen — handleGenerate", () => {
  it("transitions to connected after successful generation", async () => {
    mockDecodeOffer.mockReturnValue({ sdp: "test-sdp", name: "Peer Device" });
    const transport = { close: vi.fn(), onclose: vi.fn(() => vi.fn()) };
    mockGenerateAnswer.mockResolvedValue({
      answerText: "base64-answer",
      transport: Promise.resolve(transport),
    });

    const { container, unmount } = render();

    // Step 1: type and scan
    typeScanArea(container, "offer-text");
    const scanBtn = container.querySelector(
      '[data-testid="mock-scan"]'
    ) as HTMLButtonElement;
    act(() => {
      scanBtn.click();
    });

    expect(
      container.querySelector('[data-testid="answerer-scanning-state"]')
    ).not.toBeNull();

    // Step 2: generate answer
    const generateBtn = container.querySelector(
      '[data-testid="mock-generate"]'
    ) as HTMLButtonElement;
    await act(async () => {
      generateBtn.click();
      await Promise.resolve();
    });

    expect(mockGenerateAnswer).toHaveBeenCalled();
    expect(mockWriteClipboard).toHaveBeenCalledWith("base64-answer");
    unmount();
  });

  it("shows error when generateAnswer fails", async () => {
    mockDecodeOffer.mockReturnValue({ sdp: "test-sdp", name: "Peer Device" });
    mockGenerateAnswer.mockRejectedValue(new Error("ICE failed"));

    const { container, unmount } = render();

    typeScanArea(container, "offer-text");
    const scanBtn = container.querySelector(
      '[data-testid="mock-scan"]'
    ) as HTMLButtonElement;
    act(() => {
      scanBtn.click();
    });

    const generateBtn = container.querySelector(
      '[data-testid="mock-generate"]'
    ) as HTMLButtonElement;
    await act(async () => {
      generateBtn.click();
      await Promise.resolve();
    });

    const errorEl = container.querySelector('[data-testid="mock-error"]');
    expect(errorEl?.textContent).toContain("ICE failed");
    unmount();
  });
});

describe("AnswererScreen — connected state", () => {
  it("renders connected state after generation", async () => {
    mockDecodeOffer.mockReturnValue({ sdp: "test-sdp", name: "Peer Device" });
    const transport = { close: vi.fn(), onclose: vi.fn(() => vi.fn()) };
    mockGenerateAnswer.mockResolvedValue({
      answerText: "base64-answer",
      transport: Promise.resolve(transport),
    });

    const { container, unmount } = render();

    typeScanArea(container, "offer-text");
    const scanBtn = container.querySelector(
      '[data-testid="mock-scan"]'
    ) as HTMLButtonElement;
    act(() => {
      scanBtn.click();
    });

    const generateBtn = container.querySelector(
      '[data-testid="mock-generate"]'
    ) as HTMLButtonElement;
    await act(async () => {
      generateBtn.click();
      await Promise.resolve();
    });

    // After generate, the transport resolves and should transition to connected
    expect(
      container.querySelector('[data-testid="connected-state"]')
    ).not.toBeNull();
    unmount();
  });
});

describe("AnswererScreen — handleUseCamera", () => {
  beforeEach(() => {
    // Stub navigator.mediaDevices.getUserMedia
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  it("requests camera permission when Use camera is clicked", async () => {
    const { container, unmount } = render();

    const cameraBtn = container.querySelector(
      '[data-testid="mock-use-camera"]'
    ) as HTMLButtonElement;
    await act(async () => {
      cameraBtn.click();
      await Promise.resolve();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
    });
    unmount();
  });

  it("shows error when camera access is denied", async () => {
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<
      typeof vi.fn
    >;
    getUserMedia.mockRejectedValue(new Error("Permission denied"));

    const { container, unmount } = render();

    const cameraBtn = container.querySelector(
      '[data-testid="mock-use-camera"]'
    ) as HTMLButtonElement;
    await act(async () => {
      cameraBtn.click();
      await Promise.resolve();
    });

    // The error is set via setError — check the mock component's error span
    // in idle state (error persists on the same view)
    const errorEl = container.querySelector('[data-testid="mock-error"]');
    expect(errorEl?.textContent).toContain("Camera access was denied");
    unmount();
  });
});
