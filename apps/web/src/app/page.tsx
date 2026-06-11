"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import {
  DEMO_OFFER_NAME,
  DEMO_OFFER_SDP,
  decodeOffer,
  encodeOffer,
  readClipboard,
  writeClipboard,
} from "@/lib/pairing";
import { createFakeTransportPair, type Transport } from "@/lib/webrtc";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrText, setQrText] = useState<string>("");
  const [pasted, setPasted] = useState<string>("");
  const [decoded, setDecoded] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Slice 2: a single-tab "Test ping" that uses the fake transport
  // pair. Verifies the Transport contract is wired into the page
  // without needing two browser contexts.
  const [testPingA, setTestPingA] = useState<Transport | null>(null);
  const [testPingB, setTestPingB] = useState<Transport | null>(null);
  const [testPingLog, setTestPingLog] = useState<string[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(canvas && qrText)) {
      return;
    }
    QRCode.toCanvas(canvas, qrText, { width: 256, margin: 1 })
      .then(() => setError(""))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "QR render failed")
      );
  }, [qrText]);

  const handleGenerate = () => {
    setQrText(encodeOffer(DEMO_OFFER_SDP, DEMO_OFFER_NAME));
  };

  const handleCopyTest = async () => {
    const text = encodeOffer(DEMO_OFFER_SDP, "TestAnswerer");
    await writeClipboard(text);
    setPasted(text);
    setError("");
  };

  const handleReadClipboard = async () => {
    try {
      const text = await readClipboard();
      setPasted(text);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clipboard read failed");
    }
  };

  const handleDecode = () => {
    try {
      const result = decodeOffer(pasted);
      setDecoded(`sdp: ${result.sdp}, name: ${result.name ?? "(none)"}`);
      setError("");
    } catch (err) {
      setDecoded("");
      setError(err instanceof Error ? err.message : "Decode failed");
    }
  };

  const handleStartTestPing = () => {
    const [a, b] = createFakeTransportPair();
    a.onmessage((event) => {
      setTestPingLog((log) => [...log, `A received: ${String(event.data)}`]);
    });
    b.onmessage((event) => {
      setTestPingLog((log) => [...log, `B received: ${String(event.data)}`]);
    });
    a.onclose((event) => {
      setTestPingLog((log) => [
        ...log,
        `A closed: ${event.reason} (state=${a.state})`,
      ]);
    });
    b.onclose((event) => {
      setTestPingLog((log) => [
        ...log,
        `B closed: ${event.reason} (state=${b.state})`,
      ]);
    });
    setTestPingA(a);
    setTestPingB(b);
    setTestPingLog(["Test session started"]);
  };

  const handleSendAtoB = () => {
    if (!testPingA) {
      return;
    }
    testPingA.send("ping-from-A");
  };

  const handleSendBtoA = () => {
    if (!testPingB) {
      return;
    }
    testPingB.send("ping-from-B");
  };

  const handleCloseA = () => {
    if (!testPingA) {
      return;
    }
    testPingA.close("user closed A");
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-bold text-2xl">P2P File Sharing</h1>

      <section className="mb-4 rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Pairing — QR (slice 1)</h2>
        <button
          className="rounded bg-blue-500 px-4 py-2 text-white"
          data-testid="generate-qr"
          onClick={handleGenerate}
          type="button"
        >
          Generate QR
        </button>
        <canvas
          className="mt-4 border"
          data-testid="qr-canvas"
          ref={canvasRef}
        />
        {qrText ? (
          <p
            className="mt-2 break-all font-mono text-gray-500 text-xs"
            data-testid="qr-text"
          >
            {qrText}
          </p>
        ) : null}
      </section>

      <section className="mb-4 rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Pairing — clipboard (slice 1)</h2>
        <button
          className="rounded bg-green-500 px-4 py-2 text-white"
          data-testid="copy-test"
          onClick={handleCopyTest}
          type="button"
        >
          Copy test answer to clipboard
        </button>
        <button
          className="ml-2 rounded bg-purple-500 px-4 py-2 text-white"
          data-testid="paste-from-clipboard"
          onClick={handleReadClipboard}
          type="button"
        >
          Read from clipboard
        </button>
        <p className="mt-2 text-sm">
          Pasted:{" "}
          <code className="break-all" data-testid="pasted-text">
            {pasted || "(empty)"}
          </code>
        </p>
        <button
          className="mt-2 rounded bg-orange-500 px-4 py-2 text-white"
          data-testid="decode"
          onClick={handleDecode}
          type="button"
        >
          Decode pasted text
        </button>
        <p className="mt-2 text-sm">
          Decoded:{" "}
          <code className="break-all" data-testid="decoded-text">
            {decoded || "(empty)"}
          </code>
        </p>
        {error ? (
          <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
            {error}
          </p>
        ) : null}
      </section>

      <section className="mb-4 rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Transport — test ping (slice 2)</h2>
        <p className="mb-2 text-gray-500 text-sm">
          Single-tab self-test using the fake transport pair. Verifies the
          Transport contract (send / onmessage / close / onclose) end-to-end
          before any real WebRTC is wired up.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded bg-indigo-500 px-4 py-2 text-white"
            data-testid="start-test-ping"
            disabled={testPingA !== null}
            onClick={handleStartTestPing}
            type="button"
          >
            Start test session
          </button>
          <button
            className="rounded bg-pink-500 px-4 py-2 text-white"
            data-testid="send-a-to-b"
            disabled={!testPingA}
            onClick={handleSendAtoB}
            type="button"
          >
            Send A → B
          </button>
          <button
            className="rounded bg-yellow-500 px-4 py-2 text-white"
            data-testid="send-b-to-a"
            disabled={!testPingB}
            onClick={handleSendBtoA}
            type="button"
          >
            Send B → A
          </button>
          <button
            className="rounded bg-gray-500 px-4 py-2 text-white"
            data-testid="close-a"
            disabled={!testPingA}
            onClick={handleCloseA}
            type="button"
          >
            Close A
          </button>
        </div>
        <pre
          className="mt-2 max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs"
          data-testid="test-ping-log"
        >
          {testPingLog.join("\n") || "(no events yet)"}
        </pre>
      </section>
    </div>
  );
}
