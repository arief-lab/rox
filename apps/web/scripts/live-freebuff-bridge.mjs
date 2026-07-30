#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Impeccable Live → Freebuff bridge.
 *
 * Drains the Impeccable Live `/poll` queue on localhost:<port> and forwards
 * each picked event to a Freebuff chat-inject webhook. The chat picks up the
 * post as an injected user turn and starts working on the brief.
 *
 * Lives in apps/web/scripts/ (not the skill dir) so its lifecycle is owned by
 * this repo and a skill reinstall does not touch it. It imports
 * `live-poll.mjs`'s exported helpers directly — that file's CLI auto-run block
 * keys on `process.argv[1]`, so importing it from a sibling script does NOT
 * fire its CLI.
 *
 * Usage:
 *   FREEBUFF_CHAT_WEBHOOK_URL=https://freebuff.com/api/freebuff/impeccable-live/inject \
 *   FREEBUFF_BRIDGE_TOKEN=… \
 *     bun apps/web/scripts/live-freebuff-bridge.mjs
 *
 *   # print the would-be POST body, no network:
 *   bun apps/web/scripts/live-freebuff-bridge.mjs --dry-run
 *
 *   # also ack the live server after Freebuff accepts (frees the GENERATING bar):
 *   bun apps/web/scripts/live-freebuff-bridge.mjs --ack-on-forward
 *
 *   # tighten the type whitelist (default is the chat-relevant subset):
 *   bun apps/web/scripts/live-freebuff-bridge.mjs --types=generate,steer
 *
 * Environment:
 *   FREEBUFF_CHAT_WEBHOOK_URL   POST target — required unless --dry-run
 *   FREEBUFF_BRIDGE_TOKEN      Bearer token — required unless --dry-run
 *
 * Webhook contract lives at docs/agents/impeccable-freebuff-webhook.md.
 */

import {
  fetchNextEvent,
  postReply,
} from "../../../.agents/skills/impeccable/scripts/live-poll.mjs";
import { readLiveServerInfo } from "../../../.agents/skills/impeccable/scripts/lib/impeccable-paths.mjs";

const BRIDGE_VERSION = "1.0";
const DEFAULT_TYPES =
  "generate,steer,manual_edit_apply,variant_mount_failed,carbonize_cleanup";
const MAX_WEBHOOK_ATTEMPTS = 5;
const MAX_POLL_RESTART_ATTEMPTS = 8;
const REQUEST_TIMEOUT_MS = 10_000;
const TAG = "[impeccable-freebuff-bridge]";

const POLL_BACKOFFS_MS = Array.from(
  { length: MAX_POLL_RESTART_ATTEMPTS },
  (_, i) => Math.min(30_000, 500 * 2 ** (i + 1)),
);
const POLL_TOTAL_BACKOFF_MS = POLL_BACKOFFS_MS.reduce((a, b) => a + b, 0);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const ackOnForward = args.includes("--ack-on-forward");
const typesArg = args.find((a) => a.startsWith("--types="));
const typeFilter = typesArg ? typesArg.slice("--types=".length) : DEFAULT_TYPES;

const webhookUrl = process.env.FREEBUFF_CHAT_WEBHOOK_URL;
const bridgeToken = process.env.FREEBUFF_BRIDGE_TOKEN;

if (!dryRun && !webhookUrl) {
  console.error(
    `${TAG} FREEBUFF_CHAT_WEBHOOK_URL is required. Pass --dry-run to skip the network call.`,
  );
  process.exit(1);
}
if (!dryRun && !bridgeToken) {
  console.error(
    `${TAG} FREEBUFF_BRIDGE_TOKEN is required. Pass --dry-run to skip the network call.`,
  );
  process.exit(1);
}

const serverRecord = readLiveServerInfo(process.cwd());
if (!serverRecord) {
  console.error(
    `${TAG} No running live server. Start one with: node .agents/skills/impeccable/scripts/live.mjs`,
  );
  process.exit(1);
}
const base = `http://localhost:${serverRecord.info.port}`;
const pollToken = serverRecord.info.token;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const leased = new Set();

