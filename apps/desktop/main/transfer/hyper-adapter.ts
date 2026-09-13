// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Hyperdrive adapter — the desktop Pear-stack transfer transport.
 *
 * Implements the Hyper path from @rox/core:
 *  - Sender: seeds a one-file Hyperdrive, announces the derived topic on
 *    the shared Hyperswarm, and attaches drive replication to every peer
 *    connection's Protomux. Signaling (hyper-offer/accepted/release)
 *    flows over the pairing channel the session owns.
 *  - Receiver: opens the offered drive and replicates it over the peer
 *    connection the session provides — same socket as the signaling,
 *    multiplexed by Protomux.
 *
 * Bulk data never flows through the Transport port: drive replication
 * attaches core replicators directly to the shared Protomux instance
 * (metadata core immediately; blobs core after the header download
 * opens it — the receiver waits for the drive's 'blobs' event).
 */

import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Transport } from "@rox/core";
import { type HyperSignal, HyperTransferMachine, parseSignal } from "@rox/core";
import Corestore from "corestore";
import Hyperdrive from "hyperdrive";
import type Protomux from "protomux";

const STORAGE_DIR_NAME = "rox-transfers";
const DOWNLOADS_DIR_NAME = "downloads";
const LEADING_SLASH_PATTERN = /^\//;

function toHex(buffer: Buffer): string {
	return buffer.toString("hex");
}

function topicFromDriveKey(driveKeyHex: string): string {
	// Derive a discovery topic from the drive key so the receiver only
	// needs the offer message to find the seeder.
	return createHash("sha256").update(`rox-topic:${driveKeyHex}`).digest("hex");
}

/**
 * Access the drive's blobs store, which the ambient Hyperdrive type does
 * not expose (it is a lazily-opened getter on the real class).
 */
function getBlobs(drive: Hyperdrive): Promise<unknown> {
	return (drive as unknown as { blobs: Promise<unknown> }).blobs;
}

/** Byte-level transfer progress payload surfaced to the renderer. */
export interface ProgressSample {
	bytes: number;
	total: number;
}

/**
 * Resolve the blobs core and sum peer byte counters (uploaded or
 * downloaded across all peers). Returns null while the blobs core is
 * unavailable. Reading peer stats needs a cast — the ambient types
 * ship none.
 */
async function peerBytes(
	drive: Hyperdrive,
	direction: "uploadedBytes" | "downloadedBytes"
): Promise<number | null> {
	const blobs = (await getBlobs(drive).catch(() => null)) as {
		core: {
			peers?: Iterable<{
				stats?: { [key: string]: number | undefined };
			}>;
		};
	} | null;
	if (!blobs) {
		return null;
	}
	let sum = 0;
	for (const peer of blobs.core.peers ?? []) {
		sum += peer.stats?.[direction] ?? 0;
	}
	return sum;
}

/**
 * Attach a drive's core replicators to a shared Protomux. The metadata
 * core attaches immediately; the blobs core must wait until the drive's
 * header has been downloaded (the 'blobs' event) — on the sender it is
 * open after the first put, so it attaches eagerly.
 */
async function attachDriveReplication(
	drive: Hyperdrive,
	mux: Protomux
): Promise<void> {
	const { core } = drive as unknown as {
		core: { replicator: { attachTo: (m: Protomux) => void } };
	};
	core.replicator.attachTo(mux);
	const blobs = (await getBlobs(drive)) as {
		core: { replicator: { attachTo: (m: Protomux) => void } };
	} | null;
	if (blobs) {
		blobs.core.replicator.attachTo(mux);
	}
}

/**
 * Sender side: seed a local file into a one-entry Hyperdrive, announce
 * the derived topic on the caller's Hyperswarm, and attach replication
 * to every peer connection the session hands over.
 */
export class HyperSeeder {
	private readonly store: Corestore;
	private readonly machine = new HyperTransferMachine();
	private drive: Hyperdrive | null = null;
	private driveKey: string | null = null;
	/** Size of the seeded file — the upload progress denominator. */
	private seedSize = 0;

	constructor(storageDir: string) {
		this.store = new Corestore(path.join(storageDir, STORAGE_DIR_NAME));
	}

	/** Seed `filePath` into a fresh drive; resolves once the drive is ready. */
	async seed(filePath: string): Promise<{ driveKey: string; topic: string }> {
		const info = await stat(filePath);
		if (!info.isFile()) {
			throw new Error(`Not a file: ${filePath}`);
		}

		this.drive = new Hyperdrive(this.store);
		await this.drive.ready();

		const fileName = path.basename(filePath);
		const drivePath = `/${fileName}`;
		// Hyperdrive's put expects a Buffer (a ReadStream is rejected at
		// runtime — files here are bounded by desktop use, so buffering
		// is acceptable; large-file streaming can move to drive.blobs
		// writing later if needed).
		const content = await readFile(filePath);
		await this.drive.put(drivePath, content);
		// Ensure the blobs core exists so replication can attach eagerly.
		await getBlobs(this.drive);
		this.seedSize = content.byteLength;

		this.driveKey = toHex(this.drive.key);
		const topic = topicFromDriveKey(this.driveKey);

		this.machine.startOffering(this.driveKey, topic, fileName);
		return { driveKey: this.driveKey, topic };
	}

