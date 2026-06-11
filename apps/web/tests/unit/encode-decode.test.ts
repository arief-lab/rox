import { describe, expect, it } from "vitest";

import { base64urlEncode, decodeOffer, encodeOffer } from "@/lib/pairing";

const SAMPLE_SDP = "v=0\no=- 12345 67890 IN IP4 192.168.1.1\ns=-\nt=0 0\n";

const BASE64URL_UNSAFE_CHARS = /[+/=]/;
const NOT_VALID_JSON_REGEX = /not valid JSON/;
const MALFORMED_REGEX = /malformed/;

describe("encodeOffer → decodeOffer round trip", () => {
  it("round-trips a typical SDP with a name", () => {
    const encoded = encodeOffer(SAMPLE_SDP, "Alice's iPhone");
    const decoded = decodeOffer(encoded);
    expect(decoded.sdp).toBe(SAMPLE_SDP);
    expect(decoded.name).toBe("Alice's iPhone");
  });

  it("round-trips a typical SDP without a name", () => {
    const encoded = encodeOffer(SAMPLE_SDP);
    const decoded = decodeOffer(encoded);
    expect(decoded.sdp).toBe(SAMPLE_SDP);
    expect(decoded.name).toBeUndefined();
  });

  it("produces base64url-safe output (no +, /, or = characters)", () => {
    const encoded = encodeOffer("test with +/= and unicode: 你好 🚀");
    expect(encoded).not.toMatch(BASE64URL_UNSAFE_CHARS);
  });

  it("round-trips multi-kilobyte SDPs (the realistic WebRTC offer size)", () => {
    const bigSdp = `v=0\no=- ${"x".repeat(2048)} 0 IN IP4 127.0.0.1\ns=-\n`;
    const encoded = encodeOffer(bigSdp, "Big");
    const decoded = decodeOffer(encoded);
    expect(decoded.sdp).toBe(bigSdp);
    expect(decoded.name).toBe("Big");
  });
});

describe("decodeOffer rejection paths", () => {
  it("rejects text that is not valid base64url", () => {
    expect(() => decodeOffer("not-base64-!!!")).toThrow();
  });

  it("rejects base64url that is not valid JSON", () => {
    const notJson = base64urlEncode("not json at all");
    expect(() => decodeOffer(notJson)).toThrow(NOT_VALID_JSON_REGEX);
  });

  it("rejects JSON that is not an object", () => {
    const wrongShape = base64urlEncode(JSON.stringify("just a string"));
    expect(() => decodeOffer(wrongShape)).toThrow(MALFORMED_REGEX);
  });

  it("rejects JSON object missing sdp", () => {
    const wrongShape = base64urlEncode(JSON.stringify({ name: "no sdp" }));
    expect(() => decodeOffer(wrongShape)).toThrow(MALFORMED_REGEX);
  });

  it("rejects JSON object with a non-string name", () => {
    const wrongShape = base64urlEncode(JSON.stringify({ sdp: "x", name: 42 }));
    expect(() => decodeOffer(wrongShape)).toThrow(MALFORMED_REGEX);
  });
});
