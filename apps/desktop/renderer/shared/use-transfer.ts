"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * useTransfer — the renderer's window into the desktop transfer data
 * plane. Wraps window.ipc.transfer with React state: exposes the last
 * event, derived progress kind, and action callbacks.
 *
 * NOTE: lives in renderer/shared (not a feature) because both the send
 * and receive features drive from the same event stream.
 */

import { useCallback, useEffect, useState } from "react";

import type { TransferEvent } from "../../main/preload";

export type TransferPhase =
	| "idle"
	| "seeding"
	| "offering"
	| "receiving"
	| "completed"
	| "failed"
	| "cancelled";

export interface TransferProgress {
	bytes: number;
	direction: "send" | "receive";
	total: number;
}

/** The device on the other end of the connection, once paired. */
export interface PairedDevice {
	id: string;
	name: string;
}

export interface TransferState {
	error: string | null;
	/** hyper-offer payload when this side is seeding. */
	offer: {
		driveKey: string;
		name?: string;
		/** This device's id, baked into the QR for receiver-side verification. */
		senderId?: string;
		topic: string;
	} | null;
	/** Peer identity, known only after the pair-hello exchange. */
	pairedDevice: PairedDevice | null;
	/** True once both sides accepted the pairing. */
	pairingConfirmed: boolean;
	/** True when the pairing auto-accepted via the trust list. */
	pairingTrusted: boolean;
	/** Raw socket connection to a peer exists. */
	peerConnected: boolean;
	phase: TransferPhase;
	/** Latest byte-level progress sample, when a transfer is running. */
	progress: TransferProgress | null;
	/** Saved file path after a successful receive. */
	savedPath: string | null;
}

const initialState: TransferState = {
	error: null,
	offer: null,
	pairedDevice: null,
	pairingConfirmed: false,
	pairingTrusted: false,
	peerConnected: false,
	phase: "idle",
	progress: null,
	savedPath: null,
};

export function useTransfer() {
	const [state, setState] = useState<TransferState>(initialState);

	useEffect(() => {
		const unsubscribe = window.ipc.transfer.onEvent((event: TransferEvent) => {
			setState((prev) => {
				switch (event.type) {
					case "peer":
						return {
							...prev,
							pairedDevice: event.device,
							pairingConfirmed: event.confirmed,
							pairingTrusted: event.trusted,
							peerConnected: event.status === "connected",
						};
					case "error":
						return { ...prev, error: event.message, phase: "failed" };
					case "state":
						return {
							...prev,
							phase: event.kind as TransferPhase,
							// A fresh run drops stale pairing state from the last one.
							...(event.kind === "idle" ? initialState : null),
						};
					case "done":
						return {
							...prev,
							phase: "completed",
							progress: null,
							savedPath: event.path ?? null,
						};
					case "progress":
						return {
							...prev,
							progress: {
								bytes: event.bytes,
								direction: event.direction,
								total: event.total,
							},
						};
					default:
						return prev;
				}
			});
		});
		return unsubscribe;
	}, []);

	const sendFile = useCallback(async (filePath: string) => {
		setState((prev) => ({ ...prev, error: null, phase: "seeding" }));
		const result = await window.ipc.transfer.sendFile(filePath);
		if (result.ok) {
			setState((prev) => ({
				...prev,
				offer: {
					driveKey: result.driveKey,
					senderId: result.senderId,
					topic: result.topic,
				},
			}));
		} else {
			setState((prev) => ({ ...prev, error: result.error, phase: "failed" }));
		}
		return result;
	}, []);

	const receive = useCallback(async (driveKey: string, topic: string) => {
		setState((prev) => ({ ...prev, error: null, phase: "receiving" }));
		const result = await window.ipc.transfer.receive(driveKey, topic);
		if (!result.ok) {
			setState((prev) => ({ ...prev, error: result.error, phase: "failed" }));
		}
		return result;
	}, []);

	const acceptPairing = useCallback(async () => {
		await window.ipc.pair.accept();
	}, []);

	const rejectPairing = useCallback(async () => {
		await window.ipc.pair.reject();
	}, []);

	const revokeTrust = useCallback(async (deviceId: string) => {
		const result = await window.ipc.trust.revoke(deviceId);
		return result.ok;
	}, []);

	const cancel = useCallback(async () => {
		await window.ipc.transfer.cancel();
		setState(initialState);
	}, []);

	const release = useCallback(async () => {
		await window.ipc.transfer.release();
		setState(initialState);
	}, []);

	return {
		acceptPairing,
		cancel,
		receive,
		rejectPairing,
		release,
		revokeTrust,
		sendFile,
		state,
	};
}
