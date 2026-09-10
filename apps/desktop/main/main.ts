import path from "node:path";
import { app, ipcMain } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers/create-window";
import { registerTransferHandlers } from "./transfer/session";

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
	serve({ directory: "app" });
} else {
	app.setPath("userData", `${app.getPath("userData")} (development)`);
}

(async () => {
	await app.whenReady();

	const mainWindow = createWindow("main", {
		height: 600,
		webPreferences: {
			preload: path.join(import.meta.dirname, "preload.js"),
		},
		width: 1000,
	});

	registerTransferHandlers(mainWindow);

	if (isProd) {
		await mainWindow.loadURL("app://./home");
	} else {
		const port = process.argv[2];
		await mainWindow.loadURL(`http://localhost:${port}/home`);
		mainWindow.webContents.openDevTools();
	}
})();

app.on("window-all-closed", () => {
	app.quit();
});

ipcMain.on("message", async (event, arg) => {
	event.reply("message", `${arg} World!`);
});
