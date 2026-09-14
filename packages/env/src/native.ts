import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Native (Expo) env.
 *
 * Vars are baked in at bundle time by Expo from `apps/native/.env`
 * (see .env.example): any var the app uses must be prefixed
 * `EXPO_PUBLIC_` in the .env file, and declared in the `client` schema
 * here WITHOUT the prefix (T3 convention). Expo inlines these as
 * literals into the JS bundle — they are NOT secrets. Never put a
 * secret in an EXPO_PUBLIC_ var; native has no server runtime, so
 * secrets have no home here yet (the server schema covers apps/web).
 */
export const env = createEnv({
	client: {
		// Example shape for the first real var:
		// RELAY_URL: z.string().url().optional(),
	},
	clientPrefix: "EXPO_PUBLIC_",
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
});

export type Env = typeof env;
