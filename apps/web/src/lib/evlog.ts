import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation";

export const { withEvlog, useLogger, log, createError } = createEvlog({
  service: "rox-apps-web",
});

export const { register, onRequestError } = createInstrumentation({
  service: "rox-apps-web",
});
