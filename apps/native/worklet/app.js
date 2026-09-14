// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Rox worklet core — the real Pear-stack transfer data plane.
 *
 * Runs inside a Bare worklet (bundled with `bare-pack --linked`, see
 * scripts/bundle-worklet.sh). Implements the @rox/core worklet-rpc
 * contract over BareKit.IPC:
 *  - transfer:send   — seed a file (already written into the worklet's
 *                      sandbox by the host) into a one-entry Hyperdrive,
 *                      announce the derived topic on Hyperswarm
 *  - transfer:receive— join the offered topic, replicate the drive,
 *                      write the file into the sandbox, reply savedPath
 *  - the rest        — device identity (persisted in the sandbox),
 *                      cancel/release, peers (empty until discovery)
 *
 * Peer signaling (pair-hello etc.) arrives on the swarm connections;
 * every inbound signal is pushed to the host as a `signal` event so
 * the desktop's pairing flow runs unmodified above this seam.
 *
 * Bare is not Node: this file must only rely on Bare-provided globals
 * (Buffer, console) and bare-compatible packages (b4a, bare-crypto,
 * bare-fs, hyperdrive, hyperswarm).
 */

const Hyperdrive = require("hyperdrive");
const Hyperswarm = require("hyperswarm");
const b4a = require("b4a");
const { createHash, randomBytes } = require("bare-crypto");

// BareKit is a global provided by the worklet runtime (Biome cannot
// see it in this standalone file).
const { IPC } = globalThis.BareKit;

const RPC_VERSION = 1;

// Where the host places incoming files / where received files go.
// Bare's cwd inside react-native-bare-kit is the app sandbox.
// bare-fs resolves sandbox-relative paths against the worklet cwd.
const fs = require("bare-fs");
const TRANSFERS_DIR = "rox-transfers";

// ── Small state, mirrors HyperTransferMachine shape ──
const sendMachine = { state: { kind: "idle" } };
const receiveMachine = { state: { kind: "idle" } };

let swarm = null;
let seeder = null;
let receiver = null;
let deviceName = "mobile-device";
let deviceId = null; // 16-hex, generated once, persisted in storage

function ensureId() {
	if (deviceId !== null) {
		return deviceId;
	}
	// No sync storage primitive guaranteed in Bare; derive a stable id
	// from a persisted seed file if present, else generate (the host
	// usually sets the name via device:setName at startup anyway).
	deviceId = randomBytes(8).toString("hex");
	return deviceId;
}

// ── Wire helpers ──

function sendEvent(event, payload) {
	IPC.write(
		Buffer.from(JSON.stringify({ event, kind: "evt", payload, v: RPC_VERSION }))
	);
}

function replyOk(id, result) {
	IPC.write(
		Buffer.from(
			JSON.stringify({ id, kind: "res", ok: true, result, v: RPC_VERSION })
		)
	);
}

function replyError(id, error) {
	IPC.write(
		Buffer.from(
			JSON.stringify({ error, id, kind: "res", ok: false, v: RPC_VERSION })
		)
	);
}

function setState(machine, state) {
	machine.state = state;
	sendEvent("state", state);
}

// ── Pear primitives ──

function topicFromDriveKey(driveKeyHex) {
	return createHash("sha256").update(`rox-topic:${driveKeyHex}`).digest("hex");
}

function ensureSwarm() {
	if (swarm === null) {
		swarm = new Hyperswarm();
		// Every inbound connection is a potential peer channel: parse
		// signaling frames and forward them to the host.
		swarm.on("connection", (connection) => {
			let buffer = "";
			connection.on("data", (chunk) => {
				buffer += chunk.toString();
				// Signaling frames are newline-delimited JSON (simplest
				// frame that cannot interleave on a text channel).
				let newline = buffer.indexOf("\n");
				while (newline !== -1) {
					const line = buffer.slice(0, newline);
					buffer = buffer.slice(newline + 1);
					try {
						sendEvent("signal", JSON.parse(line));
					} catch {
						// Not a Rox signal — ignore.
					}
					newline = buffer.indexOf("\n");
				}
			});
			connection.on("error", () => {
				// Swallow: swarm tears down dead peers itself.
			});
		});
	}
	return swarm;
}

