import type {
  Transport,
  TransportCloseEvent,
  TransportMessage,
  TransportState,
} from "./types";

/**
 * RealTransport wraps an existing RTCPeerConnection + RTCDataChannel and
 * maps their DOM events to the Transport interface.
 *
 * This class is the bridge between the browser's RTCDataChannel API and
 * the rest of the app, which only knows about the Transport shape. It is
 * created by `createSession` after the peer connection has been wired up
 * with the local and remote SDPs.
 *
 * Configured per the PRD: DataChannel is reliable + unordered
 * (`{ ordered: false }`) so the chunked Transfer layer can reorder
 * chunks by `offset` without a stalled-delivery backpressure problem.
 */
export class RealTransport implements Transport {
  private _state: TransportState;
  private _closeReason: string | null = null;
  private readonly messageHandlers = new Set<
    (event: TransportMessage) => void
  >();
  private readonly closeHandlers = new Set<
    (event: TransportCloseEvent) => void
  >();
  private readonly pc: RTCPeerConnection;
  private readonly channel: RTCDataChannel;
  private readonly onChannelMessage: (event: MessageEvent) => void;
  private readonly onChannelOpen: () => void;
  private readonly onChannelClose: () => void;
  private readonly onChannelError: () => void;
  private readonly onConnectionStateChange: () => void;

  constructor(pc: RTCPeerConnection, channel: RTCDataChannel) {
    this.pc = pc;
    this.channel = channel;
    this._state = channel.readyState === "open" ? "open" : "connecting";

    this.onChannelMessage = (event: MessageEvent) => {
      const data = event.data as string | ArrayBuffer;
      for (const handler of this.messageHandlers) {
        handler({ data });
      }
    };
    this.onChannelOpen = () => {
      if (this._state === "connecting") {
        this._state = "open";
      }
    };
    this.onChannelClose = () => {
      this._internalClose("data channel closed");
    };
    this.onChannelError = () => {
      this._internalClose("data channel error");
    };
    this.onConnectionStateChange = () => {
      if (this.pc.connectionState === "failed") {
        this._internalClose("peer connection failed");
      } else if (this.pc.connectionState === "closed") {
        this._internalClose("peer connection closed");
      }
    };

    this.channel.addEventListener("message", this.onChannelMessage);
    this.channel.addEventListener("open", this.onChannelOpen);
    this.channel.addEventListener("close", this.onChannelClose);
    this.channel.addEventListener("error", this.onChannelError);
    this.pc.addEventListener(
      "connectionstatechange",
      this.onConnectionStateChange
    );
  }

  get state(): TransportState {
    return this._state;
  }

  get closeReason(): string | null {
    return this._closeReason;
  }

  send(data: string | ArrayBuffer): void {
    if (this._state !== "open") {
      throw new Error(
        `RealTransport: cannot send, state is ${this._state} (closeReason: ${this._closeReason})`
      );
    }
    // Explicit narrow because RTCDataChannel.send has overloads and
    // TypeScript's overload resolution picks the ArrayBufferView
    // overload when given `string | ArrayBuffer`.
    if (typeof data === "string") {
      this.channel.send(data);
    } else {
      this.channel.send(data);
    }
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
    this._state = "closing";
    try {
      this.channel.close();
    } catch {
      // channel may already be closed
    }
    try {
      this.pc.close();
    } catch {
      // pc may already be closed
    }
    this._internalClose(reason);
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
