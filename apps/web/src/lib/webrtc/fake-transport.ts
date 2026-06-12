// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  Transport,
  TransportCloseEvent,
  TransportMessage,
  TransportState,
} from "./types";

/**
 * A pair of in-memory Transports that exchange messages with each other.
 *
 * - send(data) on one queues a microtask that dispatches the data to the
 *   peer's onmessage handlers (mirroring real RTCDataChannel's async dispatch).
 * - close() on one fires onclose on the other and marks both as closed.
 *
 * This is the only test double we need for the WebRTC seam: it gives
 * integration tests a way to drive the Session / Transfer / Inbox layers
 * with a real Transport-shaped API but no browser, no RTCPeerConnection,
 * and no headless flakiness.
 */
export class FakeTransport implements Transport {
  private _state: TransportState = "open";
  private _closeReason: string | null = null;
  private readonly messageHandlers = new Set<
    (event: TransportMessage) => void
  >();
  private readonly closeHandlers = new Set<
    (event: TransportCloseEvent) => void
  >();
  private peer: FakeTransport | null = null;

  get state(): TransportState {
    return this._state;
  }

  get closeReason(): string | null {
    return this._closeReason;
  }

  /** Internal: wire this transport to its peer. Called by createFakeTransportPair. */
  bindPeer(peer: FakeTransport): void {
    this.peer = peer;
  }

  send(data: string | ArrayBuffer): void {
    if (this._state !== "open") {
      throw new Error(`FakeTransport: cannot send, state is ${this._state}`);
    }
    const peer = this.peer;
    if (peer?._state !== "open") {
      return;
    }
    const event: TransportMessage = { data };
    queueMicrotask(() => {
      for (const handler of peer.messageHandlers) {
        handler(event);
      }
    });
  }

  onmessage(handler: (event: TransportMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onclose(handler: (event: TransportCloseEvent) => void): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  close(reason = "closed"): void {
    if (this._state === "closed") {
      return;
    }
    this._state = "closed";
    this._closeReason = reason;
    const event: TransportCloseEvent = { reason };
    for (const handler of this.closeHandlers) {
      handler(event);
    }
    if (this.peer && this.peer._state !== "closed") {
      this.peer._internalClose(reason);
    }
  }

  _internalClose(reason: string): void {
    if (this._state === "closed") {
      return;
    }
    this._state = "closed";
    this._closeReason = reason;
    const event: TransportCloseEvent = { reason };
    for (const handler of this.closeHandlers) {
      handler(event);
    }
  }
}

/**
 * Returns two FakeTransports wired to each other. The returned tuple is
 * the test equivalent of "two sides of a real RTCPeerConnection".
 */
export function createFakeTransportPair(): [Transport, Transport] {
  const a = new FakeTransport();
  const b = new FakeTransport();
  a.bindPeer(b);
  b.bindPeer(a);
  return [a, b];
}
