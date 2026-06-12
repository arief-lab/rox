import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InstallPrompt } from "@/components/install-prompt";
// biome-ignore lint/performance/noNamespaceImport: vi.spyOn needs namespace object
import * as installStore from "@/lib/pwa/install-store";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  });
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
    configurable: true,
  });
  installStore.resetDismissCount();
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = undefined;
});

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<InstallPrompt />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

/** Dispatch a synthetic beforeinstallprompt event wrapped in act(). */
function dispatchBeforeInstallPrompt(overrides?: {
  outcome?: "accepted" | "dismissed";
}): Event {
  const event = new Event("beforeinstallprompt");
  vi.spyOn(event, "preventDefault").mockReturnValue(undefined);
  Object.defineProperty(event, "prompt", {
    value: vi.fn(),
    writable: true,
  });
  Object.defineProperty(event, "userChoice", {
    value: Promise.resolve({
      outcome: overrides?.outcome ?? "accepted",
    }),
    writable: true,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const INSTALL_BTN = '[data-testid="install-button"]';
const DISMISS_BTN = '[data-testid="install-dismiss"]';

describe("InstallPrompt", () => {
  it("returns null when shouldShowPrompt is false (max dismissals)", () => {
    installStore.incrementDismissCount();
    installStore.incrementDismissCount();
    installStore.incrementDismissCount();

    const { container, unmount } = render();
    expect(container.innerHTML).toBe("");
    unmount();
  });

  it("does not show the Chrome banner before beforeinstallprompt fires", () => {
    const { container, unmount } = render();
    expect(container.querySelector(INSTALL_BTN)).toBeNull();
    unmount();
  });

  it("removes the beforeinstallprompt listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render();
    expect(addSpy).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function)
    );

    unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function)
    );
  });

  describe("Chrome banner", () => {
    it("shows the banner when beforeinstallprompt fires", () => {
      const { container, unmount } = render();
      dispatchBeforeInstallPrompt();

      const installBtn = container.querySelector(INSTALL_BTN);
      expect(installBtn).not.toBeNull();
      expect(installBtn?.textContent).toBe("Install");
      expect(container.querySelector(DISMISS_BTN)).not.toBeNull();
      unmount();
    });

    it("calls incrementDismissCount when the dismiss button is clicked", () => {
      const spy = vi.spyOn(installStore, "incrementDismissCount");
      const { container, unmount } = render();
      dispatchBeforeInstallPrompt();

      const dismissBtn = container.querySelector(
        DISMISS_BTN
      ) as HTMLButtonElement;
      dismissBtn.click();

      expect(spy).toHaveBeenCalledTimes(1);
      unmount();
    });

    it("hides the banner after dismiss", () => {
      const { container, unmount } = render();
      dispatchBeforeInstallPrompt();

      const dismissBtn = container.querySelector(
        DISMISS_BTN
      ) as HTMLButtonElement;
      act(() => {
        dismissBtn.click();
      });

      expect(container.querySelector(INSTALL_BTN)).toBeNull();
      unmount();
    });

    it("calls prompt() and incrementDismissCount on install click", async () => {
      const spy = vi.spyOn(installStore, "incrementDismissCount");
      const { container, unmount } = render();
      const event = dispatchBeforeInstallPrompt();

      const installBtn = container.querySelector(
        INSTALL_BTN
      ) as HTMLButtonElement;
      act(() => {
        installBtn.click();
      });

      await vi.waitFor(() => {
        expect(
          (event as unknown as Record<string, unknown>).prompt
        ).toHaveBeenCalledTimes(1);
      });
      expect(spy).toHaveBeenCalledTimes(1);
      unmount();
    });

    it("hides the banner after install click", async () => {
      const { container, unmount } = render();
      dispatchBeforeInstallPrompt();

      const installBtn = container.querySelector(
        INSTALL_BTN
      ) as HTMLButtonElement;
      act(() => {
        installBtn.click();
      });

      await vi.waitFor(() => {
        expect(container.querySelector(INSTALL_BTN)).toBeNull();
      });
      unmount();
    });

    it("handles dismissed outcome from the native install dialog", async () => {
      const spy = vi.spyOn(installStore, "incrementDismissCount");
      const { container, unmount } = render();
      dispatchBeforeInstallPrompt({ outcome: "dismissed" });

      const installBtn = container.querySelector(
        INSTALL_BTN
      ) as HTMLButtonElement;
      act(() => {
        installBtn.click();
      });

      await vi.waitFor(() => {
        expect(container.querySelector(INSTALL_BTN)).toBeNull();
      });
      expect(spy).toHaveBeenCalledTimes(1);
      unmount();
    });
  });

  describe("iOS Safari hint", () => {
    beforeEach(() => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        standalone: false,
      });
    });

    it("shows the iOS hint after 3 seconds", () => {
      const { container, unmount } = render();

      expect(container.querySelector(DISMISS_BTN)).toBeNull();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(container.querySelector(DISMISS_BTN)).not.toBeNull();
      expect(container.textContent).toContain("Add to Home Screen");
      unmount();
    });

    it("does not show iOS hint when max dismissals reached", () => {
      installStore.incrementDismissCount();
      installStore.incrementDismissCount();
      installStore.incrementDismissCount();

      const { container, unmount } = render();
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(container.querySelector(DISMISS_BTN)).toBeNull();
      unmount();
    });

    it("calls incrementDismissCount when iOS dismiss is clicked", () => {
      const spy = vi.spyOn(installStore, "incrementDismissCount");
      const { container, unmount } = render();
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      const dismissBtn = container.querySelector(
        DISMISS_BTN
      ) as HTMLButtonElement;
      act(() => {
        dismissBtn.click();
      });

      expect(spy).toHaveBeenCalledTimes(1);
      unmount();
    });

    it("hides the iOS hint after dismiss", () => {
      const { container, unmount } = render();
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      const dismissBtn = container.querySelector(
        DISMISS_BTN
      ) as HTMLButtonElement;
      act(() => {
        dismissBtn.click();
      });

      expect(container.querySelector(DISMISS_BTN)).toBeNull();
      unmount();
    });
  });
});