async function postWebhookWithRetry(body) {
  let attempt = 0;
  let lastErr;
  while (attempt < MAX_WEBHOOK_ATTEMPTS) {
    attempt += 1;
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bridgeToken}`,
          "Idempotency-Key": `impeccable-live:${body.eventId ?? "no-id"}:${body.ts}`,
          "User-Agent": `impeccable-live-freebuff-bridge/${BRIDGE_VERSION}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status >= 200 && res.status < 300) {
        return await res.json().catch(() => ({ applied: true }));
      }
      if (res.status >= 400 && res.status < 500) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `webhook rejected with ${res.status}: ${detail.slice(0, 500).trim()}`.trim(),
        );
      }
      lastErr = new Error(`webhook 5xx ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < MAX_WEBHOOK_ATTEMPTS) {
      const backoff = Math.min(30_000, 500 * 2 ** (attempt - 1));
      await sleep(backoff);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("webhook exhausted retry budget");
}

/**
 * Wrap fetchNextEvent so a transient live-server restart (ECONNREFUSED on
 * localhost:8400 while live-server.mjs re-binds) does not kill the bridge.
 * The live server re-queues unacknowledged events on restart (see live.md
 * "Server restart rule"), so simply polling again is correct.
 *
 * 401 (AUTH_FAILED) and 5xx from the server itself are NOT retried: those are
 * configuration / capacity problems the user must see.
 */
async function fetchNextWithRetry() {
  let attempt = 0;
  while (true) {
    try {
      return await fetchNextEvent(base, pollToken, {
        types: typeFilter.split(","),
      });
    } catch (err) {
      if (err.cause?.code !== "ECONNREFUSED") throw err;
      if (attempt >= MAX_POLL_RESTART_ATTEMPTS) {
        const totalSeconds = Math.round(POLL_TOTAL_BACKOFF_MS / 1000);
        throw new Error(
          `live server unreachable after ${MAX_POLL_RESTART_ATTEMPTS} backoff attempts over ${totalSeconds}s; give up and restart the bridge`,
        );
      }
      attempt += 1;
      const backoff = POLL_BACKOFFS_MS[attempt - 1];
      process.stderr.write(
        `${TAG} live server not reachable: ${err.message}; retrying in ${backoff}ms (attempt ${attempt}/${MAX_POLL_RESTART_ATTEMPTS})\n`,
      );
      await sleep(backoff);
    }
  }
}

async function forward(event) {
  const body = buildInjectionBody(event);
  if (dryRun) {
    process.stdout.write(
      `${TAG} [dry-run] would POST to ${webhookUrl ?? "(unset)"}\n${JSON.stringify(body, null, 2)}\n\n`,
    );
    return { applied: "dry" };
  }
  return postWebhookWithRetry(body);
}

function buildInjectionBody(event) {
  const eventId = typeof event?.id === "string" ? event.id : null;
  return {
    source: "impeccable-live",
    sessionId: typeof event?.sessionId === "string" ? event.sessionId : null,
    eventId,
    type: typeof event?.type === "string" ? event.type : null,
    ts: new Date().toISOString(),
    briefMarkdown: renderBriefMarkdown(event),
    raw: event,
    optionalReplyHint: eventId
      ? {
          eventId,
          replyCommand: `node .agents/skills/impeccable/scripts/live-poll.mjs --reply ${eventId} done`,
        }
      : null,
  };
}

function renderBriefMarkdown(event) {
  const lines = [];
  lines.push(`## Impeccable Live: ${event?.type ?? "event"}`);
  if (event?.action) lines.push(`- **action**: \`${event.action}\``);
  if (event?.mode) lines.push(`- **mode**: \`${event.mode}\``);
  if (event?.pageUrl) lines.push(`- **pageUrl**: ${event.pageUrl}`);
  if (event?.element?.tagName) {
    const tag = String(event.element.tagName).toLowerCase();
    const idPart = event.element.id ? ` id="${event.element.id}"` : "";
    lines.push(`- **element**: \`<${tag}${idPart}>\``);
  }
  if (typeof event?.element?.textContent === "string") {
    const summary = event.element.textContent.trim().slice(0, 160);
    if (summary) lines.push(`- **snippet**: ${summary}`);
  }
  if (event?.insert) {
    lines.push(
      `- **insert.position**: \`${event.insert.position ?? "(unset)"}\``,
      `- **insert.anchor**: \`${event.insert.anchor ?? "(unset)"}\``,
    );
  }
  if (event?.placeholder) {
    lines.push(
      `- **placeholder**: ${event.placeholder.width ?? "?"} × ${event.placeholder.height ?? "?"}`,
    );
  }
  if (event?.freeformPrompt) {
    lines.push("", "### Freeform prompt", "", event.freeformPrompt);
  }
  if (Array.isArray(event?.comments) && event.comments.length > 0) {
    lines.push("", "### Annotations");
    for (const c of event.comments) {
      const text = typeof c === "string" ? c : (c?.text ?? JSON.stringify(c));
      lines.push(`- ${text}`);
    }
  }
  if (event?.steerMessage ?? event?.message) {
    lines.push("", "### Message", "", event.steerMessage ?? event.message);
  }
  return lines.join("\n");
}

async function run() {
  process.stderr.write(
    `${TAG} ${dryRun ? "DRY-RUN" : `forwarding to ${webhookUrl}`}; types=${typeFilter}; ack=${ackOnForward ? "on" : "off"}; version=${BRIDGE_VERSION}\n`,
  );
  while (true) {
    let next;
    try {
      next = await fetchNextWithRetry();
    } catch (err) {
      console.error(`${TAG} poll failed (permanent): ${err.message}`);
      process.exitCode = 1;
      return;
    }
    if (!next) continue;
    if (next.type === "timeout") continue;
    if (next.type === "exit") {
      process.stderr.write(`${TAG} server reported exit.\n`);
      return;
    }

    const eventId = next.id ?? "(no-id)";
    leased.add(eventId);
    try {
      await forward(next);
      process.stderr.write(`${TAG} forwarded ${eventId} (${next.type})\n`);
      if (ackOnForward && typeof next.id === "string") {
        try {
          await postReply(base, pollToken, {
            id: next.id,
            type: "done",
            message: "forwarded to freebuff",
          });
          process.stderr.write(`${TAG} acked ${eventId} on the live server\n`);
        } catch (err) {
          process.stderr.write(
            `${TAG} WARN: ack ${eventId} failed: ${err.message}; leaving leased so a future reply can land\n`,
          );
        }
      }
    } catch (err) {
      process.stderr.write(
        `${TAG} ERROR forwarding ${eventId}: ${err.message}; leaving leased\n`,
      );
    } finally {
      leased.delete(eventId);
    }
  }
}

function shutdown(signal) {
  const remaining = [...leased];
  process.stderr.write(
    `${TAG} received ${signal}; remaining leased (forwarded but not acked): ${remaining.length === 0 ? "(none)" : remaining.join(", ")}\n`,
  );
  process.exit(process.exitCode ?? 0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

run().catch((err) => {
  console.error(`${TAG} fatal:`, err);
  process.exit(1);
});
