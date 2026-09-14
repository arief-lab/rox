// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Beam receive — point the camera at a sending screen; the native QR
 * scanner decodes frames, the core codec peels and verifies. Shows
 * live K-of-N progress and the reconstructed text on completion.
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { BeamReceiver, type BeamResult } from "@/lib/beam";

export default function BeamReceive() {
	const [permission, requestPermission] = useCameraPermissions();
	const router = useRouter();
	const receiverRef = useRef<BeamReceiver | null>(null);
	if (receiverRef.current === null) {
		receiverRef.current = new BeamReceiver();
	}
	const [collected, setCollected] = useState(0);
	const [needed, setNeeded] = useState(0);
	const [decoded, setDecoded] = useState(0);
	const [done, setDone] = useState(false);
	const [result, setResult] = useState<BeamResult | null>(null);
	const [foreign] = useState(0);

	const watchingLine =
		foreign > 0
			? `Watching… (${foreign} non-beam QR ignored)`
			: "Point at a Rox beam — waiting for the header frame";
	const statusLine =
		needed === 0
			? watchingLine
			: `Decoding: ${decoded}/${needed} pieces · ${collected} symbols seen`;

	const handleBarcode = useCallback((event: { data: string }) => {
		// The lazy-init above guarantees this is set before any scan fires.
		const receiverInstance = receiverRef.current;
		if (receiverInstance === null) {
			return;
		}
		const complete = receiverInstance.ingest(event.data);
		const {
			collected: seen,
			decoded: pieces,
			needed: total,
		} = receiverInstance.progress;
		setCollected(seen);
		setNeeded(total);
		setDecoded(pieces);
		if (complete) {
			setResult(receiverInstance.result);
			setDone(true);
		}
	}, []);

	const handleDoneDismiss = useCallback(() => {
		router.dismissTo("/(drawer)/beam");
	}, [router]);

	if (!permission) {
		return (
			<Container className="px-4 pb-4">
				<View className="flex-1 items-center justify-center">
					<Text className="text-muted">Loading…</Text>
				</View>
			</Container>
		);
	}

	if (!permission.granted) {
		return (
			<Container className="px-4 pb-4">
				<View className="flex-1 items-center justify-center gap-4">
					<Text className="text-center text-muted">
						The camera is the receiver. Grant access to scan a beam.
					</Text>
					<Pressable onPress={requestPermission} style={styles.grantButton}>
						<Text style={styles.grantLabel}>Grant camera access</Text>
					</Pressable>
				</View>
			</Container>
		);
	}

	if (done && result !== null) {
		return (
			<Container className="px-4 pb-4">
				<ScrollView contentContainerStyle={styles.doneWrap}>
					<View style={styles.doneBox}>
						<Text style={styles.doneTitle}>Received & verified</Text>
						<Text style={styles.doneSha}>
							sha256 {result.sha256.slice(0, 16)}…
						</Text>
					</View>
					<Text style={styles.resultText}>{result.text}</Text>
					<Pressable onPress={handleDoneDismiss} style={styles.againButton}>
						<Text style={styles.againLabel}>Beam another</Text>
					</Pressable>
				</ScrollView>
			</Container>
		);
	}

	return (
		<Container className="px-4 pb-4">
			<View style={styles.cameraWrap}>
				<CameraView
					barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
					facing="back"
					onBarcodeScanned={done ? undefined : handleBarcode}
					style={styles.camera}
				/>
			</View>
			<View style={styles.statusWrap}>
				<Text style={styles.statusText}>{statusLine}</Text>
				{needed > 0 ? (
					<View style={styles.barTrack}>
						<View
							style={[
								styles.barFill,
								{ width: `${Math.min(100, (decoded / needed) * 100)}%` },
							]}
						/>
					</View>
				) : null}
				<Text style={styles.noteText}>
					One-way and unencrypted — receive only what you trust.
				</Text>
			</View>
		</Container>
	);
}

const styles = StyleSheet.create({
	againButton: {
		alignItems: "center",
		backgroundColor: "#10b981",
		borderRadius: 12,
		marginTop: 24,
		paddingVertical: 14,
	},
	againLabel: {
		color: "#052e22",
		fontSize: 16,
		fontWeight: "600",
	},
	barFill: {
		backgroundColor: "#10b981",
		borderRadius: 999,
		height: "100%",
	},
	barTrack: {
		backgroundColor: "#262626",
		borderRadius: 999,
		height: 8,
		marginTop: 10,
		overflow: "hidden",
		width: "100%",
	},
	camera: {
		flex: 1,
	},
	cameraWrap: {
		borderRadius: 16,
		overflow: "hidden",
	},
	doneBox: {
		alignSelf: "flex-start",
		backgroundColor: "#0c3b2e",
		borderRadius: 12,
		marginTop: 24,
		padding: 16,
	},
	doneSha: {
		color: "#86efac",
		fontSize: 12,
		marginTop: 4,
	},
	doneTitle: {
		color: "#a7f3d0",
		fontSize: 16,
		fontWeight: "600",
	},
	doneWrap: {
		paddingBottom: 40,
	},
	grantButton: {
		alignItems: "center",
		backgroundColor: "#10b981",
		borderRadius: 12,
		paddingHorizontal: 24,
		paddingVertical: 12,
	},
	grantLabel: {
		color: "#052e22",
		fontWeight: "600",
	},
	noteText: {
		color: "#737373",
		fontSize: 11,
		marginTop: 10,
		textAlign: "center",
	},
	resultText: {
		backgroundColor: "#171717",
		borderRadius: 12,
		color: "#e5e5e5",
		fontSize: 13,
		marginTop: 16,
		padding: 16,
	},
	statusText: {
		color: "#e5e5e5",
		fontSize: 13,
		textAlign: "center",
	},
	statusWrap: {
		paddingTop: 16,
		width: "100%",
	},
});
