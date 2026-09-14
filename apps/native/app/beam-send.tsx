// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Beam send — pick a file (or type a message), then beam it as a
 * looping QR stream. Fullscreen white-on-black QRs, screen brightness
 * maxed while open.
 */

import { getBrightnessAsync, setBrightnessAsync } from "expo-brightness";
import { getDocumentAsync } from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Separator, Surface } from "heroui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Container } from "@/components/container";
import {
	type BeamSession,
	createBeamSession,
	createBeamSessionFromBytes,
} from "@/lib/beam";

/** Milliseconds each frame stays on screen (tune after device timing). */
const FRAME_INTERVAL_MS = 250;

export default function BeamSend() {
	const params = useLocalSearchParams<{ text?: string }>();
	const router = useRouter();
	const draft = typeof params.text === "string" ? params.text : "";
	const [started, setStarted] = useState(false);
	const [frame, setFrame] = useState(-1); // -1 = header frame
	const [picking, setPicking] = useState(false);
	const [pickError, setPickError] = useState<string | null>(null);

	// Either a picked file (bytes + name) or the typed text draft.
	const [fileSource, setFileSource] = useState<{
		bytes: Uint8Array;
		name: string;
	} | null>(null);

	const session: BeamSession | null = useMemo(() => {
		if (fileSource !== null) {
			return createBeamSessionFromBytes(fileSource.bytes, fileSource.name);
		}
		if (draft.trim() === "") {
			return null;
		}
		return createBeamSession(draft);
	}, [draft, fileSource]);

	const label = fileSource?.name ?? draft;

	const handleCompose = useCallback(() => {
		router.push("/beam-compose");
	}, [router]);

	const handleChooseAgain = useCallback(() => {
		setFileSource(null);
	}, []);

	const handlePickFile = useCallback(async () => {
		setPickError(null);
		setPicking(true);
		try {
			const result = await getDocumentAsync({
				copyToCacheDirectory: true,
			});
			if (result.canceled || result.assets.length === 0) {
				return;
			}
			const [asset] = result.assets;
			const response = await fetch(asset.uri);
			const buffer = await response.arrayBuffer();
			setFileSource({
				bytes: new Uint8Array(buffer),
				name: asset.name ?? "file",
			});
		} catch {
			setPickError("Could not read that file.");
		} finally {
			setPicking(false);
		}
	}, []);

	// Max brightness while beaming; restore on exit.
	useEffect(() => {
		if (!started) {
			return;
		}
		let original: number | null = null;
		getBrightnessAsync()
			.then((value: number) => {
				original = value;
				return setBrightnessAsync(1);
			})
			.catch(() => undefined);
		return () => {
			// Best-effort restore; Android needs the write-settings
			// permission, without which this silently no-ops.
			setBrightnessAsync(original ?? 0.5).catch(() => undefined);
		};
	}, [started]);

	const handleStart = useCallback(() => {
		setStarted(true);
	}, []);

	// The frame ticker: header first, then the symbol loop.
	useEffect(() => {
		if (!(started && session)) {
			return;
		}
		const timer = setInterval(() => {
			setFrame((current) => {
				const next = current + 1;
				return next >= session.streamLength ? -1 : next;
			});
		}, FRAME_INTERVAL_MS);
		return () => {
			clearInterval(timer);
		};
	}, [started, session]);

	const handleStop = useCallback(() => {
		router.dismissTo("/(drawer)/beam");
	}, [router]);

	if (!session) {
		return (
			<Container className="px-4 pb-4">
				<View className="flex-1 justify-center gap-4">
					<Text className="font-medium text-foreground text-lg">
						What do you want to beam?
					</Text>
					<Surface className="rounded-xl p-4" variant="secondary">
						<Button
							isDisabled={picking}
							onPress={handlePickFile}
							variant="primary"
						>
							<Button.Label>
								{picking ? "Reading file…" : "Pick a file"}
							</Button.Label>
						</Button>
						<Separator className="my-3" />
						<Button
							isDisabled={picking}
							onPress={handleCompose}
							variant="secondary"
						>
							<Button.Label>Type a message instead</Button.Label>
						</Button>
					</Surface>
					{pickError === null ? null : (
						<Text className="text-destructive text-sm">{pickError}</Text>
					)}
					<Text className="text-muted text-xs">
						Files are fountain-coded into QR frames — big files take a while (a
						100 KB file needs a few minutes of steady camera).
					</Text>
				</View>
			</Container>
		);
	}

	if (started) {
		const payload = session.qrPayloadAt(frame);
		return (
			<Pressable onPress={handleStop} style={styles.beamRoot}>
				<View style={styles.qrBox}>
					<QRCode
						backgroundColor="#ffffff"
						color="#000000"
						size={340}
						value={payload}
					/>
				</View>
				<Text style={styles.hint}>
					{frame < 0 ? "header" : `symbol ${frame + 1}/${session.streamLength}`}{" "}
					— tap to stop
				</Text>
			</Pressable>
		);
	}

	return (
		<Container className="px-4 pb-4">
			<View className="flex-1 justify-center">
				<Text className="font-medium text-foreground text-lg">
					Ready to beam
				</Text>
				<Text className="mt-2 mb-6 text-muted text-sm" numberOfLines={4}>
					{label}
				</Text>
				<Text className="mb-4 text-muted text-xs">
					{session.header.pieceCount} pieces · loop of {session.streamLength}{" "}
					frames · ~
					{Math.round((session.streamLength * FRAME_INTERVAL_MS) / 1000)}s per
					cycle
				</Text>
				<Pressable onPress={handleStart} style={styles.startButton}>
					<Text style={styles.startLabel}>Start beaming</Text>
				</Pressable>
				{fileSource === null ? null : (
					<Pressable onPress={handleChooseAgain} style={styles.chooseAgain}>
						<Text style={styles.chooseAgainLabel}>Choose something else</Text>
					</Pressable>
				)}
				<Text className="mt-4 text-center text-muted text-xs">
					Unencrypted: any camera can read this. Tap the beam to stop.
				</Text>
			</View>
		</Container>
	);
}

const styles = StyleSheet.create({
	beamRoot: {
		alignItems: "center",
		backgroundColor: "#000000",
		flex: 1,
		justifyContent: "center",
	},
	chooseAgain: {
		alignItems: "center",
		marginTop: 12,
		paddingVertical: 8,
	},
	chooseAgainLabel: {
		color: "#737373",
		fontSize: 13,
	},
	hint: {
		color: "#888888",
		fontSize: 12,
		marginTop: 24,
	},
	qrBox: {
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 16,
	},
	startButton: {
		alignItems: "center",
		backgroundColor: "#10b981",
		borderRadius: 12,
		paddingVertical: 14,
	},
	startLabel: {
		color: "#052e22",
		fontSize: 16,
		fontWeight: "600",
	},
});
