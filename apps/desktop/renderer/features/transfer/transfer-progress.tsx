"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * TransferProgress — renders a live progress bar with transferred
 * bytes, speed, and ETA. Speed/ETA are computed from a short ring of
 * recent samples so a single slow poll doesn't swing the numbers.
 */

import { memo, useEffect, useRef, useState } from "react";

import type { TransferProgress as ProgressSample } from "../../shared/use-transfer";

const SAMPLE_WINDOW_MS = 5000;

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

function formatEta(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return "—";
	}
	if (seconds < 60) {
		return `${Math.ceil(seconds)}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const rest = Math.round(seconds % 60);
	return `${minutes}m ${rest}s`;
}

export const TransferProgress = memo(function TransferProgressInner({
	progress,
}: {
	progress: ProgressSample;
}) {
	const samplesRef = useRef<{ at: number; bytes: number }[]>([]);
	const [speed, setSpeed] = useState<number | null>(null);

	// Recompute speed on each new sample: bytes/sec over the recent
	// window, ignoring counter resets (a new transfer run).
	useEffect(() => {
		const now = Date.now();
		const samples = samplesRef.current;
		const last = samples.at(-1);
		if (last && progress.bytes < last.bytes) {
			samples.length = 0;
		}
		samples.push({ at: now, bytes: progress.bytes });
		while (
			samples.length > 1 &&
			samples[0] !== undefined &&
			now - samples[0].at > SAMPLE_WINDOW_MS
		) {
			samples.shift();
		}
		const [first] = samples;
		if (first && now > first.at) {
			setSpeed((progress.bytes - first.bytes) / ((now - first.at) / 1000));
		}
	}, [progress.bytes]);

	const percent =
		progress.total > 0 ? (progress.bytes / progress.total) * 100 : 0;
	const remaining = progress.total - progress.bytes;
	const eta = speed !== null && speed > 0 ? remaining / speed : Number.NaN;

	return (
		<div className="space-y-2">
			<div
				aria-label="Transfer progress"
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={Math.round(percent)}
				className="h-2 w-full overflow-hidden rounded-full bg-input"
				role="progressbar"
			>
				<div
					className={`h-full rounded-full transition-[width] duration-500 ${
						progress.direction === "send" ? "bg-send" : "bg-receive"
					}`}
					style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
				/>
			</div>
			<div className="flex items-center justify-between text-muted-foreground text-xs">
				<span>
					{formatBytes(progress.bytes)} / {formatBytes(progress.total)}(
					{percent.toFixed(0)}%)
				</span>
				<span>
					{speed === null ? "…" : `${formatBytes(speed)}/s`} · ETA{" "}
					{formatEta(eta)}
				</span>
			</div>
		</div>
	);
});
