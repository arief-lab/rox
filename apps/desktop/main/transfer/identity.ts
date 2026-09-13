// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Device identity — the local display name used in pairing. Persisted
 * in userData; defaults to the OS hostname so pairing shows something
 * meaningful on first launch.
 */

import { hostname } from "node:os";
import Store from "electron-store";

const store = new Store<{ name: string }>({
	defaults: { name: hostname() || "My device" },
	name: "device-identity",
});

export function getDeviceName(): string {
	return store.get("name");
}

export function setDeviceName(name: string): void {
	store.set("name", name.slice(0, 64));
}
