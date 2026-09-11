import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "EXPO_PUBLIC_",
	client: {},
	runtimeEnv: {},
	emptyStringAsUndefined: true,
});
