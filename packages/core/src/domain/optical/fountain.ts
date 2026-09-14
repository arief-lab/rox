// SPDX-License-Identifier: AGPL-3.0-or-later
/* biome-ignore-all lint/suspicious/noBitwiseOperators: fountain codes are defined over GF(2) — XOR mixing, the xorshift PRNG, and hash finalizers are bit-level by nature */

/**
 * Deterministic LT (Luby Transform) fountain encoder/decoder.
 *
 * Bitwise operators throughout: fountain codes are defined over GF(2)
 * — XOR mixing, xorshift PRNG, and hash finalizers are bit-level by
 * nature (file-level lint suppression below).
 *
 * Every symbol is generated from a u32 seed: the seed drives a small
 * xorshift PRNG that picks the symbol's degree from a robust soliton
 * distribution and then selects that many source pieces to XOR. Both
 * sides regenerate the exact piece-selection from the seed alone, so a
 * symbol frame only needs {seed, payload} — and encoding is fully
 * deterministic (same seed ⇒ same symbol), which makes the whole
 * pipeline testable without a camera.
 *
 * Every symbol is generated from a u32 seed: the seed drives a small
 * xorshift PRNG that picks the symbol's degree from a robust soliton
 * distribution and then selects that many source pieces to XOR. Both
 * sides regenerate the exact piece-selection from the seed alone, so a
 * symbol frame only needs {seed, payload} — and encoding is fully
 * deterministic (same seed ⇒ same symbol), which makes the whole
 * pipeline testable without a camera.
 *
 * The decoder runs the classic peeling algorithm: symbols of degree 1
 * release their piece directly; released pieces are XORed back out of
 * every remaining symbol that referenced them, which may release more
 * degree-1 symbols, and so on. Decoding fails only if the collected
 * symbols leave an unresolvable dependency cycle — collecting any
 * ~K·1.15 distinct symbols makes that vanishingly rare.
 */

/** Exclusive upper bound for xorshift32 output space. */
const U32_LIMIT = 0x1_00_00_00_00;

/**
 * Split a file into K fixed-size pieces (the last one may be shorter).
 * pieceCount is at least 1 even for empty-ish inputs.
 */
export function splitIntoPieces(
	file: Uint8Array,
	pieceSize: number
): { pieceCount: number; pieces: Uint8Array[] } {
	if (pieceSize <= 0) {
		throw new Error("pieceSize must be positive");
	}
	const pieces: Uint8Array[] = [];
	for (let offset = 0; offset < file.byteLength; offset += pieceSize) {
		pieces.push(file.subarray(offset, offset + pieceSize));
	}
	if (pieces.length === 0) {
		pieces.push(new Uint8Array(0));
	}
	return { pieceCount: pieces.length, pieces };
}

/**
 * xorshift32 — tiny deterministic PRNG (state must be non-zero).
 * Returns the next value in [0, 2^32).
 *
 * Bitwise operators are the algorithm here: fountain codes are defined
 * over GF(2), and the PRNG/degree machinery is bit-level by nature.
 */
function xorshift32(state: number): number {
	let x = state | 0;
	x ^= x << 13;
	x ^= x >>> 17;
	x ^= x << 5;
	return x >>> 0;
}

/**
 * Avalanche-mix a small seed into a full-quality PRNG state. Small
 * sequential seeds (1, 2, 3…) leave weak patterns directly in xorshift
 * output — one mixer pass (xor + two multiply rounds, murmur3 finalizer
 * style) spreads them across the whole u32 space so consecutive seeds
 * sample the degree distribution independently.
 */
function mixSeed(seed: number): number {
	let x = (seed ^ 0x9e_37_79_b9) >>> 0;
	x = xorshift32(x);
	x ^= x >>> 16;
	x = Math.imul(x, 0x85_eb_ca_6b) >>> 0;
	x ^= x >>> 13;
	x = Math.imul(x, 0xc2_b2_ae_35) >>> 0;
	x ^= x >>> 16;
	return x >>> 0;
}

/**
 * Robust soliton degree distribution for K pieces. Capped at
 * min(K, 30) so a single QR frame never carries an absurd XOR count —
 * beyond ~30 terms the extra degree barely helps peeling and the
 * payload cost is fixed anyway; the cap only bites for very large K.
 */
export function sampleDegree(
	rngState: number,
	pieceCount: number
): {
	degree: number;
	nextState: number;
} {
	const cappedK = Math.min(pieceCount, 30);
	// Ideal soliton spikes: 1 and 2 dominate; rest taper to ~1/k.
	const spikes = [1, 2];
	const spikeWeights = [0.42, 0.32];
	const tailWeight = 0.26 / Math.max(1, cappedK - spikes.length);
	const nextState = xorshift32(rngState);
	const roll = nextState / U32_LIMIT;
	let cumulative = 0;
	for (let index = 0; index < spikes.length; index += 1) {
		cumulative += spikeWeights[index] ?? 0;
		if (roll < cumulative) {
			return { degree: spikes[index] ?? 1, nextState };
		}
	}
	return {
		degree:
			spikes.length +
			Math.floor(tailWeight > 0 ? (roll - cumulative) / tailWeight : 0),
		nextState,
	};
}

