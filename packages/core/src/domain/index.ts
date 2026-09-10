// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Domain index — the public surface of the transfer domain.
 *
 * Two transfer paths:
 * - `hyper`   — Pear/Hyperdrive path: bulk data via drive replication,
 *               Transport carries signaling only. Used by the desktop
 *               (Nextron) flagship client.
 * - `webrtc`  — chunked path: bulk data framed through the Transport
 *               port itself. Used where Hypercore cannot run
 *               (DataChannel transports, e.g. native).
 *
 * Consumers (adapters, app layers) import from here; nothing outside
 * this package may reach into domain internals directly.
 */

export * from "./hyper";
export * from "./webrtc";
