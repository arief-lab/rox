// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Trusted devices — devices the user has explicitly accepted during a
 * pairing handshake. Persisted in userData; a hello from a trusted id
 * auto-accepts so confirmed pairs skip the confirmation step on the
 * next transfer. Trust is per device id, never per topic.
 */

import Store from "electron-store";

export interface TrustedDevice {
	/** 16-hex device id fingerprint. */
	id: string;
	/** Last-seen display name (kept fresh on every hello). */
	name: string;
	/** Epoch ms of the most recent acceptance. */
	trustedAt: number;
}

const MAX_TRUSTED = 50;

const store = new Store<{ devices: TrustedDevice[] }>({
	defaults: { devices: [] },
	name: "trusted-devices",
});

export function listTrustedDevices(): TrustedDevice[] {
	return store.get("devices");
}

export function isTrustedDevice(id: string): boolean {
	return store.get("devices").some((device) => device.id === id);
}

/** Record (or refresh) trust for a device, keeping the list capped. */
export function trustDevice(id: string, name: string): void {
	const devices = store.get("devices").filter((device) => device.id !== id);
	devices.unshift({ id, name, trustedAt: Date.now() });
	store.set("devices", devices.slice(0, MAX_TRUSTED));
}

export function untrustDevice(id: string): boolean {
	const devices = store.get("devices");
	const next = devices.filter((device) => device.id !== id);
	if (next.length === devices.length) {
		return false;
	}
	store.set("devices", next);
	return true;
}
