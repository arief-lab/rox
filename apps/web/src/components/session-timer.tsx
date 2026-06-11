"use client";

import { useEffect, useState } from "react";

import type { Session } from "@/lib/webrtc";

interface SessionTimerProps {
  session: Session;
}

/**
 * SessionTimer — small visual indicator of the Session's idle
 * countdown.
 *
 * Polls `session.getRemainingIdleMs()` once per second and formats
 * the result as `m:ss`. Shows a "Session ended" label when the
 * Session is closed.
 *
 * Polling (rather than subscribing to onActivity) is sufficient for
 * a 1-second display granularity over a 5-minute window — a tick
 * event would save at most a few re-renders over the Session's
 * lifetime.
 */
export function SessionTimer({ session }: SessionTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    session.getRemainingIdleMs()
  );

  useEffect(() => {
    if (session.isClosed()) {
      setRemaining(0);
      return;
    }
    setRemaining(session.getRemainingIdleMs());
    const id = setInterval(() => {
      setRemaining(session.getRemainingIdleMs());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [session]);

  if (session.isClosed()) {
    return (
      <p className="text-gray-500 text-xs" data-testid="session-timer">
        Session ended
        {session.getCloseReason() ? ` (${session.getCloseReason()})` : ""}
      </p>
    );
  }

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <p className="text-gray-500 text-xs" data-testid="session-timer">
      Idle in {label}
    </p>
  );
}
