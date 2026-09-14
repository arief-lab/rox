// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Transfer machine for the optical (fountain-coded QR) path.
 *
 * Mirrors the HyperTransferMachine shape so app layers drive both paths
 * the same way. The optical path is unidirectional, so the states are
 * simpler: the sender beams and never receives; the receiver never
 * beams.
 *
 * States:
 * - idle: no transfer in progress
 * - beaming: sender is rendering the symbol stream
 * - receiving: receiver is collecting symbols
 * - completed: SHA-256 verified on the receiver (or release on sender)
 * - failed: decoder stuck / verification mismatch / IO error
 * - cancelled: user stopped before completion
 */

export type OpticalTransferState =
	| { kind: "idle" }
	| { kind: "beaming"; fileId: string }
	| { kind: "receiving"; fileId: string }
	| { kind: "completed" }
	| { kind: "failed"; reason: string }
	| { kind: "cancelled" };

export class OpticalTransferMachine {
	private state: OpticalTransferState = { kind: "idle" };

	getState(): Readonly<OpticalTransferState> {
		return this.state;
	}

	/** Sender: header built, symbol stream is being rendered. */
	startBeaming(fileId: string): void {
		this.assertKind("idle");
		this.state = { fileId, kind: "beaming" };
	}

	/** Receiver: header seen, symbols are being collected. */
	startReceiving(fileId: string): void {
		this.assertKind("idle");
		this.state = { fileId, kind: "receiving" };
	}

	complete(): void {
		if (this.state.kind !== "beaming" && this.state.kind !== "receiving") {
			throw new Error(
				`Cannot complete from ${this.state.kind} — must be beaming or receiving`
			);
		}
		this.state = { kind: "completed" };
	}

	fail(reason: string): void {
		if (this.state.kind !== "beaming" && this.state.kind !== "receiving") {
			throw new Error(`Cannot fail from ${this.state.kind}`);
		}
		this.state = { kind: "failed", reason };
	}

	cancel(): void {
		if (this.state.kind !== "beaming" && this.state.kind !== "receiving") {
			throw new Error(`Cannot cancel from ${this.state.kind}`);
		}
		this.state = { kind: "cancelled" };
	}

	reset(): void {
		this.state = { kind: "idle" };
	}

	private assertKind(kind: OpticalTransferState["kind"]): void {
		if (this.state.kind !== kind) {
			throw new Error(`Cannot transition to ${kind} from ${this.state.kind}`);
		}
	}
}