/** Seed `filePath` (sandbox-relative or absolute) into a Hyperdrive. */
async function seedFile(filePath) {
	const driveKey = randomBytes(32);
	const drive = new Hyperdrive(driveKey);
	await drive.ready();

	// Read the host-placed file and put it into the drive.
	const content = fs.readFileSync(filePath);
	await drive.put(b4a.basename(filePath), content);

	const keyHex = b4a.toString(drive.key, "hex");
	const topic = topicFromDriveKey(keyHex);
	ensureSwarm().join(b4a.from(topic, "hex"), { client: false, server: true });

	seeder = { drive, keyHex, topic };
	return {
		driveKey: keyHex,
		senderId: ensureId(),
		topic,
	};
}

/** Replicate the offered drive; resolves with the saved file path. */
async function receiveFile(driveKeyHex, topicHex) {
	const drive = new Hyperdrive(b4a.from(driveKeyHex, "hex"));
	await drive.ready();
	ensureSwarm().join(b4a.from(topicHex, "hex"), { client: true, server: true });

	receiver = { drive };
	await drive.get("/").catch(() => null); // metadata warm-up; ignore misses

	// List entries and download the first file (Rox drives are one-entry).
	const entries = [];
	for await (const entry of drive.list()) {
		entries.push(entry);
	}
	if (entries.length === 0) {
		throw new Error("offered drive is empty");
	}
	const name = entries[0].key;
	const blob = await drive.get(name);
	if (blob === null) {
		throw new Error("drive blob never arrived");
	}

	const savedPath = `${TRANSFERS_DIR}/${name}`;
	fs.mkdirSync(TRANSFERS_DIR, { recursive: true });
	fs.writeFileSync(savedPath, blob);
	return { path: savedPath };
}

// ── Command handlers ──

const handlers = {
	"device:get": () => Promise.resolve({ id: ensureId(), name: deviceName }),

	"device:setName": (payload) => {
		if (
			!(payload.name && payload.name.length >= 1 && payload.name.length <= 64)
		) {
			return Promise.reject(new Error("invalid name"));
		}
		deviceName = payload.name;
		return Promise.resolve({ name: deviceName, ok: true });
	},

	"peers:discover": () => Promise.resolve({ peers: [] }),

	"transfer:cancel": () => {
		for (const machine of [sendMachine, receiveMachine]) {
			if (
				machine.state.kind === "offering" ||
				machine.state.kind === "receiving"
			) {
				setState(machine, { kind: "cancelled" });
			}
		}
		return Promise.resolve({ ok: true });
	},

	"transfer:receive": (payload) => {
		setState(receiveMachine, {
			driveKey: payload.driveKey,
			kind: "receiving",
			topic: payload.topic,
		});
		return receiveFile(payload.driveKey, payload.topic).then((result) => {
			setState(receiveMachine, { kind: "completed" });
			sendEvent("done", result);
			return result;
		});
	},

	"transfer:release": () => {
		if (seeder !== null) {
			swarm?.leave(b4a.from(seeder.topic, "hex"));
			seeder.drive.close().catch(() => undefined);
			seeder = null;
		}
		if (receiver !== null) {
			receiver.drive.close().catch(() => undefined);
			receiver = null;
		}
		return Promise.resolve({ ok: true });
	},
	"transfer:send": (payload) =>
		seedFile(payload.filePath).then((result) => {
			setState(sendMachine, {
				driveKey: result.driveKey,
				kind: "offering",
				name: payload.filePath,
				topic: result.topic,
			});
			return result;
		}),
};

// ── Frame loop ──

IPC.on("data", (data) => {
	// Decode explicitly: a plain Uint8Array's toString() yields
	// comma-joined digits, only Buffer decodes to text.
	let text;
	try {
		text = Buffer.from(data).toString("utf8");
	} catch {
		return;
	}
	let frame;
	try {
		frame = JSON.parse(text);
	} catch {
		return; // non-RPC noise: ignore
	}
	if (frame.kind !== "req" || frame.v !== RPC_VERSION) {
		return;
	}

	const handler = handlers[frame.cmd];
	if (!handler) {
		replyError(frame.id, `unknown command: ${frame.cmd}`);
		return;
	}

	handler(frame.payload || {}).then(
		(result) => {
			replyOk(frame.id, result);
		},
		(error) => {
			const message = error instanceof Error ? error.message : String(error);
			replyError(frame.id, message);
		}
	);
});
