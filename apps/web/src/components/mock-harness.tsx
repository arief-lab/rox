// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { useRef, useState } from "react";
import { AnswererIdleView } from "@/components/answerer-screen/idle-view";
import { ScanningView } from "@/components/answerer-screen/scanning-view";
import { ConnectedView } from "@/components/connected-view/connected-view";
import { OfferingPastingView } from "@/components/pairing-screen/offering-pasting-view";
import { Inbox } from "@/lib/inbox";
import { shortCode } from "@/lib/short-code";

type MockView =
  | "handshake"
  | "answerer"
  | "answerer-scanning"
  | "connected"
  | "transferring"
  | "incoming"
  | "error";

const MOCK_OFFER_CODE = "mock-offer-code";
const MOCK_SHORT_CODE = shortCode(MOCK_OFFER_CODE);

/**
 * Mock state harness for manual UI testing.
 *
 * Renders each major screen with stub props so designers and
 * developers can iterate on the UI without a real WebRTC peer.
 * Only intended for development; it is gated behind `?mock=true`
 * in `page.tsx`.
 */
export function MockHarness() {
  const [view, setView] = useState<MockView>("handshake");
  const [inbox] = useState(() => new Inbox());
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const noop = (..._args: unknown[]) => {
    /* mock handler */
  };
  const asyncNoop = async (..._args: unknown[]) => {
    /* mock async handler */
  };

  const buttons: { label: string; value: MockView }[] = [
    { label: "Handshake", value: "handshake" },
    { label: "Answerer", value: "answerer" },
    { label: "Scanning", value: "answerer-scanning" },
    { label: "Connected", value: "connected" },
    { label: "Transferring", value: "transferring" },
    { label: "Incoming", value: "incoming" },
    { label: "Error", value: "error" },
  ];

  return (
    <div className="relative min-h-screen w-full">
      {view === "handshake" ? (
        <OfferingPastingView
          error=""
          offerCode={MOCK_OFFER_CODE}
          onConnectOther={() => setView("answerer")}
          onPaste={noop}
          onPastedTextChange={noop}
          onReadClipboard={noop}
          pastedText=""
          qrCanvasRef={qrCanvasRef}
          shortCode={MOCK_SHORT_CODE}
        />
      ) : null}

      {view === "answerer" ? (
        <AnswererIdleView
          connectionStatus="connecting"
          error=""
          onBack={() => setView("handshake")}
          onScan={() => setView("answerer-scanning")}
          onScannedTextChange={noop}
          onUseCamera={noop}
          scannedText=""
        />
      ) : null}

      {view === "answerer-scanning" ? (
        <ScanningView
          answerText=""
          connectionStatus="connecting"
          error=""
          onBack={() => setView("answerer")}
          onGenerate={noop}
          peerName="Pixel 7"
        />
      ) : null}

      {view === "connected" || view === "transferring" ? (
        <ConnectedView
          connectionStatus="connected"
          handleCancelReceive={noop}
          handleCancelSend={noop}
          handleClose={() => setView("handshake")}
          handleSend={asyncNoop}
          inbox={inbox}
          peerName="Pixel 7"
          progress={
            view === "transferring"
              ? { bytes: 1_024_000, total: 4_096_000 }
              : null
          }
          receiveProgress={null}
          sendLog={[]}
          session={null}
          wasDisconnected={false}
        />
      ) : null}

      {view === "incoming" ? (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl shadow-primary/5">
            <h2 className="font-semibold text-xl">Incoming file</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              Pixel 7 wants to send:
            </p>
            <div className="mt-4 rounded-lg border bg-muted/30 p-4">
              <p className="font-medium">report.pdf</p>
              <p className="text-muted-foreground text-sm">1.2 MB</p>
            </div>
            <div className="mt-6 flex gap-3">
              <Button className="flex-1" onClick={() => setView("connected")}>
                Accept
              </Button>
              <Button
                className="flex-1"
                onClick={() => setView("connected")}
                variant="secondary"
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {view === "error" ? (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-white p-6 shadow-2xl shadow-primary/5">
            <h2 className="font-semibold text-destructive text-xl">
              Could not connect
            </h2>
            <p className="mt-2 text-muted-foreground text-sm">
              The answer code was not recognized. Please check and try again.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => setView("handshake")}
            >
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 rounded-xl border bg-white/90 p-3 shadow-lg backdrop-blur">
        <p className="font-semibold text-muted-foreground text-xs uppercase">
          Mock UI states
        </p>
        <div className="flex flex-wrap gap-2">
          {buttons.map(({ label, value }) => (
            <button
              aria-pressed={view === value}
              className={`rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
                view === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
              key={value}
              onClick={() => setView(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
