import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import Header from "@/components/header";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/mode-toggle", () => ({
  ModeToggle: () => <div data-testid="mode-toggle" />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Header />);
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

describe("Header", () => {
  it("renders a Home link", () => {
    const { container, unmount } = render();
    const homeLink = container.querySelector('a[href="/"]');
    expect(homeLink).not.toBeNull();
    expect(homeLink?.textContent).toBe("Home");
    unmount();
  });

  it("renders the ModeToggle component", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="mode-toggle"]')
    ).not.toBeNull();
    unmount();
  });

  it("renders a horizontal rule separator", () => {
    const { container, unmount } = render();
    expect(container.querySelector("hr")).not.toBeNull();
    unmount();
  });
});
