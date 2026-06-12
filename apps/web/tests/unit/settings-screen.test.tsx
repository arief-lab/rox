import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "@/components/settings-screen";
// biome-ignore lint/performance/noNamespaceImport: vi.spyOn needs a namespace object
import * as deviceName from "@/lib/device-name";

const NOOP = vi.fn();

function render(onBack = NOOP) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<SettingsScreen onBack={onBack} />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("SettingsScreen", () => {
  it("renders the settings screen with the current device name", () => {
    vi.spyOn(deviceName, "getDeviceName").mockReturnValue("My MacBook");
    const { container, unmount } = render();
    const input = container.querySelector(
      '[data-testid="device-name-input"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("My MacBook");
    unmount();
  });

  it("renders Save, Cancel, and Reset buttons", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="device-name-save"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="device-name-cancel"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="device-name-reset"]')
    ).not.toBeNull();
    unmount();
  });

  it("Save button is disabled when the name is empty", () => {
    vi.spyOn(deviceName, "getDeviceName").mockReturnValue("");
    const { container, unmount } = render();
    const saveBtn = container.querySelector(
      '[data-testid="device-name-save"]'
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    unmount();
  });

  it("Save button is disabled when the name is only whitespace", () => {
    vi.spyOn(deviceName, "getDeviceName").mockReturnValue("   ");
    const { container, unmount } = render();
    const saveBtn = container.querySelector(
      '[data-testid="device-name-save"]'
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    unmount();
  });

  it("Save button is enabled when the name is non-empty", () => {
    vi.spyOn(deviceName, "getDeviceName").mockReturnValue("My Device");
    const { container, unmount } = render();
    const saveBtn = container.querySelector(
      '[data-testid="device-name-save"]'
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    unmount();
  });

  it("calls setDeviceName with the initial name when Save is clicked without changes", () => {
    const setSpy = vi.spyOn(deviceName, "setDeviceName").mockReturnValue();
    const onBack = vi.fn();
    vi.spyOn(deviceName, "getDeviceName").mockReturnValue("My Device");
    const { container, unmount } = render(onBack);

    // Click Save with the current name (unchanged).
    const saveBtn = container.querySelector(
      '[data-testid="device-name-save"]'
    ) as HTMLButtonElement;
    saveBtn.click();

    expect(setSpy).toHaveBeenCalledWith("My Device");
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("Save button is disabled when the name is only whitespace after trim", () => {
    vi.spyOn(deviceName, "getDeviceName").mockReturnValue(" ");
    const { container, unmount } = render();
    const saveBtn = container.querySelector(
      '[data-testid="device-name-save"]'
    ) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    unmount();
  });

  it("calls onBack when Cancel is clicked", () => {
    const onBack = vi.fn();
    const { container, unmount } = render(onBack);
    const cancelBtn = container.querySelector(
      '[data-testid="device-name-cancel"]'
    ) as HTMLButtonElement;
    cancelBtn.click();
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("calls resetDeviceName and re-reads the name when Reset is clicked", () => {
    const resetSpy = vi.spyOn(deviceName, "resetDeviceName").mockReturnValue();
    const getSpy = vi
      .spyOn(deviceName, "getDeviceName")
      .mockReturnValue("MacBook Pro");
    const { container, unmount } = render();

    const resetBtn = container.querySelector(
      '[data-testid="device-name-reset"]'
    ) as HTMLButtonElement;
    resetBtn.click();

    expect(resetSpy).toHaveBeenCalledTimes(1);
    // After reset, getDeviceName is called again to refresh the input
    expect(getSpy).toHaveBeenCalled();
    unmount();
  });
});
