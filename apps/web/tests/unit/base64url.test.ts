// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { base64urlDecode, base64urlEncode } from "@/lib/pairing";

/** Matches any character that is NOT base64url-safe (only [A-Za-z0-9_-]). */
const UNSAFE_CHARS = /[^A-Za-z0-9_-]/;

describe("base64urlEncode", () => {
  it("encodes a simple ASCII string without padding or unsafe chars", () => {
    const encoded = base64urlEncode("hello world");
    expect(encoded).not.toMatch(UNSAFE_CHARS);
    expect(encoded).not.toContain("=");
    // Standard base64 would end with "=="; base64url strips it.
  });

  it("encodes a string with URL-unsafe bytes (binary data)", () => {
    // Bytes that produce + and / in standard base64.
    const input = String.fromCharCode(0xfb, 0xff, 0xff, 0xfb);
    const encoded = base64urlEncode(input);
    expect(encoded).not.toMatch(UNSAFE_CHARS);
  });

  it("encodes unicode text", () => {
    const encoded = base64urlEncode("日本語 🚀");
    expect(encoded).not.toMatch(UNSAFE_CHARS);
  });

  it("encodes an empty string", () => {
    expect(base64urlEncode("")).toBe("");
  });
});

describe("base64urlDecode", () => {
  it("decodes a base64url string back to the original ASCII text", () => {
    const original = "hello world";
    const encoded = base64urlEncode(original);
    expect(base64urlDecode(encoded)).toBe(original);
  });

  it("decodes unicode text correctly", () => {
    const original = "日本語 🚀";
    expect(base64urlDecode(base64urlEncode(original))).toBe(original);
  });

  it("decodes binary byte sequences correctly", () => {
    const original = String.fromCharCode(0x00, 0x01, 0xff, 0xfe);
    expect(base64urlDecode(base64urlEncode(original))).toBe(original);
  });

  it("decodes an empty string", () => {
    expect(base64urlDecode("")).toBe("");
  });
});

describe("base64url encode ↔ decode round trip", () => {
  it("round-trips a realistic JSON blob (SDP-like payload)", () => {
    const payload = JSON.stringify({
      sdp: "v=0\no=- 12345 67890 IN IP4 192.168.1.1\ns=-\nt=0 0\n",
      name: "MacBook Pro",
    });
    expect(base64urlDecode(base64urlEncode(payload))).toBe(payload);
  });

  it("round-trips a large payload (10 KB of random text)", () => {
    const payload = "x".repeat(10 * 1024);
    expect(base64urlDecode(base64urlEncode(payload))).toBe(payload);
  });

  it("round-trips safely handles URL-unsafe characters in the output", () => {
    // String whose encoding produces + and / in base64.
    const input = String.fromCharCode(0x3e, 0xbf, 0xbf, 0xbf, 0x3e);
    const encoded = base64urlEncode(input);
    // No unsafe chars.
    expect(encoded).not.toMatch(UNSAFE_CHARS);
    // Round trip succeeds.
    expect(base64urlDecode(encoded)).toBe(input);
  });
});

describe("base64urlDecode accepts standard base64 input", () => {
  it("decodes standard base64 with + (converted from -)", () => {
    // A manually-padded standard base64 encoding of "hello".
    expect(base64urlDecode("aGVsbG8=")).toBe("hello");
  });

  it("decodes standard base64 with / (converted from _)", () => {
    // Base64 encoding of bytes that produce /.
    const input = String.fromCharCode(0xfb, 0xff, 0xff);
    const encoded = base64urlEncode(input);
    // input encoded and decoded back.
    expect(base64urlDecode(encoded)).toBe(input);
  });

  it("handles input with embedded padding", () => {
    // Standard base64 with = padding.
    expect(base64urlDecode("aGVsbG8=")).toBe("hello");
  });

  it("handles input with missing padding", () => {
    // Without the trailing =.
    expect(base64urlDecode("aGVsbG8")).toBe("hello");
  });
});
