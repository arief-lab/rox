import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	client: z.object({}),
	clientPrefix: "EXPO_PUBLIC_",
	emptyStringAsUndefined: true,
	runtimeEnv: {},
});

export type Env = typeof env;
