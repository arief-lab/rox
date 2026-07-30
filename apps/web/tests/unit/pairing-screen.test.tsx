// SPDX-License-Identifier: AGPL-3.0-or-later
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PairingScreen } from "@/components/pairing-screen";
import { Inbox } from "@/lib/inbox";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockCreateOffer = vi.fn();
const mockEncodeOffer = vi.fn();
const mockParseAnswer = vi.fn();
const mockReadClipboard = vi.fn();
const mockStartReceiveLoop = vi.fn();
const mockUseReceiveProgress = vi.fn();
const mockUseSendProgress = vi.fn();
const mockGetDeviceName = vi.fn();
const mockQRCodeToCanvas = vi.fn();

vi.mock("@/lib/webrtc", () => ({
  createOffer: (...args: unknown[]) => mockCreateOffer(...args),
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

vi.mock("@/lib/pairing", () => ({
  encodeOffer: (...args: unknown[]) => mockEncodeOffer(...args),
  parseAnswer: (...args: unknown[]) => mockParseAnswer(...args),
  readClipboard: (...args: unknown[]) => mockReadClipboard(...args),
  PairingMachine: class {
    private _state: { kind: string; offerSdp?: string; peerName?: string } = {
      kind: "idle",
    };
    getState = vi.fn(() => this._state);
    startOffering = vi.fn((offerSdp: string) => {
      this._state = { kind: "offering", offerSdp };
    });
    pasteAnswer = vi.fn(() => {
      if (this._state.kind === "offering" && "offerSdp" in this._state) {
        this._state = {
          kind: "pasting",
          offerSdp: this._state.offerSdp ?? "",
        };
      }
    });
    completePaste = vi.fn((peerName?: string) => {
      this._state = { kind: "connected", peerName };
    });
    failInvalidPaste = vi.fn();
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

vi.mock("qrcode", () => ({
  default: { toCanvas: (...args: unknown[]) => mockQRCodeToCanvas(...args) },
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
  mockCreateOffer.mockResolvedValue({
    offerSdp: "test-offer-sdp",
    accept: vi
      .fn()
      .mockResolvedValue({ close: vi.fn(), onclose: vi.fn(() => vi.fn()) }),
  });
  mockStartReceiveLoop.mockReturnValue({ cancel: vi.fn() });
  mockGetDeviceName.mockReturnValue("Test Device");
  mockEncodeOffer.mockReturnValue("encoded-offer");
  mockQRCodeToCanvas.mockResolvedValue(undefined);
}

/** Wait for the auto-start offering phase to settle. */
async function waitForOffering(): Promise<void> {
  // The component auto-starts on mount; flush the async offer creation.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * Use the clipboard-read flow to populate the paste area text.
 * This goes through handleReadClipboard -> setPastedText, which
 * works reliably with act() because it's an async handler.
 */
async function populatePastedTextViaClipboard(
  container: HTMLElement,
  text: string
): Promise<void> {
  mockReadClipboard.mockResolvedValue(text);
  const clipboardBtn = container.querySelector(
    '[data-testid="read-clipboard"]'
  ) as HTMLButtonElement;
  await act(async () => {
    clipboardBtn.click();
    await Promise.resolve();
  });
}

/**
 * Click the paste-answer button (assumes pastedText is already set).
 * Returns after the async handler settles.
 */
async function clickConnectPaste(container: HTMLElement): Promise<void> {
  const connectBtn = container.querySelector(
    '[data-testid="paste-answer"]'
  ) as HTMLButtonElement;
  await act(async () => {
    connectBtn.click();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultHooks();
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.restoreAllMocks();
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = undefined;
});

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<PairingScreen inbox={new Inbox()} onConnectOther={vi.fn()} />);
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

describe("PairingScreen — idle state", () => {
  it("renders the idle view by default", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="idle-state"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Ready to connect");
    unmount();
  });

  it("renders a show-qr-code button", () => {
    const { container, unmount } = render();
    const startBtn = container.querySelector(
      '[data-testid="start-receiving"]'
    ) as HTMLButtonElement;
    expect(startBtn).not.toBeNull();
    expect(startBtn.textContent).toBe("Show QR code");
    unmount();
  });
});

describe("PairingScreen — handleStart", () => {
  it("transitions to offering state after clicking start", async () => {
    const { container, unmount } = render();

    await waitForOffering();

    expect(mockCreateOffer).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="offering-state"]')
    ).not.toBeNull();
    unmount();
  });

  it("shows error when createOffer fails", async () => {
    mockCreateOffer.mockRejectedValue(new Error("WebRTC not available"));

    const { container, unmount } = render();
    await waitForOffering();

    const errorText = container.querySelector(
      '[data-testid="error-text"]'
    ) as HTMLElement;
    expect(errorText).not.toBeNull();
    expect(errorText.textContent).toContain("WebRTC not available");
    unmount();
  });
});

describe("PairingScreen — clipboard", () => {
  it("reads from clipboard and fills the paste area", async () => {
    const { container, unmount } = render();
    await waitForOffering();
    await populatePastedTextViaClipboard(container, "pasted-answer-text");

    expect(mockReadClipboard).toHaveBeenCalledTimes(1);
    const pasteArea = container.querySelector(
      '[data-testid="paste-area"]'
    ) as HTMLTextAreaElement;
    expect(pasteArea).not.toBeNull();
    expect(pasteArea.value).toBe("pasted-answer-text");
    unmount();
  });

  it("shows error when clipboard read fails", async () => {
    mockReadClipboard.mockRejectedValue(new Error("Clipboard access denied"));

    const { container, unmount } = render();
    await waitForOffering();

    const clipboardBtn = container.querySelector(
      '[data-testid="read-clipboard"]'
    ) as HTMLButtonElement;
    await act(async () => {
      clipboardBtn.click();
      await Promise.resolve();
    });

    const errorText = container.querySelector(
      '[data-testid="error-text"]'
    ) as HTMLElement;
    expect(errorText).not.toBeNull();
    expect(errorText.textContent).toContain("Clipboard access denied");
    unmount();
  });
});

describe("PairingScreen — paste-answer button", () => {
  it("is disabled when pastedText is empty", async () => {
    const { container, unmount } = render();
    await waitForOffering();

    const connectBtn = container.querySelector(
      '[data-testid="paste-answer"]'
    ) as HTMLButtonElement;
    expect(connectBtn.disabled).toBe(true);
    unmount();
  });

  it("is enabled after clipboard read populates pastedText", async () => {
    const { container, unmount } = render();
    await waitForOffering();
    await populatePastedTextViaClipboard(container, "some-answer");

    const connectBtn = container.querySelector(
      '[data-testid="paste-answer"]'
    ) as HTMLButtonElement;
    expect(connectBtn.disabled).toBe(false);
    unmount();
  });
});

describe("PairingScreen — handlePaste", () => {
  it("parses answer and transitions to connected state", async () => {
    const acceptFn = vi.fn().mockResolvedValue({
      close: vi.fn(),
      onclose: vi.fn(() => vi.fn()),
    });
    mockCreateOffer.mockResolvedValue({
      offerSdp: "test-offer-sdp",
      accept: acceptFn,
    });
    mockParseAnswer.mockReturnValue({ sdp: "answer-sdp", name: "Peer Phone" });

    const { container, unmount } = render();
    await waitForOffering();
    await populatePastedTextViaClipboard(container, "some-answer-text");
    await clickConnectPaste(container);

    expect(mockParseAnswer).toHaveBeenCalledWith("some-answer-text");
    expect(acceptFn).toHaveBeenCalledWith("answer-sdp");
    unmount();
  });

  it('shows "not a valid answer" when parseAnswer throws', async () => {
    mockParseAnswer.mockImplementation(() => {
      throw new Error("bad sdp");
    });

    const { container, unmount } = render();
    await waitForOffering();
    await populatePastedTextViaClipboard(container, "bad-answer");
    await clickConnectPaste(container);

    const errorText = container.querySelector(
      '[data-testid="error-text"]'
    ) as HTMLElement;
    expect(errorText).not.toBeNull();
    expect(errorText.textContent).toContain("not a valid answer");
    unmount();
  });

  it("shows error when accept fails", async () => {
    const acceptFn = vi
      .fn()
      .mockRejectedValue(new Error("ICE connection failed"));
    mockCreateOffer.mockResolvedValue({
      offerSdp: "test-offer-sdp",
      accept: acceptFn,
    });
    mockParseAnswer.mockReturnValue({ sdp: "answer-sdp", name: "Peer Phone" });

    const { container, unmount } = render();
    await waitForOffering();
    await populatePastedTextViaClipboard(container, "some-answer-text");
    await clickConnectPaste(container);

    const errorText = container.querySelector(
      '[data-testid="error-text"]'
    ) as HTMLElement;
    expect(errorText).not.toBeNull();
    expect(errorText.textContent).toContain("ICE connection failed");
    unmount();
  });
});

describe("PairingScreen — QR rendering", () => {
  it("generates QR code when offerSdp is set", async () => {
    const { container, unmount } = render();
    await waitForOffering();

    expect(mockEncodeOffer).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="qr-canvas"]')).not.toBeNull();
    unmount();
  });
});

describe("PairingScreen — offerSdp window exposure", () => {
  it("exposes offerSdp and device name on window", async () => {
    mockGetDeviceName.mockReturnValue("My Laptop");

    const { unmount } = render();
    await waitForOffering();

    const w = window as unknown as {
      __offerSdp?: string;
      __offerName?: string;
    };
    expect(w.__offerSdp).toBe("test-offer-sdp");
    expect(w.__offerName).toBe("My Laptop");
    unmount();
  });
});

describe("PairingScreen — connection status", () => {
  it("renders ConnectionStatus in idle view", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="connection-status"]')
    ).not.toBeNull();
    unmount();
  });

  it("renders ConnectionStatus in offering view", async () => {
    const { container, unmount } = render();
    await waitForOffering();
    expect(
      container.querySelector('[data-testid="connection-status"]')
    ).not.toBeNull();
    unmount();
  });
});

describe("PairingScreen — full flow", () => {
  it("completes: idle -> offering -> connected", async () => {
    const acceptFn = vi.fn().mockResolvedValue({
      close: vi.fn(),
      onclose: vi.fn(() => vi.fn()),
    });
    mockCreateOffer.mockResolvedValue({
      offerSdp: "test-offer-sdp",
      accept: acceptFn,
    });
    mockParseAnswer.mockReturnValue({ sdp: "answer-sdp", name: "Peer Phone" });

    const { container, unmount } = render();

    expect(
      container.querySelector('[data-testid="idle-state"]')
    ).not.toBeNull();

    await waitForOffering();
    expect(
      container.querySelector('[data-testid="offering-state"]')
    ).not.toBeNull();

    await populatePastedTextViaClipboard(container, "answer-text");
    await clickConnectPaste(container);

    expect(mockParseAnswer).toHaveBeenCalledWith("answer-text");
    expect(acceptFn).toHaveBeenCalledWith("answer-sdp");
    unmount();
  });
});
