// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { TransferProgress } from "@/components/transfer-progress";

interface RenderProps {
  direction?: "send" | "receive";
  onCancel: () => void;
  progress: { bytes: number; total: number };
}

interface RenderHandle {
  container: HTMLDivElement;
  unmount: () => void;
}

/**
 * Lightweight render helper. The component is pure, so vanilla
 * DOM rendering + `button.click()` is sufficient. See
 * transfer-progress.test.tsx for the full rationale on why we
 * skip @testing-library/react.
 */
function render(props: RenderProps): RenderHandle {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<TransferProgress {...props} />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

/**
 * Slice 9 — the receive-side TransferProgress.
 *
 * These tests pin the symmetric-UI contract for the receive side:
 * the same TransferProgress component renders for both send and
 * receive, but with direction-aware testids / aria-label so e2e
 * selectors can target them independently and screen readers
 * announce the right verb.
 *
 * The actual wiring of `onCancel` to `ReceiveHandle.cancel()` is
 * covered by the slice 9 integration test in
 * receive-cancel.test.ts (the receiver-cancel protocol test added
 * in commit a2d9cea). This test just locks in the component's
 * direction-aware rendering contract.
 */
describe("TransferProgress (receive direction)", () => {
  it("uses the receive-prefixed testids and aria-label", () => {
    const onCancel = vi.fn();
    const { container, unmount } = render({
      direction: "receive",
      onCancel,
      progress: { bytes: 250, total: 1000 },
    });

    // The container div wraps everything.
    expect(
      container.querySelector('[data-testid="receive-progress"]')
    ).not.toBeNull();
    // The progress bar uses the receive-prefixed testid AND
    // announces "receive progress" (not "send progress") so
    // screen-reader users hear the right verb.
    const bar = container.querySelector('[data-testid="receive-progress-bar"]');
    expect(bar?.getAttribute("aria-label")).toBe("receive progress");
    expect(bar?.getAttribute("aria-valuenow")).toBe("25");

    unmount();
  });

  it("calls onCancel exactly once when the receive-cancel button is clicked", () => {
    // The parent's handleCancelReceive should bind to
    // ReceiveHandle.cancel() — this test is the unit-level
    // guarantee that the wiring INSIDE the component is correct
    // for the receive side. The parent wiring is covered by the
    // integration test in receive-cancel.test.ts.
    const onCancel = vi.fn();
    const { container, unmount } = render({
      direction: "receive",
      onCancel,
      progress: { bytes: 500, total: 1000 },
    });

    const button = container.querySelector(
      '[data-testid="receive-cancel"]'
    ) as HTMLButtonElement;
    button.click();

    expect(onCancel).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("defaults to the send direction when no direction prop is given", () => {
    // Pin the default so the slice 7 test (which omits the prop)
    // continues to use the send-prefixed testids. This is the
    // backward-compat guarantee for the new direction prop.
    const onCancel = vi.fn();
    const { container, unmount } = render({
      onCancel,
      progress: { bytes: 0, total: 1000 },
    });

    expect(
      container.querySelector('[data-testid="send-progress"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="receive-progress"]')
    ).toBeNull();

    unmount();
  });
});
