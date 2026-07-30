// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Input } from "@rox-apps/ui/components/input";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDeviceName, setDeviceName } from "@/lib/device-name";

interface DeviceNameEditorProps {
  initialName?: string;
}

/**
 * Inline device name editor.
 *
 * Shows the current device name with a small pencil icon. Clicking
 * the name switches to an input field so the user can rename this
 * device without opening a separate settings screen.
 */
export function DeviceNameEditor({ initialName }: DeviceNameEditorProps) {
  const [name, setName] = useState(initialName ?? "Unknown Device");
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(initialName ?? getDeviceName());
    const handleChange = () => setName(getDeviceName());
    window.addEventListener("rox-device-name-changed", handleChange);
    return () => {
      window.removeEventListener("rox-device-name-changed", handleChange);
    };
  }, [initialName]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setName(getDeviceName());
      setIsEditing(false);
      return;
    }
    setDeviceName(trimmed);
    window.dispatchEvent(new CustomEvent("rox-device-name-changed"));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(getDeviceName());
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSave();
    } else if (event.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-2">
        <Input
          aria-label="Device name"
          className="h-8 w-48"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKeyDown}
          ref={inputRef}
          value={name}
        />
        <Button
          aria-label="Save device name"
          onClick={handleSave}
          size="icon-xs"
          variant="ghost"
        >
          <CheckIcon className="size-4" />
        </Button>
        <Button
          aria-label="Cancel editing device name"
          onClick={handleCancel}
          size="icon-xs"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    // suppressHydrationWarning: belt-and-braces guard. The button's
    // first-paint output IS structurally identical SSR and client
    // (`name` initial = `initialName ?? "Unknown Device"`), so React 19
    // should not actually warn here. The flag exists so a stale
    // `.next/dev` TurboPack bundle (which the user encountered during
    // the recent Impeccable Live iteration) cannot reintroduce the
    // warning when it serves a slimmed-down HeroSection subtree.
    <button
      aria-label="Edit device name"
      className="group inline-flex items-center gap-2 rounded-md px-2 py-1 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => setIsEditing(true)}
      suppressHydrationWarning
      type="button"
    >
      <span>This device:</span>
      <span className="font-semibold text-foreground">{name}</span>
      <PencilIcon className="size-3.5 opacity-50 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
