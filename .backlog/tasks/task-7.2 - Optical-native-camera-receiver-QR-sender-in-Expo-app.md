---
id: TASK-7.2
title: 'Optical native: camera receiver + QR sender in Expo app'
status: To Do
assignee: []
created_date: '2026-09-14 03:56'
updated_date: '2026-09-14 04:03'
labels:
  - feature
  - frontend
dependencies:
  - TASK-7.1
parent_task_id: TASK-7
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First app surface for the optical path, in apps/native. Sender: render the file as a looping stream of QR frames (each encoding one LT symbol from the core codec) at a tuned frame interval; fullscreen, brightness-maxed. Receiver: camera capture, per-frame QR decode feeding the core peeling decoder, show K-of-N progress and completion with SHA-256 verification. Surface: a new 'Beam' mode — native app currently has no transfer path.

DECIDED (decoder evaluation, 2026-09-14):
Primary decoder: zxing-wasm (Sec-ant/zxing-wasm) — ZXing-C++ compiled to WASM.
- Recall essentially identical to native ZXing-C++ (70.84% vs 71.56%, Aug 2026 benchmark); median decode 74 ms vs 100 ms for the C++ lib — WASM overhead negligible
- QR-only reader subpath ~1.04 MiB; formats: ["QRCode"] filter cuts decode time further
- TypeScript ES module, actively maintained (3.1.4), tryHarder for angled/damaged codes
Fallback: jsQR (already a desktop dep, proven in renderer/shared/qr-code.tsx) if zxing-wasm misbehaves on-device.
Rejected: @zxing/browser (old JS port, slower/worse), zbar-wasm (1D-centric), paid SDKs (overkill).

DECIDED (camera spike, 2026-09-14): expo-camera@57.0.5 installed and spiked in apps/native/app/frame-spike.tsx. Findings on the three frame-access paths:
1. onBarcodeScanned (native ML Kit/AVFoundation scanner): zero JS decode cost, but returns decoded STRING data only — binary symbol frames would need a base64/hex encoding inside the QR (costing ~25-33% payload overhead), and scanning rate/throttle behavior is native-controlled. VIABLE PATH A: encode symbol frames as text (base64) inside QR, decode via onBarcodeScanned, skip zxing-wasm entirely on this path. Simplest, most battery-friendly; payload overhead reduces per-frame capacity.
2. takePictureAsync loop (pictureRef, no disk round-trip): full-res frames we own, so zxing-wasm works on raw pixels and symbol frames can ride as binary/byte mode QR. Path B: max flexibility + density, at the cost of shutter-loop overhead (needs on-device fps measurement).
3. react-native-vision-camera frame processors: the true real-time raw-frame path (JSI/worklets) but a second camera dep with its own native build — only if A and B undershoot.
NEXT: on-device run of frame-spike.tsx to (a) measure native scanner hits/sec on a looping QR stream, (b) measure takePictureAsync loop fps with pictureRef, then pick Path A vs B before wiring the decode loop. The choice feeds back into TASK-7.1's frame format: Path A wants a text-safe payload encoding; Path B wants binary. Design the wire format with both in mind (length-prefixed, encoding-flagged).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 - Sender screen: pick a file (or text), renders looping fullscreen QR symbol stream, brightness maxed, chrome hidden, frame interval tuned (start 8-10 fps, calibrate)
- Receiver screen: camera preview + live K-of-N symbols progress; on completion shows filename and offers save/share
- Decodes via an evaluated WASM/native QR library (choice documented in the task with pros/cons); no hand-rolled QR detection
- Core codec does all encode/decode; the app only captures frames and feeds bytes
- SHA-256 verified before completion is shown; corrupt stream surfaces an error, not a bad file
- Real device test: phone camera reads the stream off another phone screen and reconstructs a >= 100 KB file
- Unencrypted-by-default notice visible on both sender and receiver screens
- bun run check-types passes; fallow boundaries hold; expo lint passes
<!-- AC:END -->
