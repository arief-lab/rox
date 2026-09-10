"use client";

// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * QR utilities for the transfer features:
 *  - QrCode: renders a payload string to a canvas (qrcode package)
 *  - useQrScanner: opens the camera and scans frames with jsQR,
 *    calling onResult with the decoded string. Camera cleanup is
 *    automatic on unmount.
 */

import jsQR from "jsqr";
import QRCode from "qrcode";
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

export function QrCode({
	payload,
	size = 220,
}: {
	payload: string;
	size?: number;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		QRCode.toCanvas(canvas, payload, {
			color: { dark: "#0a0a0a", light: "#ffffff" },
			margin: 2,
			width: size,
		}).catch(() => {
			// Rendering failure leaves the canvas blank; caller shows the
			// text payload alongside, so scanning can still happen.
		});
	}, [payload, size]);

	return (
		<canvas
			aria-label="Transfer offer QR code"
			className="rounded-lg bg-white p-2"
			ref={canvasRef}
		/>
	);
}

export function useQrScanner(onResult: (payload: string) => void): {
	videoRef: RefObject<HTMLVideoElement | null>;
	scanning: boolean;
	error: string | null;
	start: () => void;
	stop: () => void;
} {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const rafRef = useRef<number | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [scanning, setScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const onResultRef = useRef(onResult);
	onResultRef.current = onResult;

	const stop = useCallback(() => {
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
		setScanning(false);
	}, []);

	const start = useCallback(() => {
		setError(null);
		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: "environment" } })
			.then((stream) => {
				streamRef.current = stream;
				const video = videoRef.current;
				if (!video) {
					stop();
					return;
				}
				video.srcObject = stream;
				video.play();
				setScanning(true);

				const canvas = canvasRef.current ?? document.createElement("canvas");
				canvasRef.current = canvas;
				const context = canvas.getContext("2d", { willReadFrequently: true });

				const tick = () => {
					if (!(streamRef.current && context && video.videoWidth)) {
						rafRef.current = requestAnimationFrame(tick);
						return;
					}
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;
					context.drawImage(video, 0, 0);
					const image = context.getImageData(0, 0, canvas.width, canvas.height);
					const code = jsQR(image.data, image.width, image.height);
					if (code?.data) {
						stop();
						onResultRef.current(code.data);
						return;
					}
					rafRef.current = requestAnimationFrame(tick);
				};
				rafRef.current = requestAnimationFrame(tick);
			})
			.catch(() => {
				setError("Camera unavailable — paste the offer manually instead.");
			});
	}, [stop]);

	useEffect(() => stop, [stop]);

	return { error, scanning, start, stop, videoRef };
}
