import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: z.object({}),
	emptyStringAsUndefined: true,
	runtimeEnv: {},
});

export type Env = typeof env;
