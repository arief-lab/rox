"use client";

import { useState } from "react";

import { AnswererScreen } from "@/components/answerer-screen";
import { PairingScreen } from "@/components/pairing-screen";

type Role = "idle" | "offerer" | "answerer";

export default function Home() {
  const [role, setRole] = useState<Role>("idle");

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
        <PairingScreen />
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
        <AnswererScreen />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-bold text-2xl">P2P File Sharing</h1>
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
