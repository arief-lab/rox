// SPDX-License-Identifier: AGPL-3.0-or-later
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  client: {},
  runtimeEnv: {},
  emptyStringAsUndefined: true,
});
