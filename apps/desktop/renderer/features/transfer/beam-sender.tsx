"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * BeamSender — "Beam via screen": the optical transfer path.
 *
 * The chosen file is fountain-coded in the main process into a looping
 * list of QR frames; this component plays them fullscreen (black
 * overlay, one QR at a time) so a phone running Rox's Beam receiver
 * can reassemble the file off the screen. One-way, no pairing, no
 * network — and therefore no encryption: anything that sees the frames
 * can read the file, so the notice stays on screen until beaming
 * starts.
 *
 * ESC or a click exits; the wizard underneath is untouched.
 */

import { type DragEvent, useCallback, useEffect, useState } from "react";

import { QrCode } from "../../shared/qr-code";

/** Milliseconds one QR frame stays on screen (matches native cadence). */
const FRAME_INTERVAL_MS = 250;

const PATH_SPLIT_RE = /[\\/]/;

type BeamPhase = "pick" | "beaming";

interface BeamPrepared {
	frames: string[];
	name: string;
	pieceCount: number;
}

export function BeamSender({ onClose }: { onClose: () => void }) {
	const [phase, setPhase] = useState<BeamPhase>("pick");
	const [beam, setBeam] = useState<BeamPrepared | null>(null);
	const [frameIndex, setFrameIndex] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [dragActive, setDragActive] = useState(false);

	// Cycle through the header + symbol frames in a tight loop; the
	// receiver collects across cycles, so order is not load-bearing.
	useEffect(() => {
		if (phase !== "beaming" || beam === null) {
			return;
		}
		const timer = setInterval(() => {
			setFrameIndex((prev) => (prev + 1) % beam.frames.length);
		}, FRAME_INTERVAL_MS);
		return () => {
			clearInterval(timer);
		};
	}, [phase, beam]);

	// ESC exits fullscreen beaming.
	useEffect(() => {
		if (phase !== "beaming") {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [phase, onClose]);

	const startBeam = useCallback((filePath: string, name: string) => {
		window.ipc.beam
			.prepare(filePath, name)
			.then((result) => {
				setBeam(result);
				setFrameIndex(0);
				setPhase("beaming");
			})
			.catch(() => {
				setError("Could not read that file for beaming.");
			});
	}, []);

	const handleBrowse = useCallback(() => {
		window.ipc.files.browse().then((result) => {
			if (result.path) {
				const name = result.path.split(PATH_SPLIT_RE).pop() ?? "file";
				startBeam(result.path, name);
			}
		});
	}, [startBeam]);

	const handleDrop = useCallback(
		(event: DragEvent<HTMLElement>) => {
			event.preventDefault();
			setDragActive(false);
			const [file] = event.dataTransfer.files;
			if (file) {
				const path = window.ipc.getPathForFile(file);
				if (path !== "") {
					startBeam(path, file.name);
				}
			}
		},
		[startBeam]
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

	const handleBeamKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Escape" || event.key === "Enter") {
				onClose();
			}
		},
		[onClose]
	);

	if (phase === "beaming" && beam !== null) {
		const cyclePosition = frameIndex === 0 ? 0 : frameIndex;
		return (
			// Fullscreen overlay: a real <button> can't host this layout, so the
			// div keeps role="button" with keyboard handling below.
			// biome-ignore lint/a11y/useSemanticElements: fullscreen overlay needs div-level layout
			<div
				aria-label="Optical beam fullscreen QR stream"
				className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black"
				onClick={onClose}
				onKeyDown={handleBeamKeyDown}
				role="button"
				tabIndex={0}
			>
				<QrCode payload={beam.frames[frameIndex] ?? ""} size={420} />
				<p className="font-mono text-neutral-400 text-xs">
					frame {cyclePosition} / {beam.frames.length - 1} · {beam.pieceCount}{" "}
					pieces needed · {beam.name}
				</p>
				<p className="text-neutral-500 text-xs">
					Hold the phone camera steady at the screen. Press ESC or click to
					stop.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div>
				<p className="font-medium text-send text-xs uppercase tracking-wide">
					Beam via screen
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					No network at all: the file is played as a stream of QR codes on this
					screen, and the other device's camera reassembles it with Rox's Beam
					receiver.
				</p>
			</div>

			<div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
				<p className="text-destructive text-xs">
					Not encrypted: anyone who sees these frames — in person or on camera —
					can read the file. Beam is for content you're fine displaying.
				</p>
			</div>

			<button
				className={`flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
					dragActive
						? "border-send bg-send-muted/30"
						: "border-border hover:border-send/60"
				}`}
				onClick={handleBrowse}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				type="button"
			>
				<p className="font-medium text-foreground">
					{dragActive ? "Drop to start beaming" : "Choose a file to beam"}
				</p>
				<p className="text-muted-foreground text-sm">
					click to browse, or drop a file here
				</p>
			</button>

			{error === null ? null : (
				<p className="text-destructive text-sm">{error}</p>
			)}

			<button
				className="rounded-lg border px-4 py-2 text-muted-foreground text-sm transition hover:text-foreground"
				onClick={onClose}
				type="button"
			>
				Back
			</button>
		</div>
	);
}
