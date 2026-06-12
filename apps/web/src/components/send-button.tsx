"use client";

import { Button } from "@rox-apps/ui/components/button";
import { useRef, useState } from "react";
import { ErrorText } from "@/components/error-text";

interface SendButtonProps {
  disabled?: boolean;
  onSend: (file: File) => void;
}

/**
 * File picker + send trigger. Opens a native file input when clicked,
 * then calls onSend with the selected File.
 */
export function SendButton({ onSend, disabled }: SendButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      onSend(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    }
    // Reset so the same file can be selected again
    event.target.value = "";
  };

  return (
    <div data-testid="send-button">
      <Button data-testid="send-file" disabled={disabled} onClick={handleClick}>
        Send file
      </Button>
      <input
        accept="*/*"
        className="hidden"
        data-testid="file-input"
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      <ErrorText data-testid="send-error" error={error} />
    </div>
  );
}
