// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@rox-apps/ui/components/card";
import { Input } from "@rox-apps/ui/components/input";
import { Label } from "@rox-apps/ui/components/label";
import { useCallback, useState } from "react";
import {
  getDeviceName,
  resetDeviceName,
  setDeviceName,
} from "@/lib/device-name";

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
    setName(getDeviceName());
  }, []);

  return (
    <Card data-testid="settings-screen">
      <CardHeader>
        <CardTitle>Device Name</CardTitle>
        <CardDescription>
          This name is shown to the other device during pairing and on received
          files.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Label className="mb-1.5" htmlFor="device-name">
          Your device name
        </Label>
        <Input
          data-testid="device-name-input"
          id="device-name"
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter a name..."
          value={name}
        />
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          data-testid="device-name-save"
          disabled={name.trim().length === 0}
          onClick={handleSave}
        >
          Save
        </Button>
        <Button
          data-testid="device-name-cancel"
          onClick={onBack}
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          data-testid="device-name-reset"
          onClick={handleReset}
          variant="ghost"
        >
          Reset
        </Button>
      </CardFooter>
    </Card>
  );
}
