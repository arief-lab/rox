"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * ReceiveFeature — paste the sender's offer (driveKey + topic),
 * replicate the drive, and show where the file was saved.
 */

import { type ChangeEvent, memo, useCallback, useState } from "react";

import type { useTransfer } from "../../shared/use-transfer";

type TransferApi = ReturnType<typeof useTransfer>;

export const ReceiveFeature = memo(function ReceiveFeatureInner({
	transfer,
}: {
	transfer: TransferApi;
}) {
	const [driveKey, setDriveKey] = useState("");
	const [topic, setTopic] = useState("");
	const [busy, setBusy] = useState(false);
	const { state, receive, cancel } = transfer;

	const isReceiving = state.phase === "receiving";
	const inputsDisabled = isReceiving || state.phase === "completed";

	const handleDriveKeyChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setDriveKey(event.target.value);
		},
		[]
	);

	const handleTopicChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setTopic(event.target.value);
		},
		[]
	);

	const handleReceive = useCallback(() => {
		if (driveKey.trim() === "" || topic.trim() === "") {
			return;
		}
		setBusy(true);
		receive(driveKey.trim(), topic.trim())
			.catch((error: unknown) => {
				setBusy(false);
				throw error;
			})
			.finally(() => setBusy(false));
	}, [driveKey, topic, receive]);

	const handleCancel = useCallback(() => {
		cancel();
	}, [cancel]);

	const showSaved = state.phase === "completed" && state.savedPath !== null;

	return (
		<section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
			<header>
				<h2 className="font-semibold text-lg text-neutral-100">
					Receive a file
				</h2>
				<p className="text-neutral-400 text-sm">
					Paste the drive key and topic from the sender&apos;s offer.
				</p>
			</header>

			<label className="block space-y-1">
				<span className="font-medium text-neutral-500 text-xs uppercase tracking-wide">
					Drive key
				</span>
				<input
					className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-neutral-100 text-xs outline-none focus:border-sky-500 disabled:opacity-50"
					disabled={inputsDisabled}
					onChange={handleDriveKeyChange}
					placeholder="64-char hex from the sender"
					type="text"
					value={driveKey}
				/>
			</label>

			<label className="block space-y-1">
				<span className="font-medium text-neutral-500 text-xs uppercase tracking-wide">
					Topic
				</span>
				<input
					className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-neutral-100 text-xs outline-none focus:border-sky-500 disabled:opacity-50"
					disabled={inputsDisabled}
					onChange={handleTopicChange}
					placeholder="64-char hex from the sender"
					type="text"
					value={topic}
				/>
			</label>

			<div className="flex gap-2">
				<button
					className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-sm text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
					disabled={
						busy ||
						driveKey.trim() === "" ||
						topic.trim() === "" ||
						inputsDisabled
					}
					onClick={handleReceive}
					type="button"
				>
					{busy ? "Receiving…" : "Receive"}
				</button>
				{isReceiving ? (
					<button
						className="rounded-lg border border-neutral-700 px-4 py-2 text-neutral-300 text-sm transition hover:border-neutral-500"
						onClick={handleCancel}
						type="button"
					>
						Cancel
					</button>
				) : null}
			</div>

			{showSaved && state.savedPath ? (
				<div className="space-y-1 rounded-lg border border-sky-900/60 bg-sky-950/40 p-4">
					<p className="font-medium text-sky-400 text-xs uppercase tracking-wide">
						File received
					</p>
					<code className="block truncate rounded bg-neutral-950 px-2 py-1 font-mono text-neutral-300 text-xs">
						{state.savedPath}
					</code>
				</div>
			) : null}

			{state.phase === "failed" && state.error !== null ? (
				<p className="text-red-400 text-sm">Receive failed: {state.error}</p>
			) : null}
		</section>
	);
});
