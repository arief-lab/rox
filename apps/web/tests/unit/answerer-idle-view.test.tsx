// SPDX-License-Identifier: AGPL-3.0-or-later
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { AnswererIdleView } from "@/components/answerer-screen/idle-view";
import type { ConnectionStatusKind } from "@/components/connection-status";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/connection-status", () => ({
  ConnectionStatus: ({ status }: { status: string }) => (
    <div data-status={status} data-testid="connection-status" />
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOOP = vi.fn();

interface RenderProps {
  connectionStatus?: ConnectionStatusKind;
  error?: string;
  onBack?: () => void;
  onScan?: () => void;
  onScannedTextChange?: (text: string) => void;
  onUseCamera?: () => void;
  scannedText?: string;
}

function render(props: RenderProps = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <AnswererIdleView
        connectionStatus={props.connectionStatus ?? "disconnected"}
        error={props.error ?? ""}
        onBack={props.onBack ?? NOOP}
        onScan={props.onScan ?? NOOP}
        onScannedTextChange={props.onScannedTextChange ?? NOOP}
        onUseCamera={props.onUseCamera ?? NOOP}
        scannedText={props.scannedText ?? ""}
      />
    );
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

describe("AnswererIdleView", () => {
  it("renders the idle view container", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="answerer-idle-state"]')
    ).not.toBeNull();
    unmount();
  });

  it('renders "Send a file" heading', () => {
    const { container, unmount } = render();
    expect(container.textContent).toContain("Send a file");
    unmount();
  });

  it("renders ConnectionStatus with the given status", () => {
    const { container, unmount } = render({
      connectionStatus: "connecting",
    });
    const status = container.querySelector('[data-testid="connection-status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("data-status")).toBe("connecting");
    unmount();
  });

  it("renders the Use camera button", () => {
    const { container, unmount } = render();
    const cameraBtn = container.querySelector(
      '[data-testid="use-camera"]'
    ) as HTMLButtonElement;
    expect(cameraBtn).not.toBeNull();
    expect(cameraBtn.textContent).toBe("Use camera");
    unmount();
  });

  it("calls onUseCamera when the camera button is clicked", () => {
    const onUseCamera = vi.fn();
    const { container, unmount } = render({ onUseCamera });

    const cameraBtn = container.querySelector(
      '[data-testid="use-camera"]'
    ) as HTMLButtonElement;
    cameraBtn.click();

    expect(onUseCamera).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("renders the scan textarea", () => {
    const { container, unmount } = render();
    const textarea = container.querySelector(
      '[data-testid="scan-area"]'
    ) as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.placeholder).toContain("Paste offer text here");
    unmount();
  });

  it("calls onScannedTextChange when textarea value changes", () => {
    const onScannedTextChange = vi.fn();
    const { container, unmount } = render({ onScannedTextChange });

    const textarea = container.querySelector(
      '[data-testid="scan-area"]'
    ) as HTMLTextAreaElement;
    // React 19 in jsdom doesn't reliably trigger onChange from
    // synthetic input events on controlled components. Use the
    // native value setter so React's event system picks up the
    // change correctly.
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    nativeSetter?.call(textarea, "scanned-text");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onScannedTextChange).toHaveBeenCalledWith("scanned-text");
    unmount();
  });

  it("renders the Scan button", () => {
    const { container, unmount } = render();
    const scanBtn = container.querySelector(
      '[data-testid="scan-qr"]'
    ) as HTMLButtonElement;
    expect(scanBtn).not.toBeNull();
    expect(scanBtn.textContent).toBe("Scan");
    unmount();
  });

  it("disables the Scan button when scannedText is empty", () => {
    const { container, unmount } = render({ scannedText: "" });
    const scanBtn = container.querySelector(
      '[data-testid="scan-qr"]'
    ) as HTMLButtonElement;
    expect(scanBtn.disabled).toBe(true);
    unmount();
  });

  it("enables the Scan button when scannedText is non-empty", () => {
    const { container, unmount } = render({ scannedText: "some-text" });
    const scanBtn = container.querySelector(
      '[data-testid="scan-qr"]'
    ) as HTMLButtonElement;
    expect(scanBtn.disabled).toBe(false);
    unmount();
  });

  it("calls onScan when the Scan button is clicked", () => {
    const onScan = vi.fn();
    const { container, unmount } = render({
      onScan,
      scannedText: "some-text",
    });

    const scanBtn = container.querySelector(
      '[data-testid="scan-qr"]'
    ) as HTMLButtonElement;
    scanBtn.click();

    expect(onScan).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("shows error text when error is non-empty", () => {
    const { container, unmount } = render({ error: "QR not recognized" });
    const errorText = container.querySelector(
      '[data-testid="error-text"]'
    ) as HTMLElement;
    expect(errorText).not.toBeNull();
    expect(errorText.textContent).toContain("QR not recognized");
    unmount();
  });

  it("does not show error text when error is empty", () => {
    const { container, unmount } = render({ error: "" });
    expect(container.querySelector('[data-testid="error-text"]')).toBeNull();
    unmount();
  });

  it("passes scannedText as the textarea value", () => {
    const { container, unmount } = render({ scannedText: "hello-offer" });
    const textarea = container.querySelector(
      '[data-testid="scan-area"]'
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("hello-offer");
    unmount();
  });
});
