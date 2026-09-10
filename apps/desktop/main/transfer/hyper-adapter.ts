// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Hyperdrive adapter — the desktop Pear-stack transfer transport.
 *
 * Implements the Hyper path from @rox/core:
 *  - Sender: seeds a one-file Hyperdrive over Hyperswarm (server mode on
 *    the drive's discoveryKey), sends hyper-offer signaling over the
 *    Transport port, stops seeding on hyper-release.
 *  - Receiver: joins the offered topic (client mode), replicates the
 *    drive, downloads the blob, reports completion via hyper-accepted.
 *
 * The Transport port carries signaling only — bulk data flows through
 * Hyperdrive replication. The port's send/onmessage is reused as the
 * signaling channel so pairing code can stay transport-agnostic.
 */

import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
	encodeSignal,
	type HyperSignal,
	HyperTransferMachine,
	parseSignal,
	type Transport,
} from "@rox/core";
import Corestore from "corestore";
import Hyperdrive from "hyperdrive";
import Hyperswarm from "hyperswarm";

const STORAGE_DIR_NAME = "rox-transfers";

function toHex(buffer: Buffer): string {
	return buffer.toString("hex");
}

function topicFromDriveKey(driveKeyHex: string): string {
	// Derive a discovery topic from the drive key so the receiver only
	// needs the offer message to find the seeder.
	return createHash("sha256").update(`rox-topic:${driveKeyHex}`).digest("hex");
}

/**
 * Sender side: seed a local file into a one-entry Hyperdrive and
 * announce it on Hyperswarm. Resolves with the drive key once the
 * topic is announced and ready to share.
 */
export class HyperSeeder {
	private readonly store: Corestore;
	private readonly swarm: Hyperswarm;
	private machine = new HyperTransferMachine();
	private drive: Hyperdrive | null = null;
	private driveKey: string | null = null;

	constructor(
		storageDir: string,
		private readonly transport: Transport,
	) {
		this.store = new Corestore(path.join(storageDir, STORAGE_DIR_NAME));
		this.swarm = new Hyperswarm();
		this.swarm.on("connection", (socket: NodeJS.ReadWriteStream) => {
			if (!this.drive) {
				return;
			}
			this.drive.replicate(socket as never);
		});
	}

	/** Seed `filePath` into a fresh drive; resolves once announced. */
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

		this.driveKey = toHex(this.drive.key);
		const topic = topicFromDriveKey(this.driveKey);
		const discovery = this.swarm.join(Buffer.from(topic, "hex"), {
			client: false,
			server: true,
		});
		await discovery.flushed();

		this.machine.startOffering(this.driveKey, topic, fileName);
		this.transport.send(
			encodeSignal({
				driveKey: this.driveKey,
				name: fileName,
				topic,
				type: "hyper-offer",
			}),
		);

		return { driveKey: this.driveKey, topic };
	}

	/** Stop announcing and close the drive after the receiver releases it. */
	async release(): Promise<void> {
		this.machine.complete();
		const topic = this.driveKey ? topicFromDriveKey(this.driveKey) : null;
		if (topic) {
			await this.swarm.leave(Buffer.from(topic, "hex"));
		}
	}

	async destroy(): Promise<void> {
		await this.swarm.destroy();
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
 * Receiver side: join the offered topic, replicate the drive, download
 * the blob into `destDir`, then signal hyper-accepted + hyper-release.
 */
export class HyperReceiver {
	private readonly store: Corestore;
	private readonly swarm: Hyperswarm;
	private machine = new HyperTransferMachine();
	private drive: Hyperdrive | null = null;

	constructor(
		storageDir: string,
		private readonly transport: Transport,
	) {
		this.store = new Corestore(path.join(storageDir, STORAGE_DIR_NAME, "recv"));
		this.swarm = new Hyperswarm();
	}

	/** Start receiving the offered drive; resolves with the saved file path. */
	async receive(
		driveKey: string,
		topic: string,
		destDir: string,
	): Promise<string> {
		this.machine.startReceiving(driveKey, topic);

		this.drive = new Hyperdrive(this.store, Buffer.from(driveKey, "hex"));
		await this.drive.ready();

		const doneFindingPeers = this.drive.findingPeers();
		this.swarm.on("connection", (socket: NodeJS.ReadWriteStream) => {
			if (!this.drive) {
				return;
			}
			this.drive.replicate(socket as never);
		});
		this.swarm.join(Buffer.from(topic, "hex"), {
			client: true,
			server: false,
		});
		await this.swarm.flush();
		doneFindingPeers();

		await this.drive.update({ wait: true });
		const entries: { key: string }[] = [];
		for await (const entry of this.drive.list("/")) {
			entries.push(entry);
		}
		if (entries.length === 0) {
			throw new Error("Offered drive contains no files");
		}
		const entry = entries[0];
		if (!entry) {
			throw new Error("Offered drive contains no files");
		}

		const destPath = path.join(destDir, entry.key.replace(/^\//, ""));
		await this.drive.download(entry.key).done();
		const blob = await this.drive.get(entry.key);
		if (!blob) {
			throw new Error(`Failed to download blob for ${entry.key}`);
		}
		const { writeFile, mkdir } = await import("node:fs/promises");
		await mkdir(destDir, { recursive: true });
		await writeFile(destPath, blob);

		this.transport.send(encodeSignal({ driveKey, type: "hyper-accepted" }));
		this.transport.send(encodeSignal({ driveKey, type: "hyper-release" }));
		this.machine.complete();
		return destPath;
	}

	async destroy(): Promise<void> {
		await this.swarm.destroy();
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
	onSignal: (signal: HyperSignal) => void,
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
