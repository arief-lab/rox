import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Desktop (Electron main process) env.
 *
 * Vars load from `apps/desktop/.env` (see .env.example) via dotenv at
 * main-process startup — see `apps/desktop/main/env.ts`. Everything
 * here is main-process-only: never import this from the renderer.
 */
export const env = createEnv({
	client: {},
	clientPrefix: "ROX_PUBLIC_",
	emptyStringAsUndefined: true,
	runtimeEnv: process.env,
	server: {
		/**
		 * Appends a suffix to the Electron userData dir so multiple
		 * instances (e.g. pairing smoke tests) don't contend over the
		 * Corestore lock. Optional; unset means single shared instance.
		 */
		ROX_USER_DATA_SUFFIX: z.string().min(1).optional(),
	},
});

export type Env = typeof env;
