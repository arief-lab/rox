// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * QR offer payload for the Hyper path.
 *
 * A QR code can comfortably hold ~1-2 KB, but smaller is faster to
 * scan. The full offer is 129+ hex chars; this packs it to:
 *
 *   rox1:<driveKey hex><topic hex>
 *
 * Both fields are exactly 64 hex chars (32 bytes), so the payload is
 * fixed-length and trivially splittable. Optional name rides after a
 * final colon, percent-encoded.
 */

const PREFIX = "rox1:";
const HEX_KEY_LENGTH = 64;
const MIN_LENGTH = PREFIX.length + HEX_KEY_LENGTH * 2;
const HEX_PATTERN = /^[0-9a-f]+$/;

export interface QrOffer {
	driveKey: string;
	name?: string;
	topic: string;
}

/** Encode an offer into a compact QR string. */
export function encodeQrOffer(offer: QrOffer): string {
	let payload = `${PREFIX}${offer.driveKey}${offer.topic}`;
	if (offer.name) {
		payload += `:${encodeURIComponent(offer.name)}`;
	}
	return payload;
}

/** Parse a scanned QR string into an offer. Throws on invalid input. */
export function decodeQrOffer(raw: string): QrOffer {
	const trimmed = raw.trim();
	if (!trimmed.startsWith(PREFIX)) {
		throw new Error("Not a Rox offer QR code");
	}

	const body = trimmed.slice(PREFIX.length);
	if (body.length < MIN_LENGTH - PREFIX.length) {
		throw new Error("Offer payload is truncated");
	}

	const driveKey = body.slice(0, HEX_KEY_LENGTH);
	const topic = body.slice(HEX_KEY_LENGTH, HEX_KEY_LENGTH * 2);

	if (!(HEX_PATTERN.test(driveKey) && HEX_PATTERN.test(topic))) {
		throw new Error("Offer payload is malformed");
	}

	const rest = body.slice(HEX_KEY_LENGTH * 2);
	let name: string | undefined;
	if (rest.startsWith(":")) {
		name = decodeURIComponent(rest.slice(1));
	}

	return { driveKey, name, topic };
}
