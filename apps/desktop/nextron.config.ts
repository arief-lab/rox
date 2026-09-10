// SPDX-License-Identifier: AGPL-3.0-or-later
import path from "node:path";

import type { Configuration } from "webpack";

/**
 * Nextron externalizes every entry in `dependencies`, including the
 * workspace packages (`@rox/*`). Those resolve to raw TypeScript source
 * (`exports: "./src/index.ts"`), which Electron cannot execute — so we
 * un-externalize them and let webpack bundle the source, extending the
 * ts-loader rule to cover `packages/core/src`.
 */
const coreSrc = path.resolve(__dirname, "../../packages/core/src");

export const webpack = (config: Configuration): Configuration => {
	const externals = config.externals;
	if (Array.isArray(externals)) {
		config.externals = externals.filter(
			(entry) => !(typeof entry === "string" && entry.startsWith("@rox/")),
		);
	}

	for (const rule of config.module?.rules ?? []) {
		if (typeof rule !== "object" || rule === null || !("use" in rule)) {
			continue;
		}
		const use = rule.use;
		const loader =
			typeof use === "object" && use !== null && "loader" in use
				? use.loader
				: undefined;
		if (typeof loader === "string" && loader.includes("ts-loader")) {
			rule.include = [rule.include, coreSrc].filter(Boolean);
		}
	}

	return config;
};
