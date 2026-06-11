"use client";

import { useState } from "react";

import { AnswererScreen } from "@/components/answerer-screen";
import { PairingScreen } from "@/components/pairing-screen";
import { SettingsScreen } from "@/components/settings-screen";
import { Inbox } from "@/lib/inbox";

type Role = "idle" | "offerer" | "answerer" | "settings";

export default function Home() {
  const [role, setRole] = useState<Role>("idle");
  // Inbox is session-scoped per the PRD glossary. Created once and
  // shared between both screens so files received on one side are
  // visible on the other (they're the same Session).
  const [inbox] = useState(() => new Inbox());

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
