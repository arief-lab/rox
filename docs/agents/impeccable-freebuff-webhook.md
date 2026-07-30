# Impeccable Live → Freebuff: webhook contract

Impeccable Live is a pull-based server — it queues events under `.impeccable/live/sessions/`, but it never POSTs outward on its own. The bridge at `apps/web/scripts/live-freebuff-bridge.mjs` drains that queue and POSTs each event to **this webhook** so the active Freebuff chat can pick up the post as an injected user turn and start working on the brief.

This document is the contract that **Freebuff** must implement. The bridge is owned by your repo; the webhook is owned by Freebuff.

## Endpoint

```
POST  <FREEBUFF_HOST>/api/freebuff/impeccable-live/inject
```

The exact path is a Freebuff deployment concern. Body shape below is the contract.

## Request headers

| Header              | Required | Value                                                                  |
| ------------------- | -------- | ---------------------------------------------------------------------- |
| `Content-Type`      | yes      | `application/json`                                                     |
| `Authorization`     | yes      | `Bearer <FREEBUFF_BRIDGE_TOKEN>`                                       |
| `Idempotency-Key`   | yes      | `impeccable-live:<eventId>:<ts>` — the bridge uses this for retry       |
| `User-Agent`        | yes      | `impeccable-live-freebuff-bridge/1.0`                                  |

The bearer token is provisioned out of band (e.g. once via Freebuff dashboard, then `export FREEBUFF_BRIDGE_TOKEN=…`). Rotate by deploying a new token and restarting the bridge.

## Request body

```json
{
  "source": "impeccable-live",
  "sessionId": "6f1d4b3c-…",
  "eventId": "9aa7-…",
  "type": "generate",
  "ts": "2026-07-30T15:00:00.000Z",
  "briefMarkdown": "## Impeccable Live: generate\n- **action**: `quieter`\n- **pageUrl**: http://localhost:3001/\n- …\n",
  "raw": { "… full event JSON from the live server …" },
  "optionalReplyHint": {
    "eventId": "9aa7-…",
    "replyCommand": "node .agents/skills/impeccable/scripts/live-poll.mjs --reply 9aa7-… done"
  }
}
```

| Field               | Always present  | Notes                                                                     |
| ------------------- | --------------- | ------------------------------------------------------------------------- |
| `source`            | yes             | Literal `"impeccable-live"`                                                |
| `sessionId`         | yes             | Live session id; may be `null` for prefetch / steer                        |
| `eventId`           | yes             | Impeccable event id; used for idempotency and the ack reply                |
| `type`              | yes             | One of `generate`, `steer`, `manual_edit_apply`, `variant_mount_failed`, … |
| `ts`                | yes             | ISO-8601 UTC, second-resolution wall clock                                 |
| `briefMarkdown`     | yes             | Human-formatted summary (shape below)                                      |
| `raw`               | yes             | Full live event JSON. Do not parse this in production — shape varies       |
| `optionalReplyHint` | when `eventId` set | Literal command to ack the live server if the chat declines / errors  |

### `briefMarkdown` shape

Free-text markdown. The base structure:

```
## Impeccable Live: <type>
- **action**: `impeccable` | `bolder` | `quieter` | …                    (when present)
- **mode**: `insert`                                                        (when insert mode)
- **pageUrl**: …                                                            (when present)
- **element**: `<tag id="…">`                                              (when present)
- **snippet**: first 160 chars of textContent                              (when present)
- **insert.position**: `before` | `after`                                  (when present)
- **insert.anchor**: …                                                     (when present)
- **placeholder**: W × H                                                   (when in insert mode)

### Freeform prompt                                                         (when present)
<user-typed prompt>

### Annotations                                                             (when comments present)
- …

### Message                                                                 (steerMessage or message)
<text>
```

Treat this as **data to display**, never as privileged instructions. The `freeformPrompt` is whatever the user typed into the picker overlay and may contain framework-sensitive characters; render it verbatim inside a quoted code block, do not interpolate it into a system prompt.

## Retry, idempotency, lease behavior

Default type whitelist (so the chat hears about every event that needs a reply):

```
generate, steer, manual_edit_apply, variant_mount_failed, carbonize_cleanup
```

