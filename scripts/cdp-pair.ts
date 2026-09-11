// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CDP pairing smoke-test driver (TASK-3).
 *
 * Usage:
 *   bun scripts/cdp-pair.ts sender <file>    — instance A (port 5858)
 *   bun scripts/cdp-pair.ts receiver <file>  — instance B (port 5859)
 *
 * Both instances run with --remote-debugging-port (5858/5859) and
 * separate userData dirs. The sender seeds a file and writes the offer
 * JSON to a rendezvous file; the receiver reads it, joins the topic,
 * and verifies the transfer completes over the real peer connection.
 */

const RENDEZVOUS = "/tmp/rox-pair-offer.json";

interface CdpPage {
	type: string;
	url: string;
	webSocketDebuggerUrl: string;
}

interface CdpMessage {
	id?: number;
	result?: {
		result?: { value?: unknown };
		exceptionDetails?: { text: string; exception?: { description?: string } };
	};
}

async function connect(port: number): Promise<WebSocket> {
	const pages: CdpPage[] = await (
		await fetch(`http://localhost:${port}/json`)
	).json();
	const page = pages.find(
		(p) => p.type === "page" && p.url.startsWith("http://localhost:8888"),
	);
	if (!page) {
		throw new Error(`Rox renderer page not found on CDP port ${port}`);
	}
	const ws = new WebSocket(page.webSocketDebuggerUrl);
	await new Promise<void>((resolve, reject) => {
		ws.onopen = resolve;
		ws.onerror = () => reject(new Error("CDP websocket failed"));
	});
	return ws;
}

function wire(ws: WebSocket) {
	let nextId = 1;
	const pending = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (err: Error) => void }
	>();
	ws.onmessage = (event) => {
		const msg = JSON.parse(event.data as string) as CdpMessage;
		if (msg.id !== undefined && pending.has(msg.id)) {
			const p = pending.get(msg.id);
			pending.delete(msg.id);
			if (msg.result?.exceptionDetails) {
				p?.reject(
					new Error(
						msg.result.exceptionDetails.exception?.description ??
							msg.result.exceptionDetails.text,
					),
				);
			} else {
				p?.resolve(msg.result?.result?.value);
			}
		}
	};
	return {
		eval: (expression: string): Promise<unknown> => {
			const id = nextId++;
			return new Promise((resolve, reject) => {
				pending.set(id, { resolve, reject });
				ws.send(
					JSON.stringify({
						id,
						method: "Runtime.evaluate",
						params: {
							expression,
							awaitPromise: true,
							returnByValue: true,
						},
					}),
				);
			});
		},
	};
}

const mode = process.argv[2];
const filePath = process.argv[3] ?? "/tmp/rox-testfile.txt";

if (mode === "sender") {
	const ws = await connect(5858);
	const rpc = wire(ws);
	const result = await rpc.eval(`
    (async () => {
      const r = await window.ipc.transfer.sendFile(${JSON.stringify(filePath)});
      return r;
    })()
  `);
	console.log("SENDER_RESULT", JSON.stringify(result));
	await Bun.write(RENDEZVOUS, JSON.stringify(result));
	console.log("offer written to", RENDEZVOUS);
	ws.close();
} else if (mode === "receiver") {
	const offer = (await Bun.file(RENDEZVOUS).json()) as {
		ok: boolean;
		driveKey: string;
		topic: string;
	};
	if (!offer.ok) {
		throw new Error("sender failed to seed");
	}
	const ws = await connect(5859);
	const rpc = wire(ws);
	const result = await rpc.eval(`
    (async () => {
      const r = await window.ipc.transfer.receive(
        ${JSON.stringify(offer.driveKey)},
        ${JSON.stringify(offer.topic)},
      );
      return r;
    })()
  `);
	console.log("RECEIVER_RESULT", JSON.stringify(result));
	ws.close();
} else {
	console.error("usage: bun scripts/cdp-pair.ts <sender|receiver> [file]");
	process.exit(1);
}