/**
 * Pick which pieces a symbol XORs. Deterministic in (seed, pieceCount):
 * the seed seeds the PRNG, then each draw is `previous + 1 + rand` mod
 * pieceCount, giving distinct picks without replacement bookkeeping.
 */
export function symbolPieceIndices(
	seed: number,
	degree: number,
	pieceCount: number
): number[] {
	let state = seed === 0 ? 0x9e_37_79_b9 : seed;
	const indices: number[] = [];
	for (let index = 0; index < degree; index += 1) {
		state = xorshift32(state);
		const step = state % pieceCount;
		const last = indices.at(-1);
		const base = last === undefined ? 0 : last + 1;
		let candidate = (indices.length === 0 ? step : base + step) % pieceCount;
		// Linear-probe forward on collision (degree is tiny, so this is cheap).
		let probes = 0;
		while (indices.includes(candidate) && probes < pieceCount) {
			candidate = (candidate + 1) % pieceCount;
			probes += 1;
		}
		indices.push(candidate);
	}
	return indices;
}

function xorInto(target: Uint8Array, source: Uint8Array): void {
	for (let index = 0; index < target.length; index += 1) {
		const byte = source.at(index) ?? 0;
		target[index] = ((target.at(index) ?? 0) ^ byte) & 0xff;
	}
}

export interface GeneratedSymbol {
	degree: number;
	payload: Uint8Array;
	/** For tests/metrics: which pieces this symbol mixes. */
	pieceIndices: number[];
	seed: number;
}

/**
 * Generate one fountain symbol from a seed. Deterministic in
 * (pieces, seed): both sides agree on the mixed pieces from the seed
 * alone.
 */
export function generateSymbol(
	pieces: Uint8Array[],
	seed: number
): GeneratedSymbol {
	const pieceCount = pieces.length;
	let state = mixSeed(seed);
	state = xorshift32(state);
	const { degree } = sampleDegree(state, pieceCount);
	const indices = symbolPieceIndices(seed, Math.max(1, degree), pieceCount);
	const pieceSize = pieces[0]?.byteLength ?? 0;
	const payload = new Uint8Array(pieceSize);
	for (const index of indices) {
		const piece = pieces[index];
		if (piece !== undefined) {
			xorInto(payload, piece);
		}
	}
	return { degree: indices.length, payload, pieceIndices: indices, seed };
}

export interface PeelResult {
	/** Distinct symbols collected so far. */
	collected: number;
	/** Pieces recovered by peeling (out of pieceCount). */
	decodedPieces: number;
	/** Reconstructed file bytes, when complete. */
	file: Uint8Array | null;
}

/**
 * Peeling decoder. `symbolInputs` are {seed, payload} pairs in any
 * order, with duplicates allowed (deduped internally by seed).
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the peel loop's branches ARE the algorithm; extracting them would obscure the invariant
export function peelSymbols(
	symbolInputs: { seed: number; payload: Uint8Array }[],
	header: { pieceCount: number; pieceSize: number; originalLength: number }
): PeelResult {
	const { pieceCount } = header;
	// Regenerate each symbol's piece adjacency from its seed.
	const symbols = new Map<number, { indices: number[]; payload: Uint8Array }>();
	for (const input of symbolInputs) {
		if (symbols.has(input.seed)) {
			continue;
		}
		const state = xorshift32(mixSeed(input.seed));
		const { degree } = sampleDegree(state, pieceCount);
		const indices = symbolPieceIndices(
			input.seed,
			Math.max(1, degree),
			pieceCount
		);
		symbols.set(input.seed, { indices, payload: input.payload });
	}

	const solved = new Map<number, Uint8Array>();
	let progress = true;
	while (progress && solved.size < pieceCount) {
		progress = false;
		for (const [seed, symbol] of symbols) {
			const unsolved = symbol.indices.filter((index) => !solved.has(index));
			if (unsolved.length === 0) {
				// Fully redundant symbol now — drop it.
				symbols.delete(seed);
				progress = true;
				continue;
			}
			if (unsolved.length === 1) {
				// Degree-1 (after peeling): this piece falls out directly.
				const target = unsolved[0] ?? -1;
				const value = Uint8Array.from(symbol.payload);
				for (const index of symbol.indices) {
					if (index !== target) {
						xorInto(value, solved.get(index) ?? new Uint8Array(0));
					}
				}
				solved.set(target, value);
				symbols.delete(seed);
				progress = true;
			}
		}
	}

	if (solved.size < pieceCount) {
		return {
			collected: symbolInputs.length,
			decodedPieces: solved.size,
			file: null,
		};
	}

	// Stitch pieces back in order; truncate to the original length.
	const file = new Uint8Array(header.originalLength);
	let offset = 0;
	for (let index = 0; index < pieceCount; index += 1) {
		const piece = solved.get(index);
		if (!piece) {
			return {
				collected: symbolInputs.length,
				decodedPieces: solved.size,
				file: null,
			};
		}
		const take = Math.min(piece.byteLength, header.originalLength - offset);
		file.set(piece.subarray(0, Math.max(0, take)), offset);
		offset += take;
		if (offset >= header.originalLength) {
			break;
		}
	}
	return { collected: symbolInputs.length, decodedPieces: solved.size, file };
}
