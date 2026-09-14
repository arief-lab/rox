// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Worklet host — owns the Bare worklet lifecycle in the RN app.
 *
 * The worklet is the native data plane (the equivalent of the desktop
 * main process's transfer/ modules): Pear-stack code runs there, the
 * UI talks to it over IPC. This module keeps a single worklet instance
 * alive, wires OS background/foreground to worklet.suspend()/resume()
 * (the worklet MUST stop all I/O when backgrounded or the OS kills
 * it), and exposes the IPC surface for transport adapters.
 */

// Bare-shaped Buffer for the UI side of IPC (b4a). The worklet side
// uses its own global Buffer — Bare is not Node but ships Buffer.
import b4a from "b4a";
import { AppState, type AppStateStatus } from "react-native";
import { Worklet } from "react-native-bare-kit";

// Prefer the real Pear-stack bundle (bare-pack output, see scripts/
// bundle-worklet.sh and worklet/app.js). Metro serves .mjs as an asset;
// the import yields the file's URI. If the bundle is missing (fresh
// checkout before the script ran), fall back to the inlined echo/RPC
// source so the app still boots.
let workletBundleUri: string | null = null;
try {
	// Metro statically resolves this require; the file is committed.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	workletBundleUri = require("./worklet.bundle.mjs");
} catch {
	// No bundle yet — the fallback source keeps the bridge alive.
}

// The fallback core source is inlined as a template string so Metro
// ships it without any loader plugin (no ?raw convention in Metro).
import { CORE_SOURCE } from "./worklet-core-source";

let worklet: Worklet | null = null;
let started = false;

/** Which core is loaded: the real Pear bundle or the fallback stub. */
export const coreMode: "bundle" | "fallback" =
	workletBundleUri === null ? "fallback" : "bundle";

/** Start the worklet once; subsequent calls are no-ops. */
export function ensureWorklet(): Worklet {
	if (worklet !== null && started) {
		return worklet;
	}
	worklet = new Worklet();
	if (workletBundleUri === null) {
		worklet.start("/app.js", CORE_SOURCE);
	} else {
		worklet.start("/app.bundle", workletBundleUri);
	}
	started = true;

	// Suspension contract: stop all worklet I/O when the app
	// backgrounds; resume on foreground. See TASK-6 AC #5.
	const handleState = (status: AppStateStatus): void => {
		if (worklet === null) {
			return;
		}
		if (status === "active") {
			worklet.resume();
		} else if (status === "background") {
			worklet.suspend();
		}
	};
	// The subscription lives for the app's lifetime; the worklet singleton
	// is never torn down, so no removal is needed.
	AppState.addEventListener("change", handleState);

	return worklet;
}

/**
 * One-shot echo probe: sends `message` to the worklet and resolves
 * with the reply. Used by the dev screen to prove the bridge. IPC is
 * a streamx Duplex, so 'data' events carry Uint8Array chunks.
 */
export function workletEcho(message: string): Promise<string> {
	const instance = ensureWorklet();
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			instance.IPC.removeListener?.("data", onData);
			reject(new Error("worklet echo timed out"));
		}, 5000);
		const onData = (data: unknown): void => {
			if (!(data instanceof Uint8Array)) {
				return;
			}
			clearTimeout(timeout);
			instance.IPC.removeListener?.("data", onData);
			resolve(b4a.toString(data));
		};
		instance.IPC.on("data", onData);
		instance.IPC.write(b4a.from(message));
	});
}
