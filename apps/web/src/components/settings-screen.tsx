"use client";

import { useCallback, useState } from "react";

import {
  getDeviceName,
  resetDeviceName,
  setDeviceName,
} from "@/lib/device-name";

/**
 * Slice 9: settings screen for overriding the auto-generated device
 * name. The name is stored in localStorage and persists across
 * reloads and Sessions. Changes take effect immediately — all
 * in-UI labels (pairing QR, session header, Inbox rows) read
 * from the cached in-memory value updated by setDeviceName().
 */
interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [name, setName] = useState(getDeviceName);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    setDeviceName(trimmed);
    onBack();
  }, [name, onBack]);

  const handleReset = useCallback(() => {
    resetDeviceName();
    // Re-read to get the fresh auto-generated name from the UA.
    setName(getDeviceName());
  }, []);

  return (
    <div className="rounded-lg border p-4" data-testid="settings-screen">
      <h2 className="mb-4 font-medium">Device Name</h2>
      <p className="mb-2 text-gray-500 text-sm">
        This name is shown to the other device during pairing and on received
        files.
      </p>
      <label className="mb-1 block font-medium text-sm" htmlFor="device-name">
        Your device name
      </label>
      <input
        className="mb-4 w-full rounded border p-2"
        data-testid="device-name-input"
        id="device-name"
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter a name..."
        type="text"
        value={name}
      />
      <div className="flex gap-2">
        <button
          className="rounded bg-blue-500 px-4 py-2 text-white"
          data-testid="device-name-save"
          disabled={name.trim().length === 0}
          onClick={handleSave}
          type="button"
        >
          Save
        </button>
        <button
          className="rounded bg-gray-300 px-4 py-2"
          data-testid="device-name-cancel"
          onClick={onBack}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded bg-gray-200 px-4 py-2 text-sm"
          data-testid="device-name-reset"
          onClick={handleReset}
          type="button"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
