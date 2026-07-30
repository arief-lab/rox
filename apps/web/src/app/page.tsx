// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { useEffect, useState } from "react";
import { AnswererScreen } from "@/components/answerer-screen";
import { PairingScreen } from "@/components/pairing-screen";
import { SettingsScreen } from "@/components/settings-screen";
import { Inbox } from "@/lib/inbox";
import { readSharedFile } from "@/lib/pwa/share-cache";

type Role = "idle" | "offerer" | "answerer" | "settings";

export default function Home() {
  const [role, setRole] = useState<Role>("idle");
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
    const urlRole = params.get("role") as Role | null;
    const pendingId = params.get("pending");
    if (
      urlRole === "offerer" ||
      urlRole === "answerer" ||
      urlRole === "settings"
    ) {
      setRole(urlRole);
    }
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

  if (role === "settings") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <SettingsScreen onBack={() => setRole("idle")} />
      </div>
    );
  }

  if (role === "offerer") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Button
          className="mb-4"
          data-testid="back-to-home"
          onClick={() => setRole("idle")}
          variant="ghost"
        >
          ← Back
        </Button>
        <PairingScreen inbox={inbox} />
      </div>
    );
  }

  if (role === "answerer") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Button
          className="mb-4"
          data-testid="back-to-home"
          onClick={() => setRole("idle")}
          variant="ghost"
        >
          ← Back
        </Button>
        <AnswererScreen inbox={inbox} />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="mb-3 font-bold text-3xl tracking-tight sm:text-4xl">
          P2P File Sharing
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground text-sm">
          Send and receive files directly between devices over WebRTC — no
          uploads, no accounts.
        </p>
      </div>

      <div className="mb-8 flex items-center justify-center">
        <Button
          data-testid="open-settings"
          onClick={() => setRole("settings")}
          variant="outline"
        >
          Settings
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="p-1">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg
                aria-hidden="true"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <title>Receive icon</title>
                <path
                  d="M12 4v12m0 0 4-4m-4 4-4-4M4 16h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 className="mb-1 font-semibold text-lg">Receive a file</h2>
              <p className="text-muted-foreground text-xs">
                Start a session and show a QR code for the sender.
              </p>
            </div>
            <Button
              data-testid="role-offerer"
              onClick={() => setRole("offerer")}
            >
              Receive
            </Button>
          </CardContent>
        </Card>

        <Card className="p-1">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
              <svg
                aria-hidden="true"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <title>Send icon</title>
                <path
                  d="M12 20V8m0 0-4 4m4-4 4 4M4 16h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 className="mb-1 font-semibold text-lg">Send a file</h2>
              <p className="text-muted-foreground text-xs">
                Scan or paste the receiver&apos;s offer to connect.
              </p>
            </div>
            <Button
              data-testid="role-answerer"
              onClick={() => setRole("answerer")}
              variant="secondary"
            >
              Send
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
