"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Home — entry point for the transfer flow. Picks send or receive, then
 * hands off to the matching wizard leg. Layout is a compact, centered
 * utility window: the mode cards ARE the app.
 */

import { pairSafetyCode } from "@rox/core";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import Head from "next/head";
import {
	type ChangeEvent,
	type KeyboardEvent,
	memo,
	useCallback,
	useEffect,
	useState,
} from "react";
import { ReceiveWizard } from "../features/transfer/receive-wizard";
import { RecentTransfers } from "../features/transfer/recent-transfers";
import { SendWizard } from "../features/transfer/send-wizard";
import TrustedDevices from "../features/transfer/trusted-devices";
import type { TransferMode } from "../features/transfer/wizard";
import { useTransfer } from "../shared/use-transfer";

const ModeCard = memo(function ModeCardPanel({
	accent,
	description,
	icon,
	onSelect,
	title,
}: {
	accent: "receive" | "send";
	description: string;
	icon: React.ReactNode;
	onSelect: () => void;
	title: string;
}) {
	// Focus: 2px ring (mapped to --ring via the base layer) plus the
	// accent border, so keyboard focus is unmistakable on both themes.
	const accentClasses =
		accent === "send"
			? "hover:border-send/60 focus-visible:border-send focus-visible:outline-send/60"
			: "hover:border-receive/60 focus-visible:border-receive focus-visible:outline-receive/60";

	return (
		<button
			className={`group flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 ${accentClasses}`}
			onClick={onSelect}
			type="button"
		>
			<span
				className={`flex h-12 w-12 items-center justify-center rounded-full ${
					accent === "send"
						? "bg-send-muted/40 text-send"
						: "bg-receive-muted/40 text-receive"
				}`}
			>
				{icon}
			</span>
			<span className="font-semibold text-foreground text-lg">{title}</span>
			<span className="text-muted-foreground text-sm">{description}</span>
		</button>
	);
});

/**
 * Incoming-request banner state while idle on the home screen: a
 * nearby device opened a pairing (the first half of a direct send)
 * and needs the user's decision before any file can arrive.
 */
interface IncomingPairing {
	device: { id: string; name: string };
	trusted: boolean;
}

const IncomingPairingBanner = memo(function IncomingPairingBannerPanel({
	localId,
	onAccept,
	onReject,
	request,
}: {
	localId: string;
	onAccept: () => void;
	onReject: () => void;
	request: IncomingPairing;
}) {
	return (
		<div className="space-y-3 rounded-lg border border-send-muted bg-send-muted/30 p-4">
			<p className="text-foreground text-sm">
				<span className="font-medium text-send">{request.device.name}</span>{" "}
				wants to pair with this device.
			</p>
			<div className="flex items-center justify-between gap-4 rounded-lg border bg-input px-4 py-3">
				<div>
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						Safety code
					</p>
					<p className="font-mono font-semibold text-foreground text-xl tracking-widest">
						{pairSafetyCode(localId, request.device.id)}
					</p>
				</div>
				<p className="max-w-48 text-right text-muted-foreground text-xs">
					Match it against the sender's screen before accepting.
				</p>
			</div>
			<div className="flex gap-2">
				<button
					className="rounded-lg bg-send px-4 py-2 font-medium text-send-foreground text-sm transition hover:brightness-110"
					onClick={onAccept}
					type="button"
				>
					Accept
				</button>
				<button
					className="rounded-lg border px-4 py-2 text-destructive text-sm transition hover:bg-destructive/10"
					onClick={onReject}
					type="button"
				>
					Reject
				</button>
			</div>
		</div>
	);
});

