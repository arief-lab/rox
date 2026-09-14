// Link every `addon: true` package in the app's node_modules into
// prebuilt .so files Gradle packages (react-native-bare-kit reads
// android/src/main/addons via its jniLibs.srcDirs).
// Run from apps/native: bun scripts/link-worklet-addons.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";
import link from "bare-link";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

// The Pear-stack packages the worklet bundle links against. bare-link
// walks each package's own dependency tree, so listing the roots is
// enough to reach every transitive addon.
const ROOTS = ["hyperdrive", "hyperswarm", "bare-fs", "bare-crypto", "b4a"];

for (const name of ROOTS) {
	const base = path.join(root, "node_modules", name);
	// Sequential by design: bare-link writes into a shared output dir,
	// and its generator is safe to serialize with await-in-loop.
	// biome-ignore lint/performance/noAwaitInLoops: sequential addon linking is intentional
	for await (const resource of link(base, {
		hosts: ["android-arm64", "android-x64"],
		out: path.join(
			root,
			"node_modules/react-native-bare-kit/android/src/main/addons"
		),
	})) {
		console.log("linked:", path.basename(resource));
	}
}
