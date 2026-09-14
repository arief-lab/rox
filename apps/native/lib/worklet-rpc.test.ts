// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Worklet RPC seam tests: the host client against the real core-source
 * dispatcher through an in-memory IPC pair. The fake worklet evaluates
 * the same CORE_SOURCE the real worklet runs (minus BareKit globals,
 * which are shimmed), so the wire contract is exercised end-to-end.
 */

import { describe, expect, it } from "bun:test";

import { parseSignal, type Transport } from "@rox/core";

import { CORE_SOURCE } from "./worklet-core-source";
import { WorkletRpcClient } from "./worklet-rpc-client";

/**
 * Minimal in-memory duplex: what one side writes, the other's 'data'
 * handlers receive. Mirrors the worklet IPC semantics BareTransport
 * and the core source rely on.
 */
function ipcPair(): { host: FakeDuplex; worklet: FakeDuplex } {
	const host = new FakeDuplex();
	const worklet = new FakeDuplex();
	host.peer = worklet;
	worklet.peer = host;
	return { host, worklet };
}

class FakeDuplex {
	peer: FakeDuplex | null = null;
	private readonly listeners = new Set<(data: Uint8Array) => void>();

	on(event: string, handler: (data: Uint8Array) => void): void {
		if (event === "data") {
			this.listeners.add(handler);
		}
	}

	write(data: Uint8Array): void {
		for (const listener of this.peer?.listeners ?? []) {
			listener(data);
		}
	}
}

/** Full Transport-port facade over a FakeDuplex (open, never closes). */
function fakeTransport(duplex: FakeDuplex): Transport {
	return {
		close: () => undefined,
		closeReason: null,
		onclose: () => () => undefined,
		onmessage: (handler) => {
			duplex.on("data", (data) => {
				handler({ data: new TextDecoder().decode(data) });
			});
			return () => undefined;
		},
		send: (data) => {
			if (typeof data !== "string") {
				throw new Error("fake transport carries strings only");
			}
			duplex.write(new TextEncoder().encode(data));
		},
		state: "open",
	};
}

function makeWorklet(): WorkletRpcClient {
	const { host, worklet } = ipcPair();

	// Run the actual core source with BareKit shimmed to the worklet
	// side of the pair. Function constructor keeps the eval local and
	// makes the ambient globals explicit.
	const shim = new Function("BareKit", CORE_SOURCE);
	shim({ IPC: worklet });

	return new WorkletRpcClient(fakeTransport(host));
}

describe("worklet rpc seam", () => {
	it("round-trips device:get", async () => {
		const client = makeWorklet();
		const device = (await (
			client as never as {
				call: (cmd: string) => Promise<{ id: string; name: string }>;
			}
		).call("device:get")) as never as { id: string; name: string };
		expect(device.id).toBe("0000000000000000");
		expect(device.name).toBe("android-device");
	});

	it("rejects unknown commands with an error reply", async () => {
		const client = makeWorklet();
		await expect(
			(
				client as never as {
					call: (cmd: string) => Promise<unknown>;
				}
			).call("transfer:explode")
		).rejects.toThrow("unknown command");
	});

	it("surfaces command failures as rejected calls", async () => {
		const client = makeWorklet();
		await expect(
			client.receive("a".repeat(64), "b".repeat(64))
		).rejects.toThrow("replication not wired yet");
	});

	it("pushes state events when a command starts a transfer", async () => {
		const client = makeWorklet();
		const states: unknown[] = [];
		client.onState((state) => {
			states.push(state);
		});
		await expect(
			client.receive("a".repeat(64), "b".repeat(64))
		).rejects.toThrow();
		expect(states).toHaveLength(1);
		expect((states[0] as { kind: string }).kind).toBe("receiving");
	});

	it("cancel reports ok and emits the cancelled state", async () => {
		const client = makeWorklet();
		const states: unknown[] = [];
		client.onState((state) => {
			states.push(state);
		});
		await client.receive("a".repeat(64), "b".repeat(64)).catch(() => null);
		await client.cancel();
		const kinds = states.map((state) => (state as { kind: string }).kind);
		expect(kinds).toContain("receiving");
		expect(kinds).toContain("cancelled");
	});

	it("signal events parse as HyperSignals on the host", () => {
		// The worklet pushes signaling through the 'signal' event with a
		// JSON string payload; the client pipes it into parseSignal.
		const signal = parseSignal(
			JSON.stringify({
				deviceId: "a".repeat(16),
				name: "peer",
				type: "pair-hello",
			})
		);
		expect(signal.type).toBe("pair-hello");
	});
});
