const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const {
	wrapWithReanimatedMetroConfig,
} = require("react-native-reanimated/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(import.meta.dirname);

// The Bare worklet bundle (bare-pack output) ships as a raw asset: it
// runs inside the worklet's own runtime, not the RN bundle, so Metro
// must NOT transform it — just copy it and give us a require() handle.
config.resolver.assetExts.push("mjs");

const uniwindConfig = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
	cssEntryFile: "./global.css",
	dtsFile: "./uniwind-types.d.ts",
});

module.exports = uniwindConfig;
