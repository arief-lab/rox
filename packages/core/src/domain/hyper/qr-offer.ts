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
 * fixed-length and trivially splittable. Optional segments ride after
 * colons, percent-encoded:
 *
 *   rox1:<driveKey><topic>:name=<percent-encoded>
 *   rox1:<driveKey><topic>:sender=<16-hex device id>
 *
 * The optional `sender` id lets the receiver verify the pairing safety
 * code BEFORE connecting — it can derive `pairSafetyCode(localId,
 * senderId)` from the QR alone and compare against the sender's screen.
 * Older senders omit the segment; receivers then fall back to the
 * in-band hello (which the safety code still covers).
 */

const PREFIX = "rox1:";
const HEX_KEY_LENGTH = 64;
const MIN_LENGTH = PREFIX.length + HEX_KEY_LENGTH * 2;
const HEX_PATTERN = /^[0-9a-f]+$/;
const SENDER_ID_LENGTH = 16;

export interface QrOffer {
	driveKey: string;
	name?: string;
	/** Sender's 16-hex device id, when the sender includes it. */
	senderId?: string;
	topic: string;
}

/** Encode an offer into a compact QR string. */
export function encodeQrOffer(offer: QrOffer): string {
	let payload = `${PREFIX}${offer.driveKey}${offer.topic}`;
	const segments: string[] = [];
	if (offer.senderId) {
		segments.push(`sender=${offer.senderId}`);
	}
	if (offer.name) {
		segments.push(`name=${encodeURIComponent(offer.name)}`);
	}
	if (segments.length > 0) {
		payload += `:${segments.join(",")}`;
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
	let senderId: string | undefined;
	if (rest.startsWith(":")) {
		for (const segment of rest.slice(1).split(",")) {
			const eq = segment.indexOf("=");
			if (eq === -1) {
				continue;
			}
			const key = segment.slice(0, eq);
			const value = segment.slice(eq + 1);
			if (key === "name") {
				name = decodeURIComponent(value);
			} else if (
				key === "sender" &&
				value.length === SENDER_ID_LENGTH &&
				HEX_PATTERN.test(value)
			) {
				senderId = value;
			}
		}
	}

	return { driveKey, name, senderId, topic };
}
