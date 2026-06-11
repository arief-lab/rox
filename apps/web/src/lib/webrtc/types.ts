/**
 * Transport — the abstract data channel the rest of the app uses.
 *
 * Both the real RTCDataChannel-backed implementation and the in-memory
 * fake transport implement this interface. The Transfer and Session
 * layers depend only on this shape, so the WebRTC seam is fully
 * substitutable in tests.
 */

export type TransportState = "connecting" | "open" | "closing" | "closed";

export interface TransportMessage {
  data: string | ArrayBuffer;
}

export interface TransportCloseEvent {
  reason: string;
}

export interface Transport {
  close(reason?: string): void;
  readonly closeReason: string | null;
  onclose(handler: (event: TransportCloseEvent) => void): () => void;
  onmessage(handler: (event: TransportMessage) => void): () => void;
  send(data: string | ArrayBuffer): void;
  readonly state: TransportState;
}
