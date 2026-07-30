// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { Input } from "@rox-apps/ui/components/input";
import { Label } from "@rox-apps/ui/components/label";
import { SettingsIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  getDeviceName,
  resetDeviceName,
  setDeviceName,
} from "@/lib/device-name";

export function FloatingSettings() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(getDeviceName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    setDeviceName(trimmed);
    window.dispatchEvent(new CustomEvent("rox-device-name-changed"));
    setOpen(false);
  };

  const handleReset = () => {
    resetDeviceName();
    setName(getDeviceName());
    window.dispatchEvent(new CustomEvent("rox-device-name-changed"));
  };

  return (
    <>
      <Button
        aria-label="Settings"
        className="fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg"
        data-testid="open-settings"
        onClick={() => setOpen(true)}
        size="icon"
      >
        <SettingsIcon className="size-5" />
      </Button>
      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <button
            aria-label="Close settings"
            className="absolute inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
            type="button"
          />
          <Card
            className="relative z-50 w-full max-w-sm"
            data-testid="settings-screen"
          >
            <CardContent className="relative pt-6">
              <Button
                aria-label="Close settings"
                className="absolute top-2 right-2"
                onClick={() => setOpen(false)}
                size="icon-xs"
                variant="ghost"
              >
                <XIcon className="size-4" />
              </Button>
              <h2 className="mb-4 font-semibold text-lg">Settings</h2>
              <Label className="mb-2 block" htmlFor="device-name">
                Device name
              </Label>
              <Input
                data-testid="device-name-input"
                id="device-name"
                onChange={(event) => setName(event.target.value)}
                ref={inputRef}
                value={name}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                This name is shown to the other device during pairing.
              </p>
              <Button
                className="mt-4 w-full"
                data-testid="device-name-save"
                disabled={name.trim().length === 0}
                onClick={handleSave}
              >
                Save
              </Button>
              <Button
                className="mt-2 w-full"
                data-testid="device-name-reset"
                onClick={handleReset}
                variant="secondary"
              >
                Reset
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
