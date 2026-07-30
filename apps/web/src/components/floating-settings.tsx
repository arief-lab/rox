// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { SettingsIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { resetDeviceName } from "@/lib/device-name";

export function FloatingSettings() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
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

  const handleReset = () => {
    resetDeviceName();
    window.dispatchEvent(new CustomEvent("rox-device-name-changed"));
    setOpen(false);
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
              <h2 className="mb-4 font-semibold text-lg">Device name</h2>
              <p className="text-muted-foreground text-sm">
                You can also edit it inline on the home screen.
              </p>
              <Button
                className="mt-4 w-full"
                data-testid="device-name-reset"
                onClick={handleReset}
                variant="secondary"
              >
                Reset device name
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
