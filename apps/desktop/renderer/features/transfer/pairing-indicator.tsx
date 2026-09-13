// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PairingIndicator — shows the pairing handshake state between this
 * device and the peer:
 *  1. waiting   — pulsing dot, nobody connected yet
 *  2. confirm   — peer said hello; safety code shown; Accept/Reject
 *  3. waiting-ok — accepted locally, waiting for the peer's approval
 *  4. paired    — both sides accepted; transfers may flow
 *
 * The safety code (two 4-digit groups) is derived from both device ids
 * via `pairSafetyCode`, so both screens show the SAME words. If they
 * match, the channel is not being intercepted.
 */

import { pairSafetyCode } from "@rox/core";
import { ShieldCheck } from "lucide-react";
import { memo } from "react";

export type PairingStage = "waiting" | "confirm" | "waiting-remote" | "paired";

/** The safety code panel — visible whenever a peer is identified. */
const SafetyCode = memo(function SafetyCodePanel({ code }: { code: string }) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-lg border bg-input px-4 py-3">
			<div>
				<p className="text-muted-foreground text-xs uppercase tracking-wide">
					Safety code
				</p>
				<p className="font-mono font-semibold text-foreground text-xl tracking-widest">
					{code}
				</p>
			</div>
			<p className="max-w-48 text-right text-muted-foreground text-xs">
				Confirm this code matches on{" "}
				<span className="text-foreground">both devices</span> before accepting.
			</p>
		</div>
	);
});

export const PairingIndicator = memo(function PairingIndicatorPanel({
	localId,
	localName,
	onAccept,
	onReject,
	pairedDevice,
	stage,
	trusted = false,
}: {
	/** This device's id (needed to derive the shared safety code). */
	localId: string;
	localName: string;
	onAccept: () => void;
	onReject: () => void;
	pairedDevice: { id: string; name: string } | null;
	stage: PairingStage;
	/** Auto-accepted via the trust list — shows the badge. */
	trusted?: boolean;
}) {
	if (stage === "paired" && pairedDevice !== null) {
		return (
			<div
				aria-live="polite"
				className="flex items-center gap-3 rounded-lg border border-receive-muted bg-receive-muted/30 px-4 py-3"
			>
				<span
					aria-hidden={true}
					className="h-2 w-2 shrink-0 rounded-full bg-receive"
				/>
				<p className="flex flex-wrap items-center gap-x-2 text-foreground text-sm">
					<span>
						Paired with{" "}
						<span className="font-medium text-receive">
							{pairedDevice.name}
						</span>
					</span>
					{trusted ? (
						<span className="inline-flex items-center gap-1 rounded-full border border-receive-muted bg-receive-muted/40 px-2 py-0.5 text-muted-foreground text-xs">
							<ShieldCheck
								aria-hidden={true}
								className="h-3 w-3 text-receive"
							/>
							Trusted
						</span>
					) : null}
				</p>
			</div>
		);
	}

	if (stage === "confirm" && pairedDevice !== null) {
		return (
			<div className="space-y-3 rounded-lg border border-send-muted bg-send-muted/30 p-4">
				<p className="text-foreground text-sm">
					<span className="font-medium text-send">{pairedDevice.name}</span>{" "}
					wants to pair with <span className="font-medium">{localName}</span>.
				</p>
				<SafetyCode code={pairSafetyCode(localId, pairedDevice.id)} />
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
	}

	if (stage === "waiting-remote") {
		return (
			<div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
				<span
					aria-hidden={true}
					className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-send"
				/>
				<p className="text-muted-foreground text-sm">
					Waiting for{" "}
					<span className="text-foreground">
						{pairedDevice?.name ?? "the other device"}
					</span>{" "}
					to accept…
				</p>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
			<span
				aria-hidden={true}
				className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-muted-foreground"
			/>
			<p className="text-muted-foreground text-sm">
				Waiting for a device. {localName || "this device"} is discoverable
			</p>
		</div>
	);
});
