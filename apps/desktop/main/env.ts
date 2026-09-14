// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Desktop env bootstrap — MUST be the first import in main.ts.
 *
 * Loads `apps/desktop/.env` (per-app env file, never repo-root) into
 * process.env, then imports `@rox/env/desktop`: createEnv validates
 * eagerly at import, so a bad value fails fast at startup — before any
 * handler registers. Main-process code imports `env` from
 * `@rox/env/desktop` — never `process.env` directly.
 */

import { config } from "dotenv";

config({ path: new URL("../../.env", import.meta.url).pathname });

// Validate now (eager) rather than lazily at first use.
const { env } = await import("@rox/env/desktop");
if (env === null) {
	throw new Error("@rox/env/desktop failed to load");
}
