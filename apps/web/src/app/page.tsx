"use client";

import { useEffect, useState } from "react";

import { AnswererScreen } from "@/components/answerer-screen";
import { PairingScreen } from "@/components/pairing-screen";
import { SettingsScreen } from "@/components/settings-screen";
import { Inbox } from "@/lib/inbox";
import { readSharedFile } from "@/lib/pwa/share-cache";

type Role = "idle" | "offerer" | "answerer" | "settings";

export default function Home() {
  const [role, setRole] = useState<Role>("idle");
  // Inbox is session-scoped per the PRD glossary. Created once and
  // shared between both screens so files received on one side are
  // visible on the other (they're the same Session).
  const [inbox] = useState(() => new Inbox());

  // Expose Inbox on window so E2E tests can push pending entries
  // BEFORE pairing (the ConnectedView that also sets __inbox only
  // renders after a session is established).
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __inbox?: Inbox }).__inbox = inbox;
    }
  }, [inbox]);

  // Slice 11: on mount, check for a pending share-target file.
  // When the user taps "Send this file" on the /share-target page,
  // it navigates here with ?role=answerer&pending=<uuid>.  We
  // read the file from the share-target cache, push it to the
  // Inbox as a PendingEntry, and switch to the answerer role so
  // the user can pair and send it.
  //
  // Using window.location.search directly instead of
  // useSearchParams() to avoid the Suspense-boundary
  // requirement that Next.js 15 imposes on the search-params
  // hook.  The read is a one-shot on mount — URL changes after
  // mount are handled by the role state.
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
        <button
          className="mb-4 text-gray-500 text-sm"
          onClick={() => setRole("idle")}
          type="button"
        >
          ← Back
        </button>
        <PairingScreen inbox={inbox} />
      </div>
    );
  }

  if (role === "answerer") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <button
          className="mb-4 text-gray-500 text-sm"
          onClick={() => setRole("idle")}
          type="button"
        >
          ← Back
        </button>
        <AnswererScreen inbox={inbox} />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-bold text-2xl">P2P File Sharing</h1>
        <button
          className="text-gray-500 text-sm hover:text-gray-700"
          data-testid="open-settings"
          onClick={() => setRole("settings")}
          type="button"
        >
          Settings
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        <button
          className="rounded bg-blue-500 px-6 py-3 text-white"
          data-testid="role-offerer"
          onClick={() => setRole("offerer")}
          type="button"
        >
          Receive a file
        </button>
        <button
          className="rounded bg-green-500 px-6 py-3 text-white"
          data-testid="role-answerer"
          onClick={() => setRole("answerer")}
          type="button"
        >
          Send a file
        </button>
      </div>
    </div>
  );
}