export default function HomePage() {
	const transfer = useTransfer();
	const [mode, setMode] = useState<TransferMode>(null);
	const [localName, setLocalName] = useState("");
	const [localId, setLocalId] = useState("");
	const [incoming, setIncoming] = useState<IncomingPairing | null>(null);
	const [incomingDone, setIncomingDone] = useState<string | null>(null);

	// Device identity used in the pairing UI; stable across the session.
	useEffect(() => {
		window.ipc.device
			.get()
			.then((device) => {
				setLocalId(device.id);
				setLocalName(device.name);
			})
			.catch(() => {
				setLocalName("This device");
			});
	}, []);

	// While idle on home, surface pairing requests from nearby devices
	// (direct sends start with a pairing) and completed auto-receives.
	useEffect(() => {
		if (mode !== null) {
			return;
		}
		const unsubscribe = window.ipc.transfer.onEvent((event) => {
			if (event.type === "peer") {
				if (
					event.status === "connected" &&
					event.device !== null &&
					!event.confirmed
				) {
					setIncoming({ device: event.device, trusted: event.trusted });
				} else if (event.confirmed) {
					setIncoming(null);
				}
			} else if (event.type === "done" && event.path) {
				setIncoming(null);
				setIncomingDone(event.path);
			} else if (event.type === "state" && event.kind === "idle") {
				setIncoming(null);
			}
		});
		return unsubscribe;
	}, [mode]);

	const handleIncomingAccept = useCallback(() => {
		window.ipc.pair.accept();
		setIncoming(null);
	}, []);

	const handleIncomingReject = useCallback(() => {
		window.ipc.pair.reject();
		setIncoming(null);
	}, []);

	const handleSelect = useCallback((next: TransferMode) => {
		setMode(next);
	}, []);
	const selectSend = useCallback(() => handleSelect("send"), [handleSelect]);
	const selectReceive = useCallback(
		() => handleSelect("receive"),
		[handleSelect]
	);
	const selectNone = useCallback(() => handleSelect(null), [handleSelect]);

	// Device name editing: the peer sees this name during pairing.
	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState("");
	const [nameSaved, setNameSaved] = useState(false);

	const handleEditName = useCallback(() => {
		setNameDraft(localName);
		setEditingName(true);
		setNameSaved(false);
	}, [localName]);

	const handleNameDraftChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setNameDraft(event.target.value);
			setNameSaved(false);
		},
		[]
	);

	const handleSaveName = useCallback(() => {
		const trimmed = nameDraft.trim();
		if (trimmed === "") {
			setEditingName(false);
			return;
		}
		window.ipc.device
			.setName(trimmed)
			.then(() => {
				setLocalName(trimmed);
				setEditingName(false);
				setNameSaved(true);
			})
			.catch(() => {
				setEditingName(false);
			});
	}, [nameDraft]);

	const handleNameKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				handleSaveName();
			} else if (event.key === "Escape") {
				setEditingName(false);
			}
		},
		[handleSaveName]
	);

	return (
		<>
			<Head>
				<title>Rox</title>
			</Head>
			{/* Full-height flex centers the single screen of content. */}
			<main className="flex min-h-svh flex-col bg-background text-foreground">
				<div className="flex flex-1 flex-col items-center justify-center px-8 py-6">
					{mode === null ? (
						<div className="w-full max-w-xl space-y-8">
							<header className="space-y-1 text-center">
								<h1 className="font-bold text-2xl">Rox</h1>
								<p className="text-muted-foreground text-sm">
									Peer-to-peer file sharing, no servers, no accounts.
								</p>
								{/* Device identity: name is human (sans), id is machine (mono) */}
								{editingName ? (
									<div className="flex items-center justify-center gap-2">
										<input
											aria-label="Device name"
											autoFocus
											className="w-48 rounded-lg border bg-input px-2 py-1 text-center text-foreground text-sm outline-none focus:border-send focus:ring-1 focus:ring-send"
											onChange={handleNameDraftChange}
											onKeyDown={handleNameKeyDown}
											placeholder="Device name"
											value={nameDraft}
										/>
										<button
											className="rounded-lg bg-send px-3 py-1 font-medium text-receive-foreground text-xs transition hover:brightness-110"
											onClick={handleSaveName}
											type="button"
										>
											Save
										</button>
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										This device: {localName}
										<span className="font-mono text-xs"> ({localId})</span>
										<button
											aria-label="Edit device name"
											className="ml-1 underline decoration-dotted underline-offset-2 transition hover:text-foreground"
											onClick={handleEditName}
											type="button"
										>
											edit
										</button>
										{nameSaved ? (
											<span className="ml-2 text-receive text-xs">saved</span>
										) : null}
									</p>
								)}
							</header>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<ModeCard
									accent="send"
									description="Pick a file, share the offer."
									icon={<ArrowUpFromLine className="h-6 w-6" />}
									onSelect={selectSend}
									title="Send"
								/>
								<ModeCard
									accent="receive"
									description="Scan a QR or paste an offer."
									icon={<ArrowDownToLine className="h-6 w-6" />}
									onSelect={selectReceive}
									title="Receive"
								/>
							</div>
							<footer className="space-y-3 text-center text-muted-foreground text-xs">
								{" "}
								{incoming !== null && (
									<IncomingPairingBanner
										localId={localId}
										onAccept={handleIncomingAccept}
										onReject={handleIncomingReject}
										request={incoming}
									/>
								)}
								{incomingDone !== null && (
									<p className="rounded-lg border border-receive-muted bg-receive-muted/30 px-4 py-3 text-receive">
										File received:{" "}
										<code className="font-mono">{incomingDone}</code>
									</p>
								)}
								Transfers flow peer-to-peer, powered by Hyperdrive.
							</footer>
							<RecentTransfers />
							<TrustedDevices />
						</div>
					) : (
						<div className="w-full max-w-xl space-y-4">
							<button
								className="text-muted-foreground text-sm transition hover:text-foreground"
								onClick={selectNone}
								type="button"
							>
								← Back
							</button>
							{mode === "send" ? (
								<SendWizard
									localId={localId}
									localName={localName}
									transfer={transfer}
								/>
							) : (
								<ReceiveWizard
									localId={localId}
									localName={localName}
									transfer={transfer}
								/>
							)}
						</div>
					)}
				</div>
			</main>
		</>
	);
}
