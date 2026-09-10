// Ambient declarations for the Pear-stack modules (they ship no types).
declare module "corestore" {
  interface Corestore {
    constructor: unknown;
    new (dir: string): Corestore;
    close(): Promise<void>;
    replicate(...args: unknown[]): unknown;
    [key: string]: unknown;
  }
  const Corestore: new (dir: string) => Corestore;
  export = Corestore;
}

declare module "hyperdrive" {
  import type { Corestore } from "corestore";

  interface HyperdriveEntry {
    key: string;
    seq: number;
    value: {
      executable: boolean;
      linkname: null | string;
      blob: {
        blockOffset: number;
        blockLength: number;
        byteOffset: number;
        byteLength: number;
      };
      metadata: unknown;
    };
  }

  interface HyperdriveDownload {
    done(): Promise<void>;
    destroy(): void;
  }

  interface Hyperdrive {
    key: Buffer;
    discoveryKey: Buffer;
    writable: boolean;
    ready(): Promise<void>;
    put(path: string, data: Buffer | NodeJS.ReadableStream): Promise<void>;
    get(path: string): Promise<Buffer | null>;
    entry(path: string): Promise<HyperdriveEntry | null>;
    list(folder?: string): AsyncIterable<HyperdriveEntry>;
    download(path: string): HyperdriveDownload;
    update(opts?: { wait?: boolean }): Promise<boolean>;
    findingPeers(): () => void;
    replicate(stream: unknown): unknown;
    close(): Promise<void>;
  }

  const Hyperdrive: new (store: Corestore, key?: Buffer) => Hyperdrive;
  export = Hyperdrive;
}

declare module "hyperswarm" {
  interface PeerDiscovery {
    flushed(): Promise<void>;
    refresh(opts?: { client?: boolean; server?: boolean }): Promise<void>;
    destroy(): Promise<void>;
  }

  interface Hyperswarm {
    connecting: number;
    connections: Set<unknown>;
    join(
      topic: Buffer,
      opts?: { server?: boolean; client?: boolean; limit?: number }
    ): PeerDiscovery;
    leave(topic: Buffer): Promise<void>;
    flush(): Promise<void>;
    on(
      event: "connection",
      listener: (socket: NodeJS.ReadWriteStream) => void
    ): this;
    destroy(opts?: { force?: boolean }): Promise<void>;
  }

  const Hyperswarm: new (opts?: {
    keyPair?: unknown;
    seed?: Buffer;
    maxPeers?: number;
    firewall?: (remotePublicKey: Buffer, payload: Buffer) => boolean;
  }) => Hyperswarm;
  export = Hyperswarm;
}
