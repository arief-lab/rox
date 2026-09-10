/**
 * @rox/core — transport-agnostic transfer domain.
 *
 * Public surface: domain (protocol, state machines) + ports (Transport).
 * Adapters (Hyperswarm, WebRTC, mock) implement the Transport port and
 * are selected by the consuming app at bootstrap — never imported by
 * the domain itself.
 */

export * from "./domain";
export * from "./ports";
