# Context

> Domain glossary for **Rox** (formerly rox-apps). Pure language — no implementation details,
> no specs, no scratch-pad. When a term is used in the codebase, it should
> mean what the entry below says it means.

**Rox**:
The application name (title case). The PWA is branded as "Rox". The
repository and npm scope remain "rox-apps" for backwards compatibility.

## Project Status

The P2P file-sharing feature (PRD `0001`) is **fully implemented** across
18 issues — pairing, transfer, inbox, device name, PWA offline support,
share-target integration, install prompt, error handling, and an end-to-end
Playwright test suite covering all flows. All user stories in the PRD
(43 total) are delivered; all outstanding issues are `Status: done` with
verified acceptance criteria.

See:
- [PRD](docs/prd/0001-p2p-file-sharing.md)
- [Issues](docs/issues/p2p-file-sharing/)
- 340 unit/integration tests (23 files), 25 E2E tests (11 specs) — all green

## Language

**Session**:
The live, paired state between two devices — the period after a Pairing
succeeds and before either side ends it. **Ephemeral**: the Session ends
automatically when the underlying connection closes, when either side
closes the app, or after a short idle window. All Transfers occur under
a Session.
_Avoid_: "connection" (too generic), "call" (voice/video connotation).

**Transfer Scenario**:
The canonical shape of a Transfer this app supports on day one —
**bidirectional** (either device may send or receive), over the **same WiFi
(LAN)**, with **any file type**. Payload size is a separate concern (see
File Transfer).
_Avoid_: "send", "share" (too generic); "sync" (implies persistent state).

**Pairing**:
The one-time act of two devices establishing a Session. Resolved as: the
Offerer presents a machine-readable code; the Answerer reads it; the
user manually moves a short payload back to close the loop. The
physical act of reading the code is the trust proof. This same flow is
the peer-to-peer session exchange — there is no separate channel.
_Avoid_: "connect" (vague), "add friend" (implies persistent identity we
don't have), "match" (auto-discovery connotation).

**Role**:
The part a device plays in a Session. Two pairs of roles:

- During Pairing: **Offerer** (displays the machine-readable code) and
  **Answerer** (reads it, returns the response).
- During a Transfer: **Sender** (picks the file, initiates the Transfer)
  and **Receiver** (the other side; receives the file in its Inbox).

The Pairing role is set when the Session begins and does not change; the
Transfer role is set per-Transfer. A device can be Offerer and Sender
in the same Session, or any combination.
_Avoid_: "host"/"guest" (asymmetric connotation), "client"/"server"
(implies architecture we don't have), "Alice"/"Bob" (placeholder names
that suggest cryptography).

**Device Name**:
A user-visible label that identifies one device to its peer in a
Session. Resolved as: auto-generated from the browser on first run
(e.g., "iPhone", "MacBook Pro"), with a small settings screen that lets
the user override it. Persists on the device across Sessions.
_Avoid_: "username" (implies an account we don't have), "nickname"
(sounds like a person), "device ID" (sounds technical / internal),
"hostname" (sounds network-y).

**Transfer**:
The act of moving one file from sender to receiver under a Session. A
Session may contain many Transfers, in either direction. Initiated by the
sender with no per-file consent required from the receiver.
_Avoid_: "send" (verb, not the noun for a discrete event), "share" (too
generic).

**Inbox**:
A device's local list of completed Transfers received during the current
Session, surfaced so the user can save each file to the device's storage
or discard it. The Inbox is session-scoped — when the Session ends, the
Inbox is cleared (unless the user has explicitly saved the file via the
Inbox's save action).
_Avoid_: "downloads" (implies a folder the user can see on disk, not an
in-app list); "history" (sounds persistent).

**File Transfer**:
The mechanism by which a Transfer's bytes are moved. Implemented as
**chunked streaming with a per-file upper bound of 500 MB**
(`500 * 1024 * 1024` bytes — the bound chose `>` so a 500 MB file is
accepted). Integrity checks, flow control, and resumption are out of
scope for this version.
_Avoid_: "upload", "download" (both imply a server we don't have);
"sync" (different concept).

**PWA Scope**:
The set of installable-app capabilities this app uses. Resolved as: a
self-contained app that runs without network, plus being reachable from
the system's file-share entrypoint so users can route a file into the
app from any source app.
_Avoid_: "PWA" used as a loose synonym for "installable web app" without
these capabilities; "offline mode" as a user-toggleable setting (the app
is *always* offline-first).

## Out of Scope

Adding any of these would change which terms are in play:

- **Cross-internet Transfer** (devices on different networks) — would
  require NAT traversal, breaking the no-server property.
- **Group Transfers** (more than two devices in one Session) — would
  require multi-party signalling, breaking the Pairing shape.
- **Multi-file Transfer** (one Transfer carrying several files) — would
  require a single Transfer to carry multiple file identities, breaking
  the one-file shape.
- **Folder Transfer** (sender picks a directory) — no portable browser
  API for folder contents; would require a zip step before Transfer.
- **Phone-as-hotspot hosting**
- **Bluetooth-class proximity pairing**
- **Persistent device identity or accounts**
- **File Handling API, push notifications, background sync**
- **Any signalling server** (WebSocket, Durable Object, third-party broker)
