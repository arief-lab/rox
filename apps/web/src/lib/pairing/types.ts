export interface PairingPayload {
  /** The Device Name of the sender. Optional for slice 1; used in slice 9+. */
  name?: string;
  /** The WebRTC SDP offer or answer. */
  sdp: string;
}

/**
 * Type guard for a JSON-decoded value that may or may not be a PairingPayload.
 * Centralises the runtime validation so the decoder has a single source of
 * truth for "is this a valid payload?".
 */
export function isPairingPayload(x: unknown): x is PairingPayload {
  if (typeof x !== "object" || x === null) {
    return false;
  }
  const obj = x as Record<string, unknown>;
  if (typeof obj.sdp !== "string") {
    return false;
  }
  if (obj.name !== undefined && typeof obj.name !== "string") {
    return false;
  }
  return true;
}
