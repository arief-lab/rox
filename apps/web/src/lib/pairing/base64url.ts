// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * base64url codec (RFC 4648 §5). URL-safe variant: `+` → `-`, `/` → `_`,
 * padding stripped. The decoder is the inverse and re-adds padding before
 * calling `atob` so it can decode any standard base64url input.
 */

export function encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function decode(input: string): string {
  const unpadded = input.replaceAll("-", "+").replaceAll("_", "/");
  const padding = unpadded.length % 4;
  const fullPadded =
    padding > 0 ? unpadded + "=".repeat(4 - padding) : unpadded;
  const binary = atob(fullPadded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
