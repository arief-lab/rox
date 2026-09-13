"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * SendWizard — pick a file (drag-and-drop or path input), seed it into
 * a Hyperdrive, then show the offer QR for the receiving device.
 */

import { encodeQrOffer } from "@rox/core";
import { Check, Copy } from "lucide-react";
import {
	type ChangeEvent,
	type DragEvent,
	type FormEvent,
	memo,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { QrCode } from "../../shared/qr-code";
import type { useTransfer } from "../../shared/use-transfer";
import { PairingIndicator, type PairingStage } from "./pairing-indicator";
import { TransferProgress } from "./transfer-progress";
import { useWizardStep, Wizard, type WizardStep } from "./wizard";

type TransferApi = ReturnType<typeof useTransfer>;

type SendStep = "pick" | "offer";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one component per wizard step keeps the transfer flow in one readable place
export const SendWizard = memo(function SendWizardInner({
	transfer,
	localId,
	localName,
}: {
	transfer: TransferApi;
	localId: string;
	localName: string;
}) {
	const [step, go] = useWizardStep<SendStep>("pick");
	const [filePath, setFilePath] = useState("");
	const [dragActive, setDragActive] = useState(false);
	const [busy, setBusy] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<string[]>([]);
	const [searching, setSearching] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const { state, sendFile, cancel, acceptPairing, rejectPairing } = transfer;

	// Debounced filename search against the main process.
	useEffect(() => {
		const trimmed = searchQuery.trim();
		if (trimmed.length < MIN_QUERY_LENGTH) {
			setSearchResults([]);
			setSearching(false);
			return;
		}
		setSearching(true);
		const timer = setTimeout(() => {
			window.ipc.files
				.search(trimmed)
				.then((result) => {
					setSearchResults(result.results);
				})
				.catch(() => {
					setSearchResults([]);
				})
				.finally(() => {
					setSearching(false);
				});
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
		};
	}, [searchQuery]);

	const handleSearchChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setSearchQuery(event.target.value);
		},
		[]
	);

	const isSeeding = state.phase === "seeding" || state.phase === "offering";

	const startSend = useCallback(
		(path: string) => {
			const trimmed = path.trim();
			if (trimmed === "") {
				return;
			}
			setBusy(true);
			sendFile(trimmed)
				.then(() => {
					go("offer");
				})
				.catch((error: unknown) => {
					setBusy(false);
					throw error;
				})
				.finally(() => setBusy(false));
		},
		[sendFile, go]
	);

	const handleBrowse = useCallback(() => {
		window.ipc.files.browse().then((result) => {
			if (result.path) {
				setFilePath(result.path);
				startSend(result.path);
			}
		});
	}, [startSend]);

	const pickResult = useCallback(
		(path: string) => {
			setFilePath(path);
			startSend(path);
		},
		[startSend]
	);

	const resolveAndSend = useCallback(
		(file: File) => {
			const path = window.ipc.getPathForFile(file);
			if (path !== "") {
				setFilePath(path);
				startSend(path);
			}
		},
		[startSend]
	);

	const handleDrop = useCallback(
		(event: DragEvent<HTMLElement>) => {
			event.preventDefault();
			setDragActive(false);
			if (isSeeding || busy) {
				return;
			}
			const [file] = event.dataTransfer.files;
			if (file) {
				resolveAndSend(file);
			}
		},
		[isSeeding, busy, resolveAndSend]
	);

	const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
		event.preventDefault();
		setDragActive(true);
	}, []);

	const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node)) {
			setDragActive(false);
		}
	}, []);

	const handlePickClick = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChosen = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (file) {
				resolveAndSend(file);
			}
		},
		[resolveAndSend]
	);

	const handleSubmitPath = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			startSend(filePath);
		},
		[filePath, startSend]
	);

	const handleCancel = useCallback(() => {
		cancel();
		go("pick");
	}, [cancel, go]);

	const { offer } = state;
	const [acceptedLocally, setAcceptedLocally] = useState(false);
	const [copied, setCopied] = useState(false);

	/** The full offer payload (QR content) as a copyable string. */
	const offerPayload =
		offer === null
			? null
			: encodeQrOffer({
					driveKey: offer.driveKey,
					senderId: localId || undefined,
					topic: offer.topic,
				});

	const handleCopyOffer = useCallback(() => {
		if (offerPayload === null) {
			return;
		}
		navigator.clipboard.writeText(offerPayload).then(
			() => {
				setCopied(true);
				setTimeout(() => {
					setCopied(false);
				}, 2000);
			},
			() => {
				// Clipboard unavailable — leave the button unchanged.
			}
		);
	}, [offerPayload]);

	// Publish the payload to the main process while the offer step is
	// showing: it powers the native context menu and Ctrl+Shift+C.
	useEffect(() => {
		if (step !== "offer" || offerPayload === null) {
			return;
		}
		window.ipc.send("offer:payload", offerPayload);
		return () => {
			window.ipc.send("offer:payload", null);
		};
	}, [step, offerPayload]);

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
	const handlePathInput = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setFilePath(event.target.value);
		},
		[]
	);
	const handlePickResult = useCallback(
		(result: string) => {
			pickResult(result);
		},
		[pickResult]
	);

	const steps: WizardStep[] = [
		{
			body: (
				<div className="space-y-4">
					<button
						aria-disabled={isSeeding || busy}
						className={`flex min-h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition ${
							dragActive
								? "border-send bg-send-muted/30"
								: "border-border hover:border-send/60"
						}`}
						onClick={handlePickClick}
						onDragLeave={handleDragLeave}
						onDragOver={handleDragOver}
						onDrop={handleDrop}
						type="button"
					>
						<p className="font-medium text-foreground">
							{dragActive ? "Drop to start sending" : "Drop a file here"}
						</p>
						<p className="text-muted-foreground text-sm">
							or click to browse your disk
						</p>
					</button>
					<input
						aria-label="Choose file"
						className="hidden"
						onChange={handleFileChosen}
						ref={fileInputRef}
						type="file"
					/>

					<div className="space-y-2">
						<label className="flex items-center gap-2">
							<span className="sr-only">Search files by name</span>
							<input
								className="w-full rounded-lg border bg-input px-3 py-2 text-foreground text-sm outline-none focus:border-send focus:ring-1 focus:ring-send"
								onChange={handleSearchChange}
								placeholder="Search files by name…"
								type="search"
								value={searchQuery}
							/>
							<button
								className="shrink-0 rounded-lg border px-3 py-2 text-muted-foreground text-sm transition hover:text-foreground disabled:opacity-40"
								disabled={busy || isSeeding}
								onClick={handleBrowse}
								type="button"
							>
								Browse…
							</button>
						</label>
						{searching ? (
							<p className="text-muted-foreground text-xs">Searching…</p>
						) : null}
						{!searching && searchResults.length > 0 ? (
							<ul className="divide-y divide-border overflow-hidden rounded-lg border">
								{searchResults.map((result) => (
									<li key={result}>
										<button
											className="block w-full truncate bg-card px-3 py-2 text-left font-mono text-muted-foreground text-xs transition hover:bg-accent hover:text-foreground disabled:opacity-40"
											disabled={busy || isSeeding}
											// biome-ignore lint/performance/noJsxPropsBind: per-row identity is only known at render time
											onClick={() => {
												handlePickResult(result);
											}}
											title={result}
											type="button"
										>
											{result}
										</button>
									</li>
								))}
							</ul>
						) : null}
					</div>

					<form className="space-y-2" onSubmit={handleSubmitPath}>
						<label className="block space-y-1">
							<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
								…or type a path
							</span>
							<input
								className="w-full rounded-lg border bg-input px-3 py-2 text-foreground text-sm outline-none focus:border-send focus:ring-1 focus:ring-send"
								disabled={busy || isSeeding}
								onChange={handlePathInput}
								placeholder="/home/you/Documents/report.pdf"
								type="text"
								value={filePath}
							/>
						</label>
						<button
							className="rounded-lg bg-send px-4 py-2 font-medium text-send-foreground text-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={busy || isSeeding || filePath.trim() === ""}
							type="submit"
						>
							{busy || isSeeding ? "Seeding…" : "Seed & share"}
						</button>
					</form>

					{state.phase === "failed" && state.error !== null ? (
						<p className="text-destructive text-sm">
							Send failed: {state.error}
						</p>
					) : null}
				</div>
			),
			title: "Choose a file",
		},
		{
			body: offer ? (
				<div className="space-y-3">
					<p className="font-medium text-send text-xs uppercase tracking-wide">
						Offer ready — scan the QR on the other device
					</p>
					<PairingIndicator
						localId={localId}
						localName={localName}
						onAccept={handleAcceptPairing}
						onReject={rejectPairing}
						pairedDevice={state.pairedDevice}
						stage={pairingStage}
						trusted={state.pairingTrusted}
					/>
					{state.progress === null ? null : (
						<TransferProgress progress={state.progress} />
					)}
					<div className="flex flex-col items-center gap-3">
						<div className="flex items-center gap-2 rounded-full border bg-card px-4 py-1.5">
							<span
								aria-hidden={true}
								className="h-2 w-2 shrink-0 rounded-full bg-send"
							/>
							<p className="text-muted-foreground text-xs">
								Sending from{" "}
								<span className="font-medium text-foreground">
									{localName || "this device"}
								</span>
							</p>
						</div>
						<QrCode payload={offerPayload ?? ""} />
						<div className="flex items-center gap-2">
							<button
								className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-muted-foreground text-xs transition hover:text-foreground"
								onClick={handleCopyOffer}
								type="button"
							>
								{copied ? (
									<Check aria-hidden={true} className="h-3.5 w-3.5 text-send" />
								) : (
									<Copy aria-hidden={true} className="h-3.5 w-3.5" />
								)}
								{copied ? "Copied" : "Copy offer"}
							</button>
						</div>
						<p className="text-muted-foreground text-xs">
							Scan the QR on the receiver, or paste the offer into their Receive
							flow. Keep this window open while the transfer runs.
						</p>
					</div>
					<button
						className="rounded-lg border px-4 py-2 text-muted-foreground text-sm transition hover:text-foreground"
						onClick={handleCancel}
						type="button"
					>
						Cancel transfer
					</button>
				</div>
			) : (
				<p className="text-muted-foreground text-sm">Preparing offer…</p>
			),
			title: "Share the offer",
		},
	];

	return (
		<Wizard
			current={step === "offer" ? 1 : 0}
			onBack={handleCancel}
			steps={steps}
		/>
	);
});
