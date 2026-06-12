// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";

import { readClipboard, writeClipboard } from "@/lib/pairing";

describe("clipboard helpers", () => {
  it("writeClipboard delegates to the underlying writeText with the text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fakeClipboard = {
      readText: vi.fn(),
      writeText,
    };

    await writeClipboard("hello world", fakeClipboard);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("hello world");
  });

  it("readClipboard returns the value from the underlying readText", async () => {
    const readText = vi.fn().mockResolvedValue("pasted text");
    const fakeClipboard = {
      readText,
      writeText: vi.fn(),
    };

    const result = await readClipboard(fakeClipboard);

    expect(result).toBe("pasted text");
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("propagates errors from the underlying clipboard", async () => {
    const fakeClipboard = {
      readText: vi.fn(),
      writeText: vi.fn().mockRejectedValue(new Error("permission denied")),
    };

    await expect(writeClipboard("x", fakeClipboard)).rejects.toThrow(
      "permission denied"
    );
  });
});

describe("clipboard fallback to globalThis.navigator.clipboard", () => {
  const originalClipboard = globalThis.navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  it("readClipboard() with no arg uses globalThis.navigator.clipboard", async () => {
    const readText = vi.fn().mockResolvedValue("from global navigator");
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { readText, writeText: vi.fn() },
      configurable: true,
      writable: true,
    });

    const result = await readClipboard();

    expect(result).toBe("from global navigator");
    expect(readText).toHaveBeenCalledTimes(1);
  });
});
