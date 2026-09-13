// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Framework-agnostic design tokens shared across all clients.
 * Web consumes the CSS variables in `src/styles/globals.css` (which mirror
 * these values); native consumes this module directly.
 */

export const colors = {
	danger: "#f87171", // red-400 — errors
	receive: "#38bdf8", // sky-400 — receiving side accent
	receiveMuted: "#0c4a6e", // sky-900 — receiving-side surfaces
	send: "#34d399", // emerald-400 — sending side accent
	sendMuted: "#064e3b", // emerald-900 — sending-side surfaces
} as const;

export const radii = {
	lg: 14,
	md: 10,
	sm: 6,
} as const;

export const spacing = {
	lg: 24,
	md: 16,
	sm: 8,
	xl: 32,
	xs: 4,
} as const;

export const typography = {
	body: { fontSize: 14, fontWeight: "400" as const },
	caption: { fontSize: 12, fontWeight: "400" as const },
	mono: { fontFamily: "monospace", fontSize: 12, fontWeight: "400" as const },
	title: { fontSize: 20, fontWeight: "600" as const },
} as const;
