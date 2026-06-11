"use client";

import type { RefObject } from "react";

import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";

/**
 * Pairing-specific offering|pasting view. Shown when the
 * offerer has created the offer SDP and is either showing the
 * QR (state.kind === "offering") or waiting for the answerer
 * to paste the answer (state.kind === "pasting"). The header
 * label switches between "Show this QR" and "Connecting..."
 * based on the sub-state.
 *
 * Extracted from the screen in the render-tree follow-up to
 * bring the screen's cognitive complexity under 20.
 */
interface OfferingPastingViewProps {
  connectionStatus: ConnectionStatusKind;
  error: string;
  label: string;
  offerSdp: string;
  onPaste: () => void;
  onPastedTextChange: (text: string) => void;
  onReadClipboard: () => void;
  pastedText: string;
  qrCanvasRef: RefObject<HTMLCanvasElement | null>;
}

export function OfferingPastingView({
  connectionStatus,
  error,
  label,
  offerSdp,
  onPaste,
  onReadClipboard,
  onPastedTextChange,
  pastedText,
  qrCanvasRef,
}: OfferingPastingViewProps) {
  return (
    <div className="rounded-lg border p-4" data-testid="offering-state">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{label}</h2>
        <ConnectionStatus status={connectionStatus} />
      </div>
      <canvas
        className="mt-2 border"
        data-testid="qr-canvas"
        ref={qrCanvasRef}
      />
      <p className="mt-2 text-sm">
        Offer SDP:{" "}
        <code className="break-all text-xs" data-testid="offer-sdp">
          {offerSdp.slice(0, 80)}...
        </code>
      </p>
      <div className="mt-4">
        <button
          className="rounded bg-purple-500 px-4 py-2 text-white"
          data-testid="read-clipboard"
          onClick={onReadClipboard}
          type="button"
        >
          Read answer from clipboard
        </button>
        <textarea
          className="mt-2 w-full rounded border p-2 text-xs"
          data-testid="paste-area"
          onChange={(e) => onPastedTextChange(e.target.value)}
          placeholder="Or paste answer text here..."
          value={pastedText}
        />
        <button
          className="mt-2 rounded bg-green-500 px-4 py-2 text-white"
          data-testid="paste-answer"
          disabled={!pastedText}
          onClick={onPaste}
          type="button"
        >
          Connect with pasted answer
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
