"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * SendFeature — pick a file, seed it into a Hyperdrive, show the
 * offer (driveKey/topic) for the other device to accept.
 */

import { encodeQrOffer } from "@rox/core";
import { type ChangeEvent, memo, useCallback, useState } from "react";
import { QrCode } from "../../shared/qr-code";
import type { useTransfer } from "../../shared/use-transfer";

type TransferApi = ReturnType<typeof useTransfer>;

export const SendFeature = memo(function SendFeatureInner({
	transfer,
}: {
	transfer: TransferApi;
}) {
	const [filePath, setFilePath] = useState("");
	const [busy, setBusy] = useState(false);
	const { state, sendFile, cancel } = transfer;

	const isSeeding = state.phase === "seeding" || state.phase === "offering";

	const handleFilePathChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setFilePath(event.target.value);
		},
		[]
	);

	const handleSend = useCallback(() => {
		if (!filePath.trim()) {
			return;
		}
		setBusy(true);
		sendFile(filePath.trim())
			.catch((error: unknown) => {
				setBusy(false);
				throw error;
			})
			.finally(() => setBusy(false));
	}, [filePath, sendFile]);

	const handleCancel = useCallback(() => {
		cancel();
	}, [cancel]);

	const showOffer = state.offer !== null;
	const { offer } = state;

	return (
		<section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
			<header>
				<h2 className="font-semibold text-lg text-neutral-100">Send a file</h2>
				<p className="text-neutral-400 text-sm">
					Seed the file into a Hyperdrive and share the offer with the other
					device.
				</p>
			</header>

			<label className="block space-y-1">
				<span className="font-medium text-neutral-500 text-xs uppercase tracking-wide">
					File path (local disk)
				</span>
				<input
					className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 text-sm outline-none focus:border-emerald-500"
					onChange={handleFilePathChange}
					placeholder="/home/you/Documents/report.pdf"
					type="text"
					value={filePath}
				/>
			</label>

			<div className="flex gap-2">
				<button
					className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-sm text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
					disabled={busy || filePath.trim() === "" || isSeeding}
					onClick={handleSend}
					type="button"
				>
					{busy ? "Seeding…" : "Seed & share"}
				</button>
				{isSeeding ? (
					<button
						className="rounded-lg border border-neutral-700 px-4 py-2 text-neutral-300 text-sm transition hover:border-neutral-500"
						onClick={handleCancel}
						type="button"
					>
						Cancel
					</button>
				) : null}
			</div>

			{showOffer && offer ? (
				<div className="space-y-3 rounded-lg border border-emerald-900/60 bg-emerald-950/40 p-4">
					<p className="font-medium text-emerald-400 text-xs uppercase tracking-wide">
						Offer ready — scan the QR on the other device
					</p>
					<div className="flex flex-col items-center gap-3">
						<QrCode
							payload={encodeQrOffer({
								driveKey: offer.driveKey,
								topic: offer.topic,
							})}
						/>
						<div className="w-full space-y-2">
							<Field label="Drive key" value={offer.driveKey} />
							<Field label="Topic" value={offer.topic} />
						</div>
						<p className="text-neutral-500 text-xs">
							Scan the QR on the receiver, or paste these two values into their
							Receive panel.
						</p>
					</div>
				</div>
			) : null}

			{state.phase === "failed" && state.error !== null ? (
				<p className="text-red-400 text-sm">Send failed: {state.error}</p>
			) : null}
		</section>
	);
});

function Field({ label, value }: { label: string; value: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		navigator.clipboard
			.writeText(value)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1500);
			})
			.catch(() => setCopied(false));
	}, [value]);

	return (
		<div className="flex items-center gap-2">
			<span className="w-20 shrink-0 text-neutral-500 text-xs">{label}</span>
			<code className="min-w-0 flex-1 truncate rounded bg-neutral-950 px-2 py-1 font-mono text-neutral-300 text-xs">
				{value}
			</code>
			<button
				className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-neutral-300 text-xs transition hover:border-neutral-500"
				onClick={handleCopy}
				type="button"
			>
				{copied ? "Copied" : "Copy"}
			</button>
		</div>
	);
}
