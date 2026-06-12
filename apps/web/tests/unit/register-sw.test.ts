import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerServiceWorker } from "@/lib/pwa/register-sw";

beforeEach(() => {
  vi.stubGlobal("navigator", {
    serviceWorker: {
      controller: null as ServiceWorker | null,
      register: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registerServiceWorker", () => {
  it("does nothing when serviceWorker is not available", () => {
    vi.stubGlobal("navigator", {});

    // Should not throw.
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it("calls navigator.serviceWorker.register with correct args", () => {
    const register = navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >;
    register.mockResolvedValue({ addEventListener: vi.fn() });

    registerServiceWorker();

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("adds an updatefound listener on the registration", async () => {
    const addEventListener = vi.fn();
    const register = navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >;
    register.mockResolvedValue({ addEventListener });

    registerServiceWorker();

    // Wait for the promise to settle (microtask).
    await vi.waitFor(() => {
      expect(addEventListener).toHaveBeenCalledWith(
        "updatefound",
        expect.any(Function)
      );
    });
  });

  it("adds a statechange listener on the installing worker from updatefound", async () => {
    const installingAddEventListener = vi.fn();
    const registration = {
      installing: { addEventListener: installingAddEventListener },
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        // Fire updatefound immediately so the installing worker
        // listener is wired up.
        handler();
      }),
    };
    const register = navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >;
    register.mockResolvedValue(registration);

    registerServiceWorker();

    await vi.waitFor(() => {
      expect(installingAddEventListener).toHaveBeenCalledWith(
        "statechange",
        expect.any(Function)
      );
    });
  });

  it("handles updatefound when installing is null gracefully", () => {
    const registration = {
      installing: null,
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        handler();
      }),
    };
    const register = navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >;
    register.mockResolvedValue(registration);

    // Should not throw when installing is null.
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it("does not throw when registration fails", () => {
    const register = navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >;
    register.mockRejectedValue(new Error("No HTTPS"));

    // Should not throw — the catch block swallows the error.
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it("fires statechange for installing worker state transitions", async () => {
    let stateChangeHandler: (() => void) | null = null;
    const installingAddEventListener = vi.fn(
      (_event: string, handler: () => void) => {
        stateChangeHandler = handler;
      }
    );
    const registration = {
      installing: { addEventListener: installingAddEventListener },
      addEventListener: vi.fn((_event: string, handler: () => void) => {
        handler();
      }),
    };
    const register = navigator.serviceWorker.register as ReturnType<
      typeof vi.fn
    >;
    register.mockResolvedValue(registration);

    registerServiceWorker();

    // Wait for the statechange listener to be registered.
    await vi.waitFor(() => {
      expect(stateChangeHandler).not.toBeNull();
    });

    // Firing the statechange should not throw.
    expect(() => stateChangeHandler?.()).not.toThrow();
  });
});
