// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { AnswererScreen } from "@/components/answerer-screen";
import { FloatingSettings } from "@/components/floating-settings";
import { MockHarness } from "@/components/mock-harness";
import { PairingScreen } from "@/components/pairing-screen";
import { Inbox } from "@/lib/inbox";
import { readSharedFile } from "@/lib/pwa/share-cache";

type Mode = "offer" | "answer" | "mock";

/**
 * SSR-safe initial mode. The actual URL-derived mode (`?mock=true`,
 * `?role=answerer`, `?mode=answer`) is applied to state by the
 * mount-time useEffect below so the first client render matches the
 * server's `"offer"` snapshot and React 19's strict hydration
 * doesn't warn about a mode/key mismatch.
 */
const INITIAL_MODE: Mode = "offer";

export default function Home() {
  const [mode, setMode] = useState<Mode>(INITIAL_MODE);
  const [inbox] = useState(() => new Inbox());

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __inbox?: Inbox }).__inbox = inbox;
    }
  }, [inbox]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);

    if (params.get("mock") === "true") {
      setMode("mock");
      return;
    }

    const role = params.get("role");
    if (role === "answerer" || params.get("mode") === "answer") {
      setMode("answer");
    } else if (role === "offerer") {
      setMode("offer");
    }

    const pendingId = params.get("pending");
    if (pendingId) {
      readSharedFile(pendingId).then((file) => {
        if (!file) {
          return;
        }
        inbox.pushPending({
          blob: file.blob,
          id: file.id,
          name: file.name,
          sharedAt: Date.now(),
          size: file.size,
          type: file.type,
        });
      });
    }
  }, [inbox]);

  const shouldReduceMotion = useReducedMotion();

  if (mode === "mock") {
    return <MockHarness />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <main className="h-full w-full">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1 }}
            className="h-full w-full"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={mode}
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.25 }
            }
          >
            {mode === "offer" ? (
              <PairingScreen
                inbox={inbox}
                onConnectOther={() => setMode("answer")}
              />
            ) : (
              <AnswererScreen inbox={inbox} onBack={() => setMode("offer")} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <FloatingSettings />
    </div>
  );
}
