"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * RecentTransfers — compact history list on the home screen. Loads
 * persisted records over IPC; shows direction accents and relative
 * times. Hidden entirely until at least one transfer exists.
 */

import { ArrowDownToLine, ArrowUpFromLine, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface TransferRecord {
	bytes: number;
	completedAt: number;
	direction: "receive" | "send";
	name: string;
	path: string;
	peerName?: string;
}

function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(0)} KB`;
	}
	return `${bytes} B`;
}

function formatRelative(timestamp: number): string {
	const seconds = Math.round((Date.now() - timestamp) / 1000);
	if (seconds < 60) {
		return "just now";
	}
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	return `${Math.round(hours / 24)}d ago`;
}

export function RecentTransfers() {
	const [records, setRecords] = useState<TransferRecord[]>([]);

	const refresh = useCallback(() => {
		window.ipc.history
			.list()
			.then((result) => {
				setRecords(result.records);
			})
			.catch(() => {
				setRecords([]);
			});
	}, []);

	useEffect(() => {
		refresh();
		// Refresh when the window regains focus (e.g. after a transfer).
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, [refresh]);

	const handleClear = useCallback(() => {
		window.ipc.history.clear().then(refresh);
	}, [refresh]);

	if (records.length === 0) {
		return null;
	}

	return (
		<div className="w-full max-w-xl space-y-2">
			<div className="flex items-center justify-between">
				<h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Recent transfers
				</h2>
				<button
					className="flex items-center gap-1 text-muted-foreground text-xs transition hover:text-foreground"
					onClick={handleClear}
					type="button"
				>
					<X className="h-3 w-3" /> Clear
				</button>
			</div>
			<ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				{records.map((record) => (
					<li
						className="flex items-center gap-3 px-4 py-2.5"
						key={`${record.completedAt}-${record.path}`}
					>
						<span
							className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
								record.direction === "send"
									? "bg-send-muted/40 text-send"
									: "bg-receive-muted/40 text-receive"
							}`}
						>
							{record.direction === "send" ? (
								<ArrowUpFromLine className="h-3.5 w-3.5" />
							) : (
								<ArrowDownToLine className="h-3.5 w-3.5" />
							)}
						</span>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium text-foreground text-sm">
								{record.name || record.path}
							</span>
							<span
								className="block truncate text-muted-foreground text-xs"
								title={record.path}
							>
								{record.peerName
									? `${record.direction === "send" ? "to" : "from"} ${record.peerName} — ${record.path}`
									: record.path}
							</span>
						</span>
						<span className="shrink-0 text-right text-muted-foreground text-xs">
							<span className="block">
								{record.bytes > 0 ? formatBytes(record.bytes) : "—"}
							</span>
							<span className="block">
								{formatRelative(record.completedAt)}
							</span>
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
