import { describe, expect, it } from "vitest";

import {
  CHUNK_SIZE,
  type Chunk,
  decodeChunk,
  decodeStart,
  encodeChunk,
  encodeStart,
} from "@/lib/transfer";

// Cancel message functions are NOT re-exported from @/lib/transfer/index.ts
// (only the chunk and start message utilities are), so we import them
// directly from chunk-frame.ts.
import {
  decodeCancel,
  encodeCancel,
  isCancelMessage,
} from "@/lib/transfer/chunk-frame";

/** Matches the "too short" error from decodeChunk. */
const TOO_SHORT_REGEX = /too short/;
/** Matches the "length mismatch" error from decodeChunk. */
const LENGTH_MISMATCH_REGEX = /length mismatch/;
/** Matches the "Not a start" error from decodeStart. */
const NOT_START_REGEX = /Not a start/;

describe("encodeChunk → decodeChunk round trip", () => {
  it("round-trips a typical chunk with a 1 KB payload", () => {
    const fileId = "file-123";
    const payload = new TextEncoder().encode("a".repeat(1024)).buffer;
    const chunk: Chunk = {
      fileId,
      offset: 0,
      length: payload.byteLength,
      payload,
    };
    const encoded = encodeChunk(chunk);
    const decoded = decodeChunk(encoded);
    expect(decoded.fileId).toBe(fileId);
    expect(decoded.offset).toBe(0);
    expect(decoded.length).toBe(payload.byteLength);
    expect(new Uint8Array(decoded.payload)).toEqual(new Uint8Array(payload));
  });

  it("round-trips a chunk at a non-zero offset", () => {
    const fileId = "file-456";
    const payload = new TextEncoder().encode("hello").buffer;
    const chunk: Chunk = { fileId, offset: 16_384, length: 5, payload };
    const decoded = decodeChunk(encodeChunk(chunk));
    expect(decoded.fileId).toBe(fileId);
    expect(decoded.offset).toBe(16_384);
    expect(decoded.length).toBe(5);
  });

  it("round-trips a chunk with a unicode fileId", () => {
    const fileId = "文件-🚀";
    const payload = new Uint8Array([1, 2, 3]).buffer;
    const chunk: Chunk = { fileId, offset: 0, length: 3, payload };
    const decoded = decodeChunk(encodeChunk(chunk));
    expect(decoded.fileId).toBe(fileId);
  });

  it("rejects a truncated frame (too short)", () => {
    const buffer = new ArrayBuffer(4); // only the fileIdLen u32
    expect(() => decodeChunk(buffer)).toThrow(TOO_SHORT_REGEX);
  });

  it("rejects a frame with length mismatch", () => {
    const fileId = "x";
    const payload = new Uint8Array([1, 2, 3]).buffer;
    const chunk: Chunk = { fileId, offset: 0, length: 3, payload };
    const encoded = encodeChunk(chunk);
    // Truncate the payload
    const truncated = encoded.slice(0, encoded.byteLength - 1);
    expect(() => decodeChunk(truncated)).toThrow(LENGTH_MISMATCH_REGEX);
  });
});

describe("encodeStart → decodeStart round trip", () => {
  it("round-trips a start message", () => {
    const encoded = encodeStart("file-789", "photo.jpg", 1_048_576);
    const decoded = decodeStart(encoded);
    expect(decoded).toEqual({
      type: "start",
      fileId: "file-789",
      name: "photo.jpg",
      totalSize: 1_048_576,
    });
  });

  it("rejects a non-start JSON", () => {
    expect(() => decodeStart('{"foo":"bar"}')).toThrow(NOT_START_REGEX);
  });

  it("rejects a start message missing required fields", () => {
    expect(() => decodeStart('{"type":"start","fileId":"x"}')).toThrow();
  });
});

describe("cancel message encode/decode", () => {
  it("encodeCancel produces a valid cancel JSON", () => {
    const encoded = encodeCancel("file-123");
    expect(typeof encoded).toBe("string");
    const parsed = JSON.parse(encoded);
    expect(parsed).toEqual({ type: "cancel", fileId: "file-123" });
  });

  it("decodeCancel recovers the fileId", () => {
    const encoded = encodeCancel("file-456");
    const decoded = decodeCancel(encoded);
    expect(decoded.fileId).toBe("file-456");
    expect(decoded.type).toBe("cancel");
  });

  it("isCancelMessage returns true for a valid cancel message", () => {
    expect(isCancelMessage('{"type":"cancel","fileId":"x"}')).toBe(true);
  });

  it("isCancelMessage returns false for a start message", () => {
    expect(
      isCancelMessage(
        '{"type":"start","fileId":"x","name":"a.txt","totalSize":100}'
      )
    ).toBe(false);
  });

  it("isCancelMessage returns false for arbitrary JSON", () => {
    expect(isCancelMessage('{"foo":"bar"}')).toBe(false);
  });

  it("isCancelMessage returns false for invalid JSON", () => {
    expect(isCancelMessage("not-json")).toBe(false);
  });

  it("decodeCancel throws for a start message (wrong type)", () => {
    expect(() =>
      decodeCancel(
        '{"type":"start","fileId":"x","name":"a.txt","totalSize":100}'
      )
    ).toThrow("Not a cancel message");
  });

  it("decodeCancel throws when fileId is missing", () => {
    expect(() => decodeCancel('{"type":"cancel"}')).toThrow(
      "Cancel message missing fileId"
    );
  });

  it("encodeCancel → decodeCancel round trip on a unicode fileId", () => {
    const fileId = "文件-🚀";
    const encoded = encodeCancel(fileId);
    const decoded = decodeCancel(encoded);
    expect(decoded.fileId).toBe(fileId);
  });
});

describe("CHUNK_SIZE", () => {
  it("is 16 KB (16384 bytes)", () => {
    expect(CHUNK_SIZE).toBe(16 * 1024);
  });
});
