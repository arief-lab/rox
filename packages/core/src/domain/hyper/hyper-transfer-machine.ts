// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Transfer machine for the Hyperdrive path.
 *
 * The Hyper path has different states than the chunked path: bulk data
 * flows via drive replication (with Hypercore's built-in resume), so
 * the machine only tracks the signaling handshake and final disposition.
 *
 * States:
 * - idle: no transfer in progress
 * - offering: sender has seeded the drive, waiting for the receiver
 * - receiving: receiver is replicating the drive
 * - completed: drive fully replicated (and released, if sender)
 * - failed: replication or handshake error
 * - cancelled: user cancelled before completion
 */

export type HyperTransferState =
	| { kind: "idle" }
	| { kind: "offering"; driveKey: string; topic: string; name: string }
	| { kind: "receiving"; driveKey: string; topic: string }
	| { kind: "completed" }
	| { kind: "failed"; reason: string }
	| { kind: "cancelled" };

export class HyperTransferMachine {
	private state: HyperTransferState = { kind: "idle" };

	getState(): Readonly<HyperTransferState> {
		return this.state;
	}

	/** Sender: drive seeded, waiting for the receiver to accept. */
	startOffering(driveKey: string, topic: string, name: string): void {
		this.assertKind("idle");
		this.state = { driveKey, kind: "offering", name, topic };
	}

	/** Receiver: began replicating the offered drive. */
	startReceiving(driveKey: string, topic: string): void {
		this.assertKind("idle");
		this.state = { driveKey, kind: "receiving", topic };
	}

	complete(): void {
		if (this.state.kind !== "offering" && this.state.kind !== "receiving") {
			throw new Error(
				`Cannot complete from ${this.state.kind} — must be offering or receiving`
			);
		}
		this.state = { kind: "completed" };
	}

	fail(reason: string): void {
		if (this.state.kind !== "offering" && this.state.kind !== "receiving") {
			throw new Error(`Cannot fail from ${this.state.kind}`);
		}
		this.state = { kind: "failed", reason };
	}

	cancel(): void {
		if (this.state.kind !== "offering" && this.state.kind !== "receiving") {
			throw new Error(`Cannot cancel from ${this.state.kind}`);
		}
		this.state = { kind: "cancelled" };
	}

	reset(): void {
		this.state = { kind: "idle" };
	}

	private assertKind(kind: HyperTransferState["kind"]): void {
		if (this.state.kind !== kind) {
			throw new Error(`Cannot transition to ${kind} from ${this.state.kind}`);
		}
	}
}
