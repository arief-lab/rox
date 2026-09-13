// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Recent-transfers history — persisted in userData via electron-store.
 * The session records an entry whenever a transfer completes (either
 * role); the renderer reads/clears it over IPC.
 */

import Store from "electron-store";

export interface TransferRecord {
	/** Byte size when known; 0 otherwise. */
	bytes: number;
	completedAt: number;
	direction: "receive" | "send";
	/** Peer-visible file name (basename of the transferred path). */
	name: string;
	/** Absolute local path (source on send, saved location on receive). */
	path: string;
	/** Display name of the paired device, when known at completion. */
	peerName?: string;
}

const MAX_RECORDS = 30;

const store = new Store<{ records: TransferRecord[] }>({
	defaults: { records: [] },
	name: "recent-transfers",
});

export function listTransfers(): TransferRecord[] {
	return store.get("records", []);
}

export function recordTransfer(record: TransferRecord): void {
	const records = listTransfers();
	records.unshift(record);
	store.set("records", records.slice(0, MAX_RECORDS));
}

export function clearTransfers(): void {
	store.set("records", []);
}
