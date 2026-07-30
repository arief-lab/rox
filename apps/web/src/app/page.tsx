// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect, useState } from "react";
import { AnswererScreen } from "@/components/answerer-screen";
import { FloatingSettings } from "@/components/floating-settings";
import { PairingScreen } from "@/components/pairing-screen";
import { Inbox } from "@/lib/inbox";
import { readSharedFile } from "@/lib/pwa/share-cache";

type Mode = "offer" | "answer";

export default function Home() {
  const [mode, setMode] = useState<Mode>("offer");
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

  return (
    <div className="relative flex h-full flex-col">
      <main className="flex flex-1 items-center justify-center overflow-auto p-4">
        <div className="w-full max-w-md">
          {mode === "offer" ? (
            <PairingScreen
              inbox={inbox}
              onConnectOther={() => setMode("answer")}
            />
          ) : (
            <AnswererScreen inbox={inbox} onBack={() => setMode("offer")} />
          )}
        </div>
      </main>
      <FloatingSettings />
    </div>
  );
}