	/**
	 * Announce the seeded drive's topic on the shared swarm. Server mode
	 * accepts incoming peers; client mode participates in lookups so LAN
	 * local discovery connects both sides even when both are behind the
	 * same NAT (the common desktop case).
	 */
	async joinSwarm(swarm: import("hyperswarm")): Promise<void> {
		if (!this.driveKey) {
			throw new Error("seed() must complete before joinSwarm()");
		}
		const topic = Buffer.from(topicFromDriveKey(this.driveKey), "hex");
		const discovery = swarm.join(topic, { client: true, server: true });
		await discovery.flushed();
	}

	/**
	 * Attach this seeder's drive replication to a peer connection's mux.
	 * Called by the session for every incoming connection; harmless when
	 * no drive is seeded yet (no-op).
	 */
	async attachReplication(mux: Protomux): Promise<void> {
		if (!this.drive) {
			return;
		}
		await attachDriveReplication(this.drive, mux);
	}

	/**
	 * Current upload progress: bytes replicated to peers vs file size.
	 * Note the counters are cumulative per peer, so with one receiver
	 * this equals bytes sent; multiple receivers can exceed the total
	 * (clamped by the session before display).
	 */
	async uploadProgress(): Promise<ProgressSample | null> {
		if (!(this.drive && this.seedSize > 0)) {
			return null;
		}
		const bytes = await peerBytes(this.drive, "uploadedBytes");
		if (bytes === null) {
			return null;
		}
		return { bytes: Math.min(bytes, this.seedSize), total: this.seedSize };
	}

	/** Stop announcing after the receiver releases the drive. */
	async release(): Promise<void> {
		await Promise.resolve();
		this.machine.complete();
	}

	async destroy(): Promise<void> {
		if (this.drive) {
			await this.drive.close();
		}
		await this.store.close();
	}

	getState() {
		return this.machine.getState();
	}
}

/**
 * Receiver side: replicate the offered drive over the peer connection
 * the session provides, download the blob into the downloads dir.
 */
export class HyperReceiver {
	private readonly store: Corestore;
	private readonly machine = new HyperTransferMachine();
	private drive: Hyperdrive | null = null;
	/** Size of the file being downloaded — the progress denominator. */
	private downloadSize = 0;

	constructor(storageDir: string) {
		this.store = new Corestore(path.join(storageDir, STORAGE_DIR_NAME, "recv"));
	}

	/**
	 * Receive the offered drive over an established peer connection.
	 * Replication attaches to the connection's Protomux — the signaling
	 * and the bulk data share one socket.
	 */
	async receiveViaConnection(
		driveKey: string,
		mux: Protomux,
		storageDir: string
	): Promise<string> {
		this.drive = new Hyperdrive(this.store, Buffer.from(driveKey, "hex"));
		await this.drive.ready();

		const doneFindingPeers = this.drive.findingPeers();
		await attachDriveReplication(this.drive, mux);

		await this.drive.update({ wait: true });
		doneFindingPeers();

		const entries: { key: string }[] = [];
		for await (const entry of this.drive.list("/")) {
			entries.push(entry);
		}
		const entry = entries.at(0);
		if (!entry) {
			throw new Error("Offered drive contains no files");
		}
		// Entry carries the blob length once the header is downloaded.
		this.downloadSize = (
			entry as unknown as { value: { blobByteLength: number } }
		).value.blobByteLength;

		const destDir = path.join(storageDir, DOWNLOADS_DIR_NAME);
		const destPath = path.join(
			destDir,
			entry.key.replace(LEADING_SLASH_PATTERN, "")
		);
		const download = this.drive.download(entry.key);
		await download.done();
		const blob = await this.drive.get(entry.key);
		if (!blob) {
			throw new Error(`Failed to download blob for ${entry.key}`);
		}
		await mkdir(destDir, { recursive: true });
		await writeFile(destPath, blob);
		return destPath;
	}

	/**
	 * Current download progress: bytes received from peers vs entry
	 * size. Returns null before the denominator is known or while the
	 * blobs core is unavailable.
	 */
	async downloadProgress(): Promise<ProgressSample | null> {
		if (!(this.drive && this.downloadSize > 0)) {
			return null;
		}
		const bytes = await peerBytes(this.drive, "downloadedBytes");
		if (bytes === null) {
			return null;
		}
		return {
			bytes: Math.min(bytes, this.downloadSize),
			total: this.downloadSize,
		};
	}

	async destroy(): Promise<void> {
		if (this.drive) {
			await this.drive.close();
		}
		await this.store.close();
	}

	getState() {
		return this.machine.getState();
	}
}

/**
 * Signaling pump: reads hyper-* messages arriving on the transport and
 * dispatches them to a handler. Used by the session layer to react to
 * receiver accepts/releases while seeding.
 */
export function pumpSignals(
	transport: Transport,
	onSignal: (signal: HyperSignal) => void
): () => void {
	return transport.onmessage((event) => {
		if (typeof event.data !== "string") {
			return;
		}
		if (!event.data.startsWith('{"type":"hyper-')) {
			return;
		}
		try {
			onSignal(parseSignal(event.data));
		} catch {
			// Malformed signals are ignored — signaling is best-effort.
		}
	});
}

/** Generate a fresh 32-byte hex id (used for session correlation). */
export function randomId(): string {
	return toHex(randomBytes(32));
}
