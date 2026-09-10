import type { NextConfig } from "next";

const config: NextConfig = {
	distDir:
		process.env.NODE_ENV === "production"
			? // Production output goes to ../app so nextron can package it.
				"../app"
			: ".next",
	images: {
		unoptimized: true,
	},
	// We need to export static files so Electron can handle them.
	output: "export",
	// home.html => home/index.html
	trailingSlash: true,
};

export default config;
