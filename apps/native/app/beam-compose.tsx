// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Beam compose — type a short message to beam as text. Hands the draft
 * to beam-send via the text param (kept separate so the file path and
 * the text path stay simple).
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";

export default function BeamCompose() {
	const params = useLocalSearchParams<{ text?: string }>();
	const router = useRouter();
	const initial = typeof params.text === "string" ? params.text : "";
	const [draft, setDraft] = useState(initial);

	const handleBeam = () => {
		router.dismissTo({
			params: { text: draft },
			pathname: "/beam-send",
		});
	};

	return (
		<Container className="px-4 pb-4">
			<View className="flex-1 justify-center gap-4">
				<Text className="font-medium text-foreground text-lg">
					Message to beam
				</Text>
				<TextInput
					multiline
					onChangeText={setDraft}
					placeholder="Paste or type text…"
					style={styles.input}
					value={draft}
				/>
				<Pressable
					disabled={draft.trim() === ""}
					onPress={handleBeam}
					style={[styles.button, draft.trim() === "" && styles.disabled]}
				>
					<Text style={styles.buttonLabel}>Continue</Text>
				</Pressable>
			</View>
		</Container>
	);
}

const styles = StyleSheet.create({
	button: {
		alignItems: "center",
		backgroundColor: "#10b981",
		borderRadius: 12,
		paddingVertical: 14,
	},
	buttonLabel: {
		color: "#052e22",
		fontSize: 16,
		fontWeight: "600",
	},
	disabled: {
		opacity: 0.4,
	},
	input: {
		backgroundColor: "#171717",
		borderRadius: 12,
		color: "#e5e5e5",
		fontSize: 14,
		minHeight: 120,
		padding: 16,
		textAlignVertical: "top",
	},
});
