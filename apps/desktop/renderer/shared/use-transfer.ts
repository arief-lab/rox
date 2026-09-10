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

export interface TransferState {
	error: string | null;
	/** hyper-offer payload when this side is seeding. */
	offer: { driveKey: string; topic: string; name?: string } | null;
	phase: TransferPhase;
	/** Saved file path after a successful receive. */
	savedPath: string | null;
}

const initialState: TransferState = {
	error: null,
	offer: null,
	phase: "idle",
	savedPath: null,
};

export function useTransfer() {
	const [state, setState] = useState<TransferState>(initialState);

	useEffect(() => {
		const unsubscribe = window.ipc.transfer.onEvent((event: TransferEvent) => {
			setState((prev) => {
				switch (event.type) {
					case "state":
						return { ...prev, phase: event.kind as TransferPhase };
					case "error":
						return { ...prev, error: event.message, phase: "failed" };
					case "done":
						return {
							...prev,
							phase: "completed",
							savedPath: event.path ?? null,
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
				offer: { driveKey: result.driveKey, topic: result.topic },
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

	const cancel = useCallback(async () => {
		await window.ipc.transfer.cancel();
		setState(initialState);
	}, []);

	const release = useCallback(async () => {
		await window.ipc.transfer.release();
		setState(initialState);
	}, []);

	return { cancel, receive, release, sendFile, state };
}
