import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModeToggle } from "@/components/mode-toggle";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: mockSetTheme, theme: "light" }),
}));

/**
 * The DropdownMenu and its sub-components come from the shared UI package.
 * They rely on @radix-ui/react-dropdown-menu under the hood. We mock the
 * trigger/content/item trio so tests don't need the full Radix runtime.
 *
 * DropdownMenuContent always renders its children so tests can verify the
 * items exist and are clickable — no need to simulate open/close state
 * since we only test that all three theme options are present and call
 * setTheme correctly.
 */
vi.mock("@rox-apps/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="dropdown-item" onClick={onClick} type="button">
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="dropdown-trigger" type="button">
      {children}
    </button>
  ),
}));

vi.mock("@rox-apps/ui/components/button", () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button data-testid="mock-button" type="button">
      {children}
    </button>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ModeToggle />);
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

describe("ModeToggle", () => {
  it("renders the trigger button with sun and moon icons", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="dropdown-trigger"]')
    ).not.toBeNull();
    // Should contain both Sun and Moon SVGs
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    unmount();
  });

  it("includes a screen-reader label", () => {
    const { container, unmount } = render();
    const srSpan = container.querySelector(".sr-only");
    expect(srSpan).not.toBeNull();
    expect(srSpan?.textContent).toBe("Toggle theme");
    unmount();
  });

  it("renders Light, Dark, and System options", () => {
    const { container, unmount } = render();
    const items = container.querySelectorAll('[data-testid="dropdown-item"]');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe("Light");
    expect(items[1].textContent).toBe("Dark");
    expect(items[2].textContent).toBe("System");
    unmount();
  });

  it("calls setTheme('light') when Light is clicked", () => {
    const { container, unmount } = render();

    const items = container.querySelectorAll('[data-testid="dropdown-item"]');
    act(() => {
      (items[0] as HTMLButtonElement).click();
    });

    expect(mockSetTheme).toHaveBeenCalledWith("light");
    unmount();
  });

  it("calls setTheme('dark') when Dark is clicked", () => {
    const { container, unmount } = render();
    const items = container.querySelectorAll('[data-testid="dropdown-item"]');
    act(() => {
      (items[1] as HTMLButtonElement).click();
    });
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    unmount();
  });

  it("calls setTheme('system') when System is clicked", () => {
    const { container, unmount } = render();
    const items = container.querySelectorAll('[data-testid="dropdown-item"]');
    act(() => {
      (items[2] as HTMLButtonElement).click();
    });
    expect(mockSetTheme).toHaveBeenCalledWith("system");
    unmount();
  });
});
