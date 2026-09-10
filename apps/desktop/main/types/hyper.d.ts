// Ambient declarations for the Pear-stack modules (they ship no types).
declare module "corestore" {
	interface Corestore {
		close(): Promise<void>;
		replicate(...args: unknown[]): unknown;
		[key: string]: unknown;
	}
	const Corestore: {
		new (dir: string): Corestore;
	};
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
		destroy(): void;
		done(): Promise<void>;
	}

	interface Hyperdrive {
		close(): Promise<void>;
		discoveryKey: Buffer;
		download(path: string): HyperdriveDownload;
		entry(path: string): Promise<HyperdriveEntry | null>;
		findingPeers(): () => void;
		get(path: string): Promise<Buffer | null>;
		key: Buffer;
		list(folder?: string): AsyncIterable<HyperdriveEntry>;
		put(path: string, data: Buffer | NodeJS.ReadableStream): Promise<void>;
		ready(): Promise<void>;
		replicate(stream: unknown): unknown;
		update(opts?: { wait?: boolean }): Promise<boolean>;
		writable: boolean;
	}

	const Hyperdrive: new (store: Corestore, key?: Buffer) => Hyperdrive;
	export = Hyperdrive;
}

declare module "hyperswarm" {
	interface PeerDiscovery {
		destroy(): Promise<void>;
		flushed(): Promise<void>;
		refresh(opts?: { client?: boolean; server?: boolean }): Promise<void>;
	}

	interface Hyperswarm {
		connecting: number;
		connections: Set<unknown>;
		destroy(opts?: { force?: boolean }): Promise<void>;
		flush(): Promise<void>;
		join(
			topic: Buffer,
			opts?: { server?: boolean; client?: boolean; limit?: number },
		): PeerDiscovery;
		leave(topic: Buffer): Promise<void>;
		on(
			event: "connection",
			listener: (socket: NodeJS.ReadWriteStream) => void,
		): this;
	}

	const Hyperswarm: new (opts?: {
		keyPair?: unknown;
		seed?: Buffer;
		maxPeers?: number;
		firewall?: (remotePublicKey: Buffer, payload: Buffer) => boolean;
	}) => Hyperswarm;
	export = Hyperswarm;
}
