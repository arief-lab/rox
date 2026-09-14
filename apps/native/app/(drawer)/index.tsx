import { Link } from "expo-router";
import { Button, Chip, Separator, Surface } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function Home() {
	return (
		<Container className="px-4 pb-4">
			<View className="mb-5 py-6">
				<Text className="font-semibold text-3xl text-foreground tracking-tight">
					Rox
				</Text>
				<Text className="mt-1 text-muted text-sm">
					Peer-to-peer file sharing
				</Text>
			</View>

			<Surface className="rounded-xl p-4" variant="secondary">
				<View className="mb-3 flex-row items-center justify-between">
					<Text className="font-medium text-foreground">Transfer</Text>
					<Chip color="default" size="sm" variant="secondary">
						<Chip.Label>SOON</Chip.Label>
					</Chip>
				</View>

				<Separator className="mb-3" />

				<Surface className="rounded-lg p-3" variant="tertiary">
					<View className="flex-row items-center">
						<View className="flex-1">
							<Text className="font-medium text-foreground text-sm">
								Peer transfer via Pear stack
							</Text>
							<Text className="mt-0.5 text-muted text-xs">
								Native Bare worklet transport lands with the native client work
							</Text>
						</View>
					</View>
				</Surface>

				<Link asChild href="/(drawer)/beam">
					<Button className="mt-4" variant="primary">
						<Button.Label>Beam a file (screen to camera)</Button.Label>
					</Button>
				</Link>
				<Text className="mt-2 text-center text-muted text-xs">
					One-way, unencrypted, no network — text only for now.
				</Text>
			</Surface>
		</Container>
	);
}
