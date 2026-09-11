import { Button, Chip, Separator, Surface } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";

export default function Home() {
	return (
		<Container className="px-4 pb-4">
			<View className="py-6 mb-5">
				<Text className="text-3xl font-semibold text-foreground tracking-tight">
					Rox
				</Text>
				<Text className="text-muted text-sm mt-1">
					Peer-to-peer file sharing
				</Text>
			</View>

			<Surface variant="secondary" className="p-4 rounded-xl">
				<View className="flex-row items-center justify-between mb-3">
					<Text className="text-foreground font-medium">Transfer</Text>
					<Chip variant="secondary" color="default" size="sm">
						<Chip.Label>SOON</Chip.Label>
					</Chip>
				</View>

				<Separator className="mb-3" />

				<Surface variant="tertiary" className="p-3 rounded-lg">
					<View className="flex-row items-center">
						<View className="flex-1">
							<Text className="text-foreground text-sm font-medium">
								Peer transfer via Pear stack
							</Text>
							<Text className="text-muted text-xs mt-0.5">
								Native Bare worklet transport lands with the native client work
							</Text>
						</View>
					</View>
				</Surface>

				<Button variant="primary" className="mt-4" isDisabled>
					<Button.Label>Send a file (coming soon)</Button.Label>
				</Button>
			</Surface>
		</Container>
	);
}
