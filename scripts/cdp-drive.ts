// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CDP smoke-test driver for the Rox desktop transfer slice.
 *
 * Usage: bun scripts/cdp-drive.ts
 * Requires the app running with --remote-debugging-port=5858.
 *
 * Drives the send flow (transfer:sendFile) directly through the IPC
 * bridge exposed by the preload script — the same surface the renderer
 * UI calls — and prints transfer events as they arrive.
 */

const DEBUG_PORT = 5858;

interface CdpPage {
	type: string;
	url: string;
	webSocketDebuggerUrl: string;
}

interface CdpMessage {
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
	result?: {
		result?: { value?: unknown; type?: string; subtype?: string };
		exceptionDetails?: { text: string; exception?: { description?: string } };
	};
}

const pages: CdpPage[] = await (
	await fetch(`http://localhost:${DEBUG_PORT}/json`)
).json();
const page = pages.find(
	(p) => p.type === "page" && p.url.startsWith("http://localhost:8888")
);
if (!page) {
	throw new Error("Rox renderer page not found on CDP");
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => {
	ws.onopen = resolve;
	ws.onerror = () => reject(new Error("CDP websocket failed"));
});

let nextId = 1;
const pending = new Map<
	number,
	{
		resolve: (value: CdpMessage["result"]) => void;
		reject: (err: Error) => void;
	}
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
						msg.result.exceptionDetails.text
				)
			);
		} else {
			p?.resolve(msg.result);
		}
	}
};

function send(
	method: string,
	params: Record<string, unknown>
): Promise<CdpMessage["result"]> {
	const id = nextId;
	nextId += 1;
	return new Promise((resolve, reject) => {
		pending.set(id, { reject, resolve });
		ws.send(JSON.stringify({ id, method, params }));
	});
}

async function evalJs<T>(expression: string): Promise<T> {
	const result = await send("Runtime.evaluate", {
		awaitPromise: true,
		expression,
		returnByValue: true,
	});
	return result?.result?.value as T;
}

// Collect transfer events in the page and drive a self-transfer.
const driveScript = `
(async () => {
  const log = [];
  const ipc = window.ipc;
  if (!ipc?.transfer) return { error: "ipc.transfer bridge missing" };

  const events = [];
  const unsub = ipc.transfer.onEvent((e) => events.push(e));

  const filePath = "/tmp/rox-testfile.txt";

  // Seed the file.
  const sendResult = await ipc.transfer.sendFile(filePath);
  if (!sendResult.ok) return { error: "sendFile failed: " + sendResult.error, events };
  log.push("sendFile ok");
  const { driveKey, topic } = sendResult;

  // Wait for the offering state event.
  await new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const offered = events.some((e) => e.type === "state" && e.kind === "offering");
      const failed = events.some((e) => e.type === "error");
      if (offered) { clearInterval(timer); resolve(); }
      else if (failed) { clearInterval(timer); reject(new Error("seed failed: " + JSON.stringify(events))); }
      else if (Date.now() - start > 15000) { clearInterval(timer); reject(new Error("timeout waiting for offer; events=" + JSON.stringify(events))); }
    }, 250);
  });
  log.push("offering phase reached");

  // Self-receive through the same process (LocalTransport wiring).
  await ipc.transfer.receive(driveKey, topic);
  log.push("receive called");

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const done = events.some((e) => e.type === "state" && e.kind === "completed") || events.some((e) => e.type === "done");
      const failed = events.some((e) => e.type === "error");
      if (done) { clearInterval(timer); resolve(); }
      else if (failed) { clearInterval(timer); reject(new Error("receive failed: " + JSON.stringify(events))); }
      else if (Date.now() - start > 30000) { clearInterval(timer); reject(new Error("timeout waiting for completion; events=" + JSON.stringify(events))); }
    }, 250);
  });

  unsub();
  return { log, events };
})()
`;

console.log("Driving transfer via IPC bridge...");
try {
	const result = await evalJs<Record<string, unknown>>(driveScript);
	console.log(JSON.stringify(result, null, 2));
} finally {
	ws.close();
}
