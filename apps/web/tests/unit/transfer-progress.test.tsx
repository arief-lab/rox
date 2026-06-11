import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { TransferProgress } from "@/components/transfer-progress";

interface RenderProps {
  onCancel: () => void;
  progress: { bytesSent: number; total: number };
}

interface RenderHandle {
  container: HTMLDivElement;
  unmount: () => void;
}

/**
 * Lightweight render helper. We don't use @testing-library/react
 * (not installed; only jsdom + react-dom are in scope for unit
 * tests of a presentational component). The component is pure
 * (no state, no effects, no refs), so vanilla DOM rendering +
 * `button.click()` is sufficient to exercise the three
 * behaviours the slice 7 spec cares about.
 *
 * `flushSync` is required because `createRoot().render()` is
 * asynchronous in React 18+ — the DOM isn't updated until the
 * next microtask. Without flushSync, the first
 * `container.querySelector(...)` call returns null and every
 * assertion blows up with "Cannot read properties of null".
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

describe("TransferProgress", () => {
  it("renders 0% (not NaN) when total is 0 (empty file)", () => {
    // Empty file — 0/0 would be NaN if we did the division
    // unguarded. The component guards with `progress.total === 0`
    // and returns 0 explicitly. The test asserts BOTH the
    // aria-valuenow (screen-reader path) AND the visible text
    // (sighted-user path) stay at 0 — neither should show "NaN".
    const onCancel = vi.fn();
    const { container, unmount } = render({
      onCancel,
      progress: { bytesSent: 0, total: 0 },
    });

    const bar = container.querySelector('[data-testid="send-progress-bar"]');
    expect(bar?.getAttribute("aria-valuenow")).toBe("0");

    const text = container.querySelector('[data-testid="send-progress-text"]');
    expect(text?.textContent).toContain("0%");
    expect(text?.textContent).not.toContain("NaN");

    unmount();
  });

  it("clamps the fill width to 100% when bytesSent overshoots total", () => {
    // bytesSent=1500, total=1000 → 150% raw. The visual fill
    // width is clamped via Math.min(100, ...) so the bar never
    // overflows the track (e.g. the final chunk arriving before
    // the last onProgress tick). We assert the inline `width`
    // style is exactly "100%", not "150%".
    const onCancel = vi.fn();
    const { container, unmount } = render({
      onCancel,
      progress: { bytesSent: 1500, total: 1000 },
    });

    const fill = container.querySelector(
      '[data-testid="send-progress-fill"]'
    ) as HTMLElement;
    expect(fill.style.width).toBe("100%");

    unmount();
  });

  it("calls onCancel exactly once when the Cancel button is clicked", () => {
    // The button's onClick wires to the onCancel prop, which the
    // parent should bind to the current SendHandle.cancel(). This
    // test is the unit-level guarantee that the wiring inside the
    // component is correct — the parent wiring is covered by the
    // e2e suite.
    const onCancel = vi.fn();
    const { container, unmount } = render({
      onCancel,
      progress: { bytesSent: 500, total: 1000 },
    });

    const button = container.querySelector(
      '[data-testid="send-cancel"]'
    ) as HTMLButtonElement;
    button.click();

    expect(onCancel).toHaveBeenCalledTimes(1);

    unmount();
  });
});
