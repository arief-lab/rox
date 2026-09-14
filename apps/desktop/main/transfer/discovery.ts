// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Device discovery — presence tracking over the well-known discovery
 * topic.
 *
 * Every Rox instance joins DISCOVERY_TOPIC while the app is open. Each
 * connection on that topic is a real peer connection handled by the
 * session (hello, pairing, offers) exactly like a transfer connection;
 * this module additionally listens on the same ProtomuxTransport to
 * build the nearby-device list the renderer's picker shows. Identity
 * comes from the peer's `pair-hello`; liveness from
 * `pair-ping`/`pair-pong` heartbeats we send on an interval.
 */

import { encodeSignal } from "@rox/core";
import type { ProtomuxTransport } from "./protomux-transport";

/** How often discovered peers are pinged / pruned. */
export const PING_INTERVAL_MS = 5000;
/** A peer silent longer than this drops off the discovered list. */
export const PEER_TIMEOUT_MS = 15_000;

export interface DiscoveredPeer {
	id: string;
	lastSeen: number;
	name: string;
	/** True when the id is on the persisted trust list. */
	trusted: boolean;
}

interface TrackedConnection {
	/** Remote identity, present once their hello arrived. */
	identity: { id: string; name: string } | null;
}
export class DiscoveryTracker {
	private readonly connections = new Map<
		ProtomuxTransport,
		TrackedConnection
	>();
	private readonly peers = new Map<string, DiscoveredPeer>();
	private readonly unsubs: (() => void)[] = [];
	private readonly isTrusted: (id: string) => boolean;

	constructor(isTrusted: (id: string) => boolean) {
		this.isTrusted = isTrusted;
	}

	/**
	 * Track a peer connection for presence. The session still drives
	 * pairing/transfers over this transport; we only observe messages
	 * here, so this is safe to call for every incoming connection.
	 */
	track(peer: ProtomuxTransport): void {
		if (this.connections.has(peer)) {
			return;
		}
		const connection: TrackedConnection = { identity: null };
		this.connections.set(peer, connection);

		const offMessage = peer.onmessage((event) => {
			if (typeof event.data === "string") {
				this.handleMessage(connection, event.data);
			}
		});
		const offClose = peer.onclose(() => {
			this.untrack(peer);
		});
		this.unsubs.push(offMessage, offClose);
	}

	/** Remove a connection; its device leaves the list unless re-helloed. */
	untrack(peer: ProtomuxTransport): void {
		const connection = this.connections.get(peer);
		if (!connection) {
			return;
		}
		this.connections.delete(peer);
		if (connection.identity) {
			this.peers.delete(connection.identity.id);
		}
	}

	/** Send `pair-ping` to every tracked connection. */
	pingAll(localId: string): void {
		for (const peer of this.connections.keys()) {
			try {
				peer.send(encodeSignal({ deviceId: localId, type: "pair-ping" }));
			} catch {
				// A closing transport prunes itself via onclose.
			}
		}
	}

	/** Drop peers whose last heartbeat/hello is older than the timeout. */
	prune(now: number, timeoutMs = PEER_TIMEOUT_MS): boolean {
		let changed = false;
		for (const [id, record] of this.peers) {
			if (now - record.lastSeen > timeoutMs) {
				this.peers.delete(id);
				changed = true;
			}
		}
		return changed;
	}

	/** Current snapshot of live, identified peers. */
	list(): DiscoveredPeer[] {
		return [...this.peers.values()];
	}

	/** Stop observing and clear all state (app teardown). */
	destroy(): void {
		for (const off of this.unsubs) {
			off();
		}
		this.unsubs.length = 0;
		this.connections.clear();
		this.peers.clear();
	}

	private handleMessage(connection: TrackedConnection, raw: string): void {
		let parsed: { deviceId?: unknown; name?: unknown; type?: unknown };
		try {
			parsed = JSON.parse(raw);
		} catch {
			return;
		}
		if (
			typeof parsed.deviceId !== "string" ||
			typeof parsed.type !== "string"
		) {
			return;
		}
		if (parsed.type === "pair-hello") {
			const name =
				typeof parsed.name === "string" && parsed.name.length > 0
					? parsed.name
					: "Unknown device";
			connection.identity = { id: parsed.deviceId, name };
			this.peers.set(parsed.deviceId, {
				id: parsed.deviceId,
				lastSeen: Date.now(),
				name,
				trusted: this.isTrusted(parsed.deviceId),
			});
		} else if (parsed.type === "pair-pong") {
			const record = this.peers.get(parsed.deviceId);
			if (record) {
				record.lastSeen = Date.now();
			}
		}
	}
}