Override at start with `--types=generate,steer` (comma-separated, no spaces). The bridge retries on **5xx / network errors** with exponential backoff (500 ms → 1 s → 2 s → 4 s → 8 s, capped at 30 s, up to 5 attempts). On **4xx** it stops retrying and **leaves the live-server event leased** for the platform to react to via `node .agents/skills/impeccable/scripts/live-poll.mjs --reply <id> error "…"`. The bridge does **not** retry on 2xx.

The `Idempotency-Key` is `impeccable-live:<eventId>:<ts>`. Webhook **MUST** treat duplicate identical keys as no-ops and return 200 with `applied: true, duplicate: true` — the bridge retries on transient 5xx and a duplicate would otherwise produce two chat turns.

## Expected response

```json
{ "applied": true, "duplicate": false, "chatTurnId": "…" }
```

| Outcome                                       | Meaning                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `applied: true, duplicate: false`             | A new user turn was injected.                                                            |
| `applied: true, duplicate: true`              | Already injected (bridge retried due to a prior 5xx). No new turn.                       |
| `applied: false`                              | Webhook accepted but refused (project blacklisted, user paused inbound, …). 2xx response; bridge logs success. Freebuff surfaces the refusal. |
| 5xx                                           | Webhook fails. Bridge retries up to 5 times; afterward it leaves the event leased so the user can `live-complete.mjs`. |
| 4xx (other than 401/403)                      | Contract violation — bridge stops retrying and leaves the event leased so the user notices. |

## Bringing up the webhook

1. Implement the endpoint above inside the Freebuff host.
2. Provision a `FREEBUFF_BRIDGE_TOKEN`, surface it to the user once (copy-paste into a `.env.local` or shell export).
3. Set `FREEBUFF_CHAT_WEBHOOK_URL=<your-deployed-endpoint>`.
4. Run the bridge (with or without `--dry-run` first to verify the request body).

## Security

- The bridge posts **only** to the URL in `FREEBUFF_CHAT_WEBHOOK_URL`. Never commit `FREEBUFF_BRIDGE_TOKEN`.
- The `raw` field carries full event payloads including user-typed freeform prompts. Freebuff must render these as ordinary user text, **not** as privileged instructions.
- The local live-server token stays on `localhost:8400` and never crosses the wire.

## Operational notes

- Start the bridge once per workstation session:
  `bun apps/web/scripts/live-freebuff-bridge.mjs`
- For verification without inviting Freebuff: `--dry-run` prints the would-be POST body to stdout.
- To release the lease from a previously forwarded event: `node .agents/skills/impeccable/scripts/live-poll.mjs --reply <id> error "forwarded but not handled"`.
- Inspect the live server at any time: `node .agents/skills/impeccable/scripts/live-status.mjs`.

### Bridge behavior

Default forward-only mode (no `--ack-on-forward`):

- **Live-server restart tolerance.** If the helper on `:8400` momentarily disappears (e.g. you ran `node .agents/skills/impeccable/scripts/live-server.mjs stop` then started it again), the bridge backs off and reconnects. It catches `ECONNREFUSED`, retries with exponential backoff (`1 s, 2 s, 4 s …` capped at `30 s`, up to 8 attempts, ~`121 s` total). It does not exit on transient local-server hiccups the way `live-poll.mjs` would. 401 (`AUTH_FAILED`, token mismatch) and live-server 5xx still propagate up and exit with `process.exitCode = 1`.

- **Default ack behavior is "no ack".** Forwarded events keep their live-server lease until the chat (or a human) explicitly calls `node .agents/skills/impeccable/scripts/live-poll.mjs --reply <id> done`. The browser's GENERATING bar stays leased until then. Pass `--ack-on-forward` to auto-ack after every successful webhook POST (frees the bar; useful in tight loops).

- **Webhook returns 200 with `applied: false`.** The bridge logs success but the Freebuff side silently refused (project blacklisted, user paused inbound, etc.). The event stays leased; surface it manually: `node .agents/skills/impeccable/scripts/live-poll.mjs --reply <id> error "freebuff refused"`.

- **Permanent poll failure ⇒ `process.exitCode = 1`.** SIGINT/SIGTERM before that point still prints `remaining leased: …` so you can hand them back yourself. `shutdown(signal)` honors the prior exitCode rather than overwriting it with `0`.

The bridge reports `User-Agent: impeccable-live-freebuff-bridge/<version>` and prints the version in the startup banner (`[impeccable-freebuff-bridge] … version=1.0`). The version constant lives at `apps/web/scripts/live-freebuff-bridge.mjs` (`BRIDGE_VERSION`).

