import type { BrowserWindowConstructorOptions, Rectangle } from "electron";
import { BrowserWindow, screen } from "electron";
import Store from "electron-store";

export const createWindow = (
	windowName: string,
	options: BrowserWindowConstructorOptions,
): BrowserWindow => {
	const key = "window-state";
	const name = `window-state-${windowName}`;
	const store = new Store<Rectangle>({ name });
	const defaultSize = {
		height: options.height,
		width: options.width,
	};
	let state = {};

	const restore = () => store.get(key, defaultSize) as Rectangle;

	const getCurrentPosition = () => {
		const position = win.getPosition();
		const size = win.getSize();
		return {
			height: size[1],
			width: size[0],
			x: position[0],
			y: position[1],
		};
	};

	const windowWithinBounds = (windowState: Rectangle, bounds: Rectangle) =>
		windowState.x >= bounds.x &&
		windowState.y >= bounds.y &&
		windowState.x + windowState.width <= bounds.x + bounds.width &&
		windowState.y + windowState.height <= bounds.y + bounds.height;

	const resetToDefaults = () => {
		const bounds = screen.getPrimaryDisplay().bounds;
		const { height, width } = defaultSize;
		return {
			...defaultSize,
			x: (bounds.width - (width ?? 0)) / 2,
			y: (bounds.height - (height ?? 0)) / 2,
		};
	};

	const ensureVisibleOnSomeDisplay = (windowState: Rectangle) => {
		const visible = screen
			.getAllDisplays()
			.some((display) => windowWithinBounds(windowState, display.bounds));
		if (!visible) {
			// Window is partially or fully not visible now.
			// Reset it to safe defaults.
			return resetToDefaults();
		}
		return windowState;
	};

	const saveState = () => {
		if (!(win.isMinimized() || win.isMaximized())) {
			Object.assign(state, getCurrentPosition());
		}
		store.set(key, state);
	};

	state = ensureVisibleOnSomeDisplay(restore());

	const win = new BrowserWindow({
		...state,
		...options,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			...options.webPreferences,
		},
	});

	win.on("close", saveState);

	return win;
};
