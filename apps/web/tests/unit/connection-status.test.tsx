// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { ConnectionStatus } from "@/components/connection-status";

interface RenderHandle {
  container: HTMLDivElement;
  unmount: () => void;
}

/**
 * Same lightweight render helper used by transfer-progress.test.tsx:
 * `createRoot` + `flushSync` (no @testing-library/react — the
 * component is pure presentational, vanilla DOM is enough).
 */
function render(
  status: "connecting" | "connected" | "disconnected"
): RenderHandle {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<ConnectionStatus status={status} />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("ConnectionStatus", () => {
  it("renders the 'connecting' variant (yellow dot + 'Connecting...')", () => {
    const { container, unmount } = render("connecting");
    const root = container.querySelector('[data-testid="connection-status"]');
    expect(root?.getAttribute("data-status")).toBe("connecting");
    const text = container.querySelector(
      '[data-testid="connection-status-text"]'
    );
    expect(text?.textContent).toBe("Connecting...");
    // Dot is `aria-hidden` (decorative) — its color is the visual
    // signal, not the accessible name. Assert the bg-yellow class
    // is applied so the visual contract is locked in.
    const dot = root?.querySelector("span[aria-hidden='true']");
    expect(dot?.className).toContain("bg-yellow-500");
    unmount();
  });

  it("renders the 'connected' variant (green dot + 'Connected')", () => {
    const { container, unmount } = render("connected");
    const root = container.querySelector('[data-testid="connection-status"]');
    expect(root?.getAttribute("data-status")).toBe("connected");
    const text = container.querySelector(
      '[data-testid="connection-status-text"]'
    );
    expect(text?.textContent).toBe("Connected");
    const dot = root?.querySelector("span[aria-hidden='true']");
    expect(dot?.className).toContain("bg-green-500");
    unmount();
  });

  it("renders the 'disconnected' variant (red dot + 'Disconnected')", () => {
    const { container, unmount } = render("disconnected");
    const root = container.querySelector('[data-testid="connection-status"]');
    expect(root?.getAttribute("data-status")).toBe("disconnected");
    const text = container.querySelector(
      '[data-testid="connection-status-text"]'
    );
    expect(text?.textContent).toBe("Disconnected");
    const dot = root?.querySelector("span[aria-hidden='true']");
    expect(dot?.className).toContain("bg-red-500");
    unmount();
  });
});
