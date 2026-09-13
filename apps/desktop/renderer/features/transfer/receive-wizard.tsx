"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * ReceiveWizard — scan the sender's QR (or paste the offer payload),
 * replicate the drive, then show where the file was saved.
 */

import { decodeQrOffer, pairSafetyCode } from "@rox/core";
import { type ChangeEvent, memo, useCallback, useState } from "react";
import { useQrScanner } from "../../shared/qr-code";
import type { useTransfer } from "../../shared/use-transfer";
import { PairingIndicator, type PairingStage } from "./pairing-indicator";
import { TransferProgress } from "./transfer-progress";
import { useWizardStep, Wizard, type WizardStep } from "./wizard";

type TransferApi = ReturnType<typeof useTransfer>;

type ReceiveStep = "offer" | "done";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one component per wizard step keeps the receive flow in one readable place
export const ReceiveWizard = memo(function ReceiveWizardInner({
	transfer,
	localId,
	localName,
}: {
	transfer: TransferApi;
	localId: string;
	localName: string;
}) {
	const [step, go] = useWizardStep<ReceiveStep>("offer");
	const [driveKey, setDriveKey] = useState("");
	const [topic, setTopic] = useState("");
	const [pasteText, setPasteText] = useState("");
	const [busy, setBusy] = useState(false);
	const [acceptedLocally, setAcceptedLocally] = useState(false);
	const { state, receive, cancel, acceptPairing, rejectPairing } = transfer;

	const isReceiving = state.phase === "receiving";
	const inputsDisabled = isReceiving || state.phase === "completed";

	const handleReceive = useCallback(
		(offerDriveKey: string, offerTopic: string) => {
			setBusy(true);
			receive(offerDriveKey, offerTopic)
				.then((result) => {
					if (result.ok) {
						go("done");
					}
				})
				.catch((error: unknown) => {
					setBusy(false);
					throw error;
				})
				.finally(() => setBusy(false));
		},
		[receive, go]
	);

	const handlePasteReceive = useCallback(() => {
		if (driveKey.trim() === "" || topic.trim() === "") {
			return;
		}
		handleReceive(driveKey.trim(), topic.trim());
	}, [driveKey, topic, handleReceive]);

	/**
	 * If the scanned payload carries the sender's device id, we can show
	 * the shared safety code immediately — derived from the QR alone,
	 * before any connection exists. Null for legacy senders without it.
	 */
	const scannedSenderId = (() => {
		if (pasteText.trim() === "") {
			return null;
		}
		try {
			return decodeQrOffer(pasteText).senderId ?? null;
		} catch {
			return null;
		}
	})();

	/** The pre-connect safety code, when both ids are known. */
	const preConnectSafetyCode =
		localId !== "" && scannedSenderId !== null
			? pairSafetyCode(localId, scannedSenderId)
			: null;

	// Scanning fills the fields and immediately starts the transfer.
	const handleScan = useCallback(
		(payload: string) => {
			try {
				const offer = decodeQrOffer(payload);
				setDriveKey(offer.driveKey);
				setTopic(offer.topic);
				setPasteText(payload.trim());
				handleReceive(offer.driveKey, offer.topic);
			} catch {
				// Ignore unrecognized payloads; the user can paste manually.
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

	const [pasteError, setPasteError] = useState(false);

	// Reveal the saved file in the system file manager.
	const handleReveal = useCallback(() => {
		if (state.savedPath) {
			window.ipc.revealItem(state.savedPath);
		}
	}, [state.savedPath]);

	const handlePasteFill = useCallback(() => {
		try {
			const offer = decodeQrOffer(pasteText);
			setDriveKey(offer.driveKey);
			setTopic(offer.topic);
			setPasteError(false);
		} catch {
			// Surface the failure instead of leaving the user guessing why
			// the fields did not fill.
			setPasteError(true);
		}
	}, [pasteText]);

	const handleReset = useCallback(() => {
		cancel();
		setDriveKey("");
		setTopic("");
		setPasteText("");
		setPasteError(false);
		go("offer");
	}, [cancel, go]);

	const showSaved = state.phase === "completed" && state.savedPath !== null;

	// Pairing stage derived from the peer event stream plus the local
	// decision (the main process tracks the remote one).
	let pairingStage: PairingStage;
	if (state.pairingConfirmed) {
		pairingStage = "paired";
	} else if (state.pairedDevice === null) {
		pairingStage = "waiting";
	} else {
		pairingStage = acceptedLocally ? "waiting-remote" : "confirm";
	}
	const handleAcceptPairing = useCallback(() => {
		setAcceptedLocally(true);
		acceptPairing();
	}, [acceptPairing]);

	const steps: WizardStep[] = [
		{
			body: (
				<div className="space-y-4">
					<div className="space-y-3">
						{preConnectSafetyCode === null ? null : (
							<div className="rounded-lg border border-receive-muted bg-receive-muted/30 px-4 py-3">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">
									Safety code: match it against the sender's screen
								</p>
								<p className="font-mono font-semibold text-foreground text-xl tracking-widest">
									{preConnectSafetyCode}
								</p>
							</div>
						)}
						{scanning ? (
							<div className="space-y-2">
								<video
									className="w-full rounded-lg border"
									muted
									playsInline
									ref={videoRef}
								/>
								<button
									className="w-full rounded-lg border px-4 py-2 text-muted-foreground text-sm transition hover:text-foreground"
									onClick={handleScanToggle}
									type="button"
								>
									Stop camera
								</button>
							</div>
						) : (
							<button
								className="w-full rounded-lg border border-receive bg-receive-muted/30 px-4 py-2 font-medium text-receive text-sm transition hover:brightness-110 disabled:opacity-40"
								disabled={inputsDisabled}
								onClick={handleScanToggle}
								type="button"
							>
								Scan QR with camera
							</button>
						)}
						{scanError === null ? null : (
							<p className="text-destructive text-xs">{scanError}</p>
						)}
					</div>

					<div className="flex items-center gap-3">
						<span className="h-px flex-1 bg-border" />
						<span className="text-muted-foreground text-xs">or paste</span>
						<span className="h-px flex-1 bg-border" />
					</div>

					<label className="block space-y-1">
						<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Offer (scanned text or rox1: payload)
						</span>
						<textarea
							className="h-16 w-full rounded-lg border bg-input px-3 py-2 font-mono text-foreground text-xs outline-none focus:border-receive focus:ring-1 focus:ring-receive disabled:opacity-50"
							disabled={inputsDisabled}
							onChange={handlePasteTextChange}
							placeholder="rox1:<driveKey><topic>"
							value={pasteText}
						/>
					</label>
					<button
						className="rounded-lg border px-3 py-1.5 text-muted-foreground text-xs transition hover:text-foreground disabled:opacity-40"
						disabled={inputsDisabled || pasteText.trim() === ""}
						onClick={handlePasteFill}
						type="button"
					>
						Fill from payload
					</button>
					{pasteError ? (
						<p className="text-destructive text-xs">
							That does not look like a Rox offer. Ask the sender to share the
							QR or the full rox1: payload.
						</p>
					) : null}

					<div className="grid grid-cols-1 gap-3">
						<label className="block space-y-1">
							<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Drive key
							</span>
							<input
								className="w-full rounded-lg border bg-input px-3 py-2 font-mono text-foreground text-xs outline-none focus:border-receive focus:ring-1 focus:ring-receive disabled:opacity-50"
								disabled={inputsDisabled}
								onChange={handleDriveKeyChange}
								placeholder="64-char hex (auto-filled by scan)"
								type="text"
								value={driveKey}
							/>
						</label>
						<label className="block space-y-1">
							<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								Topic
							</span>
							<input
								className="w-full rounded-lg border bg-input px-3 py-2 font-mono text-foreground text-xs outline-none focus:border-receive focus:ring-1 focus:ring-receive disabled:opacity-50"
								disabled={inputsDisabled}
								onChange={handleTopicChange}
								placeholder="64-char hex (auto-filled by scan)"
								type="text"
								value={topic}
							/>
						</label>
					</div>

					{/* Pairing state sits above the action: the user must see
					    who they are about to receive from before pressing it. */}
					<PairingIndicator
						localId={localId}
						localName={localName}
						onAccept={handleAcceptPairing}
						onReject={rejectPairing}
						pairedDevice={state.pairedDevice}
						stage={pairingStage}
						trusted={state.pairingTrusted}
					/>

					<div className="flex gap-2">
						<button
							className="rounded-lg bg-receive px-4 py-2 font-medium text-receive-foreground text-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={
								busy ||
								driveKey.trim() === "" ||
								topic.trim() === "" ||
								inputsDisabled
							}
							onClick={handlePasteReceive}
							type="button"
						>
							{busy || isReceiving ? "Receiving…" : "Receive"}
						</button>
						{isReceiving ? (
							<button
								className="rounded-lg border px-4 py-2 text-muted-foreground text-sm transition hover:text-foreground"
								onClick={cancel}
								type="button"
							>
								Cancel
							</button>
						) : null}
					</div>

					{state.progress === null ? null : (
						<TransferProgress progress={state.progress} />
					)}

					{state.phase === "failed" && state.error !== null ? (
						<p className="text-destructive text-sm">
							Receive failed: {state.error}
						</p>
					) : null}
				</div>
			),
			title: "Get the offer",
		},
		{
			body:
				showSaved && state.savedPath ? (
					<div className="space-y-3">
						<div className="space-y-1 rounded-lg border border-receive-muted bg-receive-muted/30 p-4">
							<p className="font-medium text-receive text-xs uppercase tracking-wide">
								File received
							</p>
							<code className="block truncate rounded bg-input px-2 py-1 font-mono text-foreground text-xs">
								{state.savedPath}
							</code>
							<button
								className="text-receive text-xs underline decoration-dotted underline-offset-2 transition hover:brightness-110"
								onClick={handleReveal}
								type="button"
							>
								Open in folder
							</button>
						</div>
						<button
							className="rounded-lg border px-4 py-2 text-muted-foreground text-sm transition hover:text-foreground"
							onClick={handleReset}
							type="button"
						>
							Receive another file
						</button>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">Finishing up…</p>
				),
			title: "Done",
		},
	];

	const transferRunning = state.progress !== null || isReceiving;

	return (
		<Wizard
			backDisabled={transferRunning}
			current={step === "done" ? 1 : 0}
			onBack={handleReset}
			steps={steps}
		/>
	);
});
