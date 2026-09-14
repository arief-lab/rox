// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Spike: what does expo-camera actually give us per frame?
 *
 * Two candidate paths for feeding a QR decoder:
 *  1. onBarcodeScanned — native barcode scanner (ML Kit / AVFoundation).
 *     Zero JS decode cost, but rate-limited by the native scanner and
 *     returns `data` as a string. Symbol frames would need a text-safe
 *     encoding (base64) inside the QR. Fine for the pairing QR (short
 *     payloads); this spike measures its sustained hits/sec on a
 *     looping stream.
 *  2. takePictureAsync loop — grab stills on a timer and decode them
 *     ourselves (where zxing-wasm plugs in, binary QR payloads work).
 *     Each shot has shutter overhead; this spike measures real fps.
 *
 * (react-native-vision-camera frame processors are the third path —
 * raw frames via JSI — but a second camera dependency; only if 1 and 2
 * undershoot.)
 *
 * This screen logs timing to on-screen lines and the console.
 */

import {
	type BarcodeScanningResult,
	CameraView,
	useCameraPermissions,
} from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";

type CaptureMode = "idle" | "scanner" | "still-loop";

/** Target still-loop cadence (~5 fps) before decode cost. */
const STILL_LOOP_INTERVAL_MS = 200;

export default function FrameSpikeScreen() {
	const [permission, requestPermission] = useCameraPermissions();
	const [mode, setMode] = useState<CaptureMode>("idle");
	const [log, setLog] = useState<string[]>([]);
	const [scannerHits, setScannerHits] = useState(0);
	const loopActive = useRef(false);
	const cameraRef = useRef<CameraView | null>(null);

	const appendLog = useCallback((line: string) => {
		const stamp = new Date().toISOString().slice(11, 23);
		setLog((prev) => [`[${stamp}] ${line}`, ...prev].slice(0, 40));
	}, []);

	const handleStartScanner = useCallback(() => {
		setMode("scanner");
		appendLog("scanner mode on");
	}, [appendLog]);

	const handleToggleStillLoop = useCallback(() => {
		if (mode === "still-loop") {
			loopActive.current = false;
			setMode("idle");
			return;
		}
		setMode("still-loop");
	}, [mode]);

	const handleReset = useCallback(() => {
		loopActive.current = false;
		setMode("idle");
		setLog([]);
		setScannerHits(0);
	}, []);

	const handleBarcode = useCallback(
		(event: BarcodeScanningResult) => {
			setScannerHits((n) => {
				appendLog(`scanner hit #${n + 1}: len=${event.data.length}`);
				return n + 1;
			});
		},
		[appendLog]
	);

	// Still-loop: capture paced by a timer, timings logged per frame.
	useEffect(() => {
		if (mode !== "still-loop") {
			return;
		}
		let cancelled = false;

		// Capture on the timer instead of a tight await-loop: each tick
		// fires one still and records its latency; the interval paces the
		// loop to roughly the sender's frame rate.
		const timer = setInterval(() => {
			const camera = cameraRef.current;
			// The CameraView mounts with the mode; a missing ref means the
			// native view has not attached yet — skip this tick.
			if (camera === null) {
				return;
			}
			const start = Date.now();
			camera
				.takePictureAsync({ pictureRef: true })
				.then(() => {
					if (!cancelled) {
						appendLog(`still captured in ${Date.now() - start}ms`);
					}
				})
				.catch((error: unknown) => {
					if (!cancelled) {
						appendLog(`still failed: ${String(error)}`);
					}
					clearInterval(timer);
					setMode("idle");
				});
		}, STILL_LOOP_INTERVAL_MS);

		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [mode, appendLog]);

	if (!permission) {
		return (
			<View style={styles.center}>
				<Text>Loading…</Text>
			</View>
		);
	}
	if (!permission.granted) {
		return (
			<View style={styles.center}>
				<Text>Camera permission needed for the spike.</Text>
				<Button onPress={requestPermission} title="Grant" />
			</View>
		);
	}

	return (
		<ScrollView contentContainerStyle={styles.container}>
			<Text style={styles.heading}>expo-camera frame-access spike</Text>
			<Text style={styles.note}>
				Mode: {mode} · scanner hits: {scannerHits}
			</Text>
			<View style={styles.buttons}>
				<Button onPress={handleStartScanner} title="1: native barcodeScanner" />
				<Button
					onPress={handleToggleStillLoop}
					title={mode === "still-loop" ? "stop still loop" : "2: still-loop"}
				/>
				<Button onPress={handleReset} title="reset" />
			</View>
			{mode === "idle" ? null : (
				<CameraView
					barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
					facing="back"
					onBarcodeScanned={mode === "scanner" ? handleBarcode : undefined}
					ref={cameraRef}
					style={styles.camera}
				/>
			)}
			{log.map((line) => (
				<Text key={line} style={styles.logLine}>
					{line}
				</Text>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	buttons: { gap: 8, marginBottom: 12 },
	camera: { height: 240, marginBottom: 12 },
	center: { alignItems: "center", flex: 1, justifyContent: "center" },
	container: { padding: 16 },
	heading: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
	logLine: { fontSize: 11, marginBottom: 2 },
	note: { color: "#666", marginBottom: 12 },
});
