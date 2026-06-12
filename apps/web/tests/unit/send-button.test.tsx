// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { SendButton } from "@/components/send-button";

const NOOP = vi.fn();

function render(onSend = NOOP, disabled = false) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<SendButton disabled={disabled} onSend={onSend} />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("SendButton", () => {
  it("renders the send button", () => {
    const { container, unmount } = render();
    const button = container.querySelector(
      '[data-testid="send-file"]'
    ) as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe("Send file");
    unmount();
  });

  it("is not disabled by default", () => {
    const { container, unmount } = render();
    const button = container.querySelector(
      '[data-testid="send-file"]'
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    unmount();
  });

  it("is disabled when the disabled prop is true", () => {
    const { container, unmount } = render(NOOP, true);
    const button = container.querySelector(
      '[data-testid="send-file"]'
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    unmount();
  });

  it("renders a hidden file input", () => {
    const { container, unmount } = render();
    const input = container.querySelector(
      '[data-testid="file-input"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.className).toContain("hidden");
    expect(input.getAttribute("accept")).toBe("*/*");
    unmount();
  });

  it("clicking the button triggers the file input click", () => {
    const { container, unmount } = render();
    const button = container.querySelector(
      '[data-testid="send-file"]'
    ) as HTMLButtonElement;
    const input = container.querySelector(
      '[data-testid="file-input"]'
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    button.click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    unmount();
  });
});
