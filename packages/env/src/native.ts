import { createEnv } from "@t3-oss/env-core";

export const env = createEnv({
	client: {},
	clientPrefix: "EXPO_PUBLIC_",
	emptyStringAsUndefined: true,
	runtimeEnv: {},
});

export type Env = typeof env;
