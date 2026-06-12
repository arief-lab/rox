// SPDX-License-Identifier: AGPL-3.0-or-later
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ScanningView } from "@/components/answerer-screen/scanning-view";
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
  answerText?: string;
  connectionStatus?: ConnectionStatusKind;
  error?: string;
  onGenerate?: () => void;
  peerName?: string | undefined;
}

function render(props: RenderProps = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ScanningView
        answerText={props.answerText ?? ""}
        connectionStatus={props.connectionStatus ?? "disconnected"}
        error={props.error ?? ""}
        onGenerate={props.onGenerate ?? NOOP}
        peerName={props.peerName}
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

describe("ScanningView", () => {
  it("renders the scanning view container", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="answerer-scanning-state"]')
    ).not.toBeNull();
    unmount();
  });

  it('renders "Generate answer" heading', () => {
    const { container, unmount } = render();
    expect(container.textContent).toContain("Generate answer");
    unmount();
  });

  it("renders ConnectionStatus with the given status", () => {
    const { container, unmount } = render({
      connectionStatus: "connected",
    });
    const status = container.querySelector('[data-testid="connection-status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("data-status")).toBe("connected");
    unmount();
  });

  it("shows the peer name", () => {
    const { container, unmount } = render({ peerName: "Alice's iPhone" });
    expect(container.textContent).toContain("Alice's iPhone");
    unmount();
  });

  it('shows "(unknown)" when peerName is undefined', () => {
    const { container, unmount } = render({ peerName: undefined });
    expect(container.textContent).toContain("(unknown)");
    unmount();
  });

  it("renders the Generate answer button", () => {
    const { container, unmount } = render();
    const btn = container.querySelector(
      '[data-testid="generate-answer"]'
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Generate answer & copy");
    unmount();
  });

  it("calls onGenerate when the button is clicked", () => {
    const onGenerate = vi.fn();
    const { container, unmount } = render({ onGenerate });

    const btn = container.querySelector(
      '[data-testid="generate-answer"]'
    ) as HTMLButtonElement;
    btn.click();

    expect(onGenerate).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("shows answer text when answerText is non-empty", () => {
    const { container, unmount } = render({ answerText: "base64-answer..." });
    const answerEl = container.querySelector('[data-testid="answer-text"]');
    expect(answerEl).not.toBeNull();
    expect(answerEl?.textContent).toContain("base64-answer...");
    unmount();
  });

  it("does not show answer text when answerText is empty", () => {
    const { container, unmount } = render({ answerText: "" });
    expect(container.querySelector('[data-testid="answer-text"]')).toBeNull();
    unmount();
  });

  it("shows error text when error is non-empty", () => {
    const { container, unmount } = render({
      error: "Failed to generate answer",
    });
    const errorText = container.querySelector(
      '[data-testid="error-text"]'
    ) as HTMLElement;
    expect(errorText).not.toBeNull();
    expect(errorText.textContent).toContain("Failed to generate answer");
    unmount();
  });

  it("does not show error text when error is empty", () => {
    const { container, unmount } = render({ error: "" });
    expect(container.querySelector('[data-testid="error-text"]')).toBeNull();
    unmount();
  });
});
