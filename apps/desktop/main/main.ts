import { homedir } from "node:os";
import path from "node:path";
import { app, clipboard, dialog, ipcMain, Menu } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers/create-window";
import { registerTransferHandlers } from "./transfer/session";

const isProd = process.env.NODE_ENV === "production";

// ── Offer clipboard access ────────────────────────────
// The renderer pushes the current offer payload when the send wizard's
// offer step is active; the main process owns the native context menu
// and the Ctrl+Shift+C accelerator.

let currentOfferPayload: string | null = null;

ipcMain.on("offer:payload", (_event, payload: string | null) => {
	currentOfferPayload = typeof payload === "string" ? payload : null;
});

const COPY_OFFER_LABEL = "Copy Rox offer";

/** Copy the current offer payload to the system clipboard. */
const copyOfferToClipboard = (): void => {
	if (currentOfferPayload === null) {
		return;
	}
	clipboard.writeText(currentOfferPayload);
};

/**
 * Native affordances for the offer payload: a context-menu item (shown
 * anywhere in the window while an offer exists) and the accelerator.
 * Right-click without an active offer falls back to the standard
 * spellcheck/edit menu behavior.
 */
const setupOfferClipboard = (win: Electron.BrowserWindow): void => {
	win.webContents.on("context-menu", () => {
		if (currentOfferPayload === null) {
			return;
		}
		Menu.buildFromTemplate([
			{
				click: copyOfferToClipboard,
				label: COPY_OFFER_LABEL,
			},
		]).popup({ window: win });
	});

	win.webContents.on("before-input-event", (event, input) => {
		if (
			input.type === "keyDown" &&
			input.control &&
			input.shift &&
			!input.alt &&
			!input.meta &&
			input.key.toLowerCase() === "c" &&
			currentOfferPayload !== null
		) {
			event.preventDefault();
			copyOfferToClipboard();
		}
	});
};

// ROX_USER_DATA_SUFFIX isolates instances (e.g. two-instance pairing smoke
// tests) so Corestore dirs never collide. Works in dev and prod alike.
const suffix = process.env.ROX_USER_DATA_SUFFIX
	? ` ${process.env.ROX_USER_DATA_SUFFIX}`
	: "";
if (isProd) {
	if (suffix) {
		app.setPath("userData", `${app.getPath("userData")}${suffix}`);
	}
	serve({ directory: "app" });
} else {
	app.setPath("userData", `${app.getPath("userData")} (development)${suffix}`);
}

const NUMERIC_ARG = /^\d+$/;

(async () => {
	await app.whenReady();

	const mainWindow = createWindow("main", {
		height: 560,
		// Compact single-purpose utility window; resizable but small by default.
		maxHeight: 800,
		maxWidth: 1100,
		minHeight: 480,
		minWidth: 620,
		webPreferences: {
			preload: path.join(import.meta.dirname, "preload.js"),
		},
		width: 760,
	});

	registerTransferHandlers(mainWindow);
	setupOfferClipboard(mainWindow);

	if (isProd) {
		await mainWindow.loadURL("app://./home");
	} else {
		// `electron . 8888` puts the port AFTER the app path, so scan argv
		// for the first numeric arg (nextron passes `electron . <port>`).
		const port = process.argv.find((arg) => NUMERIC_ARG.test(arg)) ?? "8888";
		await mainWindow.loadURL(`http://localhost:${port}/home`);
		mainWindow.webContents.openDevTools();
	}
})();

app.on("window-all-closed", () => {
	app.quit();
});

/** Common search roots — keeps queries fast and results relevant. */
const searchRoots = (): string[] => [
	path.join(homedir(), "Documents"),
	path.join(homedir(), "Downloads"),
	path.join(homedir(), "Desktop"),
	app.getPath("home"),
];

const MAX_SEARCH_RESULTS = 12;

/**
 * Recursive filename search under a root, depth-limited. Name match is
 * case-insensitive substring. Silent on unreadable dirs (permissions,
 * symlinks) — search is best-effort.
 */
async function searchDir(
	root: string,
	query: string,
	depth: number,
	out: string[]
): Promise<void> {
	if (out.length >= MAX_SEARCH_RESULTS || depth > 4) {
		return;
	}
	let entries: import("node:fs").Dirent[];
	try {
		entries = await import("node:fs/promises").then((fs) =>
			fs.readdir(root, { withFileTypes: true })
		);
	} catch {
		return;
	}
	for (const entry of entries) {
		if (out.length >= MAX_SEARCH_RESULTS) {
			return;
		}
		const full = path.join(root, entry.name);
		if (entry.name.toLowerCase().includes(query)) {
			out.push(full);
		}
		if (entry.isDirectory() && !entry.name.startsWith(".")) {
			// Depth-first traversal must stay sequential so results arrive
			// in a stable order and the MAX_SEARCH_RESULTS cap applies.
			// biome-ignore lint/performance/noAwaitInLoops: sequential recursion is intentional
			await searchDir(full, query, depth + 1, out);
		}
	}
}

// File discovery for the send wizard: search by name fragment or pick
// via the native open dialog.
ipcMain.handle("files:search", async (_event, query: string) => {
	const trimmed = query.trim().toLowerCase();
	if (trimmed.length < 2) {
		return { ok: true as const, results: [] };
	}
	const results: string[] = [];
	for (const root of searchRoots()) {
		// biome-ignore lint/performance/noAwaitInLoops: sequential so the result cap short-circuits across roots
		await searchDir(root, trimmed, 0, results);
		if (results.length >= MAX_SEARCH_RESULTS) {
			break;
		}
	}
	return { ok: true as const, results: results.slice(0, MAX_SEARCH_RESULTS) };
});

ipcMain.handle("files:browse", async () => {
	const result = await dialog.showOpenDialog({
		properties: ["openFile"],
		title: "Choose a file to send",
	});
	if (result.canceled || result.filePaths.length === 0) {
		return { ok: true as const, path: null };
	}
	return { ok: true as const, path: result.filePaths[0] };
});

ipcMain.on("message", (event, arg) => {
	event.reply("message", `${arg} World!`);
});
