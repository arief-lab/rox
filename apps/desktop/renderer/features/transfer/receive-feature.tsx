"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * ReceiveFeature — scan the sender's QR offer (or paste it), replicate
 * the drive, and show where the file was saved.
 */

import { decodeQrOffer } from "@rox/core";
import { type ChangeEvent, memo, useCallback, useState } from "react";

import { useQrScanner } from "../../shared/qr-code";
import type { useTransfer } from "../../shared/use-transfer";

type TransferApi = ReturnType<typeof useTransfer>;

export const ReceiveFeature = memo(function ReceiveFeatureInner({
	transfer,
}: {
	transfer: TransferApi;
}) {
	const [driveKey, setDriveKey] = useState("");
	const [topic, setTopic] = useState("");
	const [pasteText, setPasteText] = useState("");
	const [busy, setBusy] = useState(false);
	const { state, receive, cancel } = transfer;

	const isReceiving = state.phase === "receiving";
	const inputsDisabled = isReceiving || state.phase === "completed";

	const handleReceive = useCallback(
		(offerDriveKey: string, offerTopic: string) => {
			setBusy(true);
			receive(offerDriveKey, offerTopic)
				.catch((error: unknown) => {
					setBusy(false);
					throw error;
				})
				.finally(() => setBusy(false));
		},
		[receive]
	);

	const handlePasteReceive = useCallback(() => {
		if (driveKey.trim() === "" || topic.trim() === "") {
			return;
		}
		handleReceive(driveKey.trim(), topic.trim());
	}, [driveKey, topic, handleReceive]);

	// Scanning fills the fields and immediately starts the transfer.
	const handleScan = useCallback(
		(payload: string) => {
			try {
				const offer = decodeQrOffer(payload);
				setDriveKey(offer.driveKey);
				setTopic(offer.topic);
				handleReceive(offer.driveKey, offer.topic);
			} catch {
				setPasteText(payload);
			}
		},
		[handleReceive]
	);

	const {
		videoRef,
		scanning,
		error: scanError,
		start,
		stop,
	} = useQrScanner(handleScan);

	const handleScanToggle = useCallback(() => {
		if (scanning) {
			stop();
		} else {
			start();
		}
	}, [scanning, start, stop]);

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

	const handlePasteTextChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setPasteText(event.target.value);
		},
		[]
	);

	const handlePasteFill = useCallback(() => {
		try {
			const offer = decodeQrOffer(pasteText);
			setDriveKey(offer.driveKey);
			setTopic(offer.topic);
		} catch {
			// Leave fields untouched on invalid payload.
		}
	}, [pasteText]);

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
					Scan the sender&apos;s QR, or paste the offer below.
				</p>
			</header>

			<div className="space-y-3">
				{scanning ? (
					<div className="space-y-2">
						<video
							className="w-full rounded-lg border border-neutral-700"
							muted
							playsInline
							ref={videoRef}
						/>
						<button
							className="w-full rounded-lg border border-neutral-700 px-4 py-2 text-neutral-300 text-sm transition hover:border-neutral-500"
							onClick={handleScanToggle}
							type="button"
						>
							Stop camera
						</button>
					</div>
				) : (
					<button
						className="w-full rounded-lg border border-sky-800 bg-sky-950/50 px-4 py-2 font-medium text-sky-300 text-sm transition hover:bg-sky-900/50 disabled:opacity-40"
						disabled={inputsDisabled}
						onClick={handleScanToggle}
						type="button"
					>
						Scan QR with camera
					</button>
				)}
				{scanError === null ? null : (
					<p className="text-red-400 text-xs">{scanError}</p>
				)}
			</div>

			<div className="flex items-center gap-3">
				<span className="h-px flex-1 bg-neutral-800" />
				<span className="text-neutral-600 text-xs">or paste</span>
				<span className="h-px flex-1 bg-neutral-800" />
			</div>

			<label className="block space-y-1">
				<span className="font-medium text-neutral-500 text-xs uppercase tracking-wide">
					Offer (scanned text or rox1: payload)
				</span>
				<textarea
					className="h-16 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-neutral-100 text-xs outline-none focus:border-sky-500 disabled:opacity-50"
					disabled={inputsDisabled}
					onChange={handlePasteTextChange}
					placeholder="rox1:<driveKey><topic>"
					value={pasteText}
				/>
			</label>
			<button
				className="rounded-lg border border-neutral-700 px-3 py-1.5 text-neutral-300 text-xs transition hover:border-neutral-500 disabled:opacity-40"
				disabled={inputsDisabled || pasteText.trim() === ""}
				onClick={handlePasteFill}
				type="button"
			>
				Fill from payload
			</button>

			<div className="grid grid-cols-1 gap-3">
				<label className="block space-y-1">
					<span className="font-medium text-neutral-500 text-xs uppercase tracking-wide">
						Drive key
					</span>
					<input
						className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-neutral-100 text-xs outline-none focus:border-sky-500 disabled:opacity-50"
						disabled={inputsDisabled}
						onChange={handleDriveKeyChange}
						placeholder="64-char hex (auto-filled by scan)"
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
						placeholder="64-char hex (auto-filled by scan)"
						type="text"
						value={topic}
					/>
				</label>
			</div>

			<div className="flex gap-2">
				<button
					className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-sm text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
					disabled={
						busy ||
						driveKey.trim() === "" ||
						topic.trim() === "" ||
						inputsDisabled
					}
					onClick={handlePasteReceive}
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
