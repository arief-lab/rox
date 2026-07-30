// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { motion } from "motion/react";

export default function Loader() {
  return (
    <div
      aria-label="Loading"
      className="flex h-full items-center justify-center pt-8"
      role="status"
    >
      <motion.div
        animate={{ rotate: 360 }}
        className="box-border h-8 w-8 rounded-full border-2 border-muted border-t-primary"
        style={{ willChange: "transform" }}
        transition={{
          duration: 1,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      />
    </div>
  );
}
