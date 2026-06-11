import { describe, expect, it } from "vitest";

import { generateDeviceName } from "@/lib/device-name";

describe("generateDeviceName", () => {
  it('returns "iPhone" for iPhone Safari UA', () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(generateDeviceName(ua)).toBe("iPhone");
  });

  it('returns "iPad" for iPad Safari UA', () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(generateDeviceName(ua)).toBe("iPad");
  });

  it('returns "Mac" for Mac Chrome UA', () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(generateDeviceName(ua)).toBe("Mac");
  });

  it('returns "Mac" for Mac Firefox UA', () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(generateDeviceName(ua)).toBe("Mac");
  });

  it('returns "Windows" for Windows Chrome UA', () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(generateDeviceName(ua)).toBe("Windows");
  });

  it('returns "Windows" for Windows Firefox UA', () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(generateDeviceName(ua)).toBe("Windows");
  });

  it('returns "Android" for Android Chrome UA', () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36";
    expect(generateDeviceName(ua)).toBe("Android");
  });

  it('returns "Android" for Android Firefox UA', () => {
    const ua =
      "Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0";
    expect(generateDeviceName(ua)).toBe("Android");
  });

  it('returns "ChromeOS" for ChromeOS Chrome UA', () => {
    const ua =
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(generateDeviceName(ua)).toBe("ChromeOS");
  });

  it('returns "Linux" for Linux desktop UA', () => {
    const ua =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(generateDeviceName(ua)).toBe("Linux");
  });

  it('returns "iPhone" over "Mac" when iPhone is in the UA', () => {
    // iPhone UA contains "Mac OS X" — the specific check must win.
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(generateDeviceName(ua)).toBe("iPhone");
  });

  it('returns "Android" over "Linux" when Android is in the UA', () => {
    // Android UA contains "Linux" — the specific check must win.
    const ua =
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0";
    expect(generateDeviceName(ua)).toBe("Android");
  });

  it('returns "iPad" over "Mac" when iPad is in the UA', () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(generateDeviceName(ua)).toBe("iPad");
  });

  it('returns "Unknown Device" for empty UA', () => {
    expect(generateDeviceName("")).toBe("Unknown Device");
  });

  it('returns "Unknown Device" for unrecognised UA', () => {
    expect(generateDeviceName("some-custom-bot/1.0")).toBe("Unknown Device");
  });

  it("defaults to empty string when no UA is passed", () => {
    expect(generateDeviceName()).toBe("Unknown Device");
  });
});
