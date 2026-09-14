// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Beam — the optical transfer hub: send (show) or receive (scan).
 * One-way, no pairing, no network: the payload travels as light.
 */

import { Link } from "expo-router";
import { Button, Separator, Surface } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function Beam() {
	return (
		<Container className="px-4 pb-4">
			<View className="mb-5 py-6">
				<Text className="font-semibold text-3xl text-foreground tracking-tight">
					Beam
				</Text>
				<Text className="mt-1 text-muted text-sm">
					Send a file with nothing but a screen and a camera — no network.
				</Text>
			</View>

			<Surface className="rounded-xl p-4" variant="secondary">
				<Link asChild href="/beam-send">
					<Button className="mb-3" variant="primary">
						<Button.Label>Send — show a moving QR stream</Button.Label>
					</Button>
				</Link>
				<Separator className="mb-3" />
				<Link asChild href="/beam-receive">
					<Button variant="secondary">
						<Button.Label>Receive — scan the sender's screen</Button.Label>
					</Button>
				</Link>
			</Surface>

			<Text className="mt-4 text-muted text-xs">
				Beam is one-way and unencrypted: whatever is on the sending screen is
				readable by any camera pointed at it. Keep payloads shareable.
			</Text>
		</Container>
	);
}
