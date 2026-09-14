// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Worklet dev screen — proves the Bare bridge (TASK-6 AC #1): starts
 * the worklet, sends a message, prints the echo. Dev-only surface; the
 * real transfer UI will drive the same worklet through transports.
 */

import { Button, Surface } from "heroui-native";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { coreMode, workletEcho } from "@/lib/worklet";

export default function WorkletDev() {
	const [status, setStatus] = useState(
		coreMode === "bundle"
			? "core: pear bundle (hyperdrive+hyperswarm) — idle"
			: "core: fallback (echo/rpc stub) — idle"
	);
	const [running, setRunning] = useState(false);

	const handleProbe = useCallback(async () => {
		setRunning(true);
		setStatus("starting worklet…");
		try {
			const reply = await workletEcho("ping from rox");
			setStatus(reply);
		} catch (error: unknown) {
			setStatus(
				`failed: ${error instanceof Error ? error.message : String(error)}`
			);
		} finally {
			setRunning(false);
		}
	}, []);

	return (
		<Container className="px-4 pb-4">
			<View className="flex-1 justify-center gap-4">
				<Text className="font-semibold text-3xl text-foreground tracking-tight">
					Worklet
				</Text>
				<Text className="text-muted text-sm">
					Dev probe for the Bare worklet — the native data plane where the Pear
					stack (Hyperswarm, Hypercore) runs.
				</Text>
				<Surface className="rounded-xl p-4" variant="secondary">
					<Button isDisabled={running} onPress={handleProbe} variant="primary">
						<Button.Label>
							{running ? "Probing…" : "Run echo probe"}
						</Button.Label>
					</Button>
					<Text className="mt-3 font-mono text-muted text-xs">{status}</Text>
				</Surface>
			</View>
		</Container>
	);
}
