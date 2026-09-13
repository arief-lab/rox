"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Home — entry point for the transfer flow. Picks send or receive, then
 * hands off to the matching wizard leg. Layout is a compact, centered
 * utility window: the mode cards ARE the app.
 */

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import Head from "next/head";
import { memo, useCallback, useEffect, useState } from "react";
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
	const accentClasses =
		accent === "send"
			? "hover:border-send/60 focus-visible:border-send"
			: "hover:border-receive/60 focus-visible:border-receive";

	return (
		<button
			className={`group flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center transition focus-visible:outline-none ${accentClasses}`}
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

export default function HomePage() {
	const transfer = useTransfer();
	const [mode, setMode] = useState<TransferMode>(null);
	const [localName, setLocalName] = useState("");
	const [localId, setLocalId] = useState("");

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

	const handleSelect = useCallback((next: TransferMode) => {
		setMode(next);
	}, []);
	const selectSend = useCallback(() => handleSelect("send"), [handleSelect]);
	const selectReceive = useCallback(
		() => handleSelect("receive"),
		[handleSelect]
	);
	const selectNone = useCallback(() => handleSelect(null), [handleSelect]);

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
									Peer-to-peer file sharing — no servers, no accounts.
								</p>
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
							</div>{" "}
							<footer className="text-center text-muted-foreground text-xs">
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
