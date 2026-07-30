// SPDX-License-Identifier: AGPL-3.0-or-later

const CROCKFORD_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

/**
 * Map an offer code (or any long input) to a short, human-readable
 * 9-character code in three groups of three: e.g. `ABC-DEF-GH7`.
 *
 * Per spec §3 (Right Side / Connection code) the code is a
 * "Short human-readable fallback displayed below the QR" so it
 * should be easy to read aloud or type on a phone, which rules
 * out the raw base64 offer. We use a Crockford-style base32
 * alphabet (no I, L, O, U, 0, 1) and a deterministic djb2a
 * hash so the same offer always yields the same code.
 *
 * Returns an empty string for empty input so callers can pass
 * the result straight to the UI without an extra null check.
 */
export function shortCode(input: string): string {
  if (!input) {
    return "";
  }
  // djb2a (xor variant) — stable, predictable, no crypto dep.
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash * 33) ^ input.charCodeAt(i)) >>> 0;
  }
  const mix = (hash ^ (hash >>> 16) ^ 0xdeadbeef) >>> 0;

  const chars: string[] = [];
  let n = mix;
  while (chars.length < 9) {
    chars.push(CROCKFORD_ALPHABET[n % CROCKFORD_ALPHABET.length]);
    n = Math.floor(n / CROCKFORD_ALPHABET.length);
    // Refill from a second pass when we exhaust a single 32-bit
    // hash space — keeps the output 9 chars long without bias.
    if (n === 0 && chars.length < 9) {
      n = (hash ^ (hash << 13)) >>> 0;
    }
    // Defensive: if both mix passes collapse to 0 (impossible
    // for any real base64 offer, but the while loop has no other
    // exit), bump to a non-zero starting point so we cannot spin.
    if (n === 0) {
      n = 1;
    }
  }
  // Unique grouping per group, MSB first. Three groups of 3.
  return `${chars.slice(0, 3).join("")}-${chars.slice(3, 6).join("")}-${chars.slice(6, 9).join("")}`;
}
