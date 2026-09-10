// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Transfer state machine.
 *
 * Pure — tracks which phase a transfer is in. Send/receive drivers
 * call the transition methods; UI reads the state to render progress.
 *
 * Legal transitions:
 * - idle → sending (startSending) | receiving (startReceiving)
 * - sending|receiving → completed (complete) | failed (fail) | cancelled (cancel)
 * - any → idle (reset)
 *
 * Illegal transitions throw so tests can assert on them.
 */

export type TransferState =
	| { kind: "idle" }
	| { kind: "sending"; fileId: string; name: string; totalSize: number }
	| { kind: "receiving"; fileId: string; name: string; totalSize: number }
	| { kind: "completed" }
	| { kind: "failed"; reason: string }
	| { kind: "cancelled" };

export class TransferMachine {
	private state: TransferState = { kind: "idle" };

	getState(): Readonly<TransferState> {
		return this.state;
	}

	startSending(fileId: string, name: string, totalSize: number): void {
		this.assertKind("idle");
		this.state = { fileId, kind: "sending", name, totalSize };
	}

	startReceiving(fileId: string, name: string, totalSize: number): void {
		this.assertKind("idle");
		this.state = { fileId, kind: "receiving", name, totalSize };
	}

	complete(): void {
		if (this.state.kind !== "sending" && this.state.kind !== "receiving") {
			throw new Error(
				`Cannot complete from ${this.state.kind} — must be sending or receiving`
			);
		}
		this.state = { kind: "completed" };
	}

	fail(reason: string): void {
		if (this.state.kind !== "sending" && this.state.kind !== "receiving") {
			throw new Error(`Cannot fail from ${this.state.kind}`);
		}
		this.state = { kind: "failed", reason };
	}

	cancel(): void {
		if (this.state.kind !== "sending" && this.state.kind !== "receiving") {
			throw new Error(`Cannot cancel from ${this.state.kind}`);
		}
		this.state = { kind: "cancelled" };
	}

	reset(): void {
		this.state = { kind: "idle" };
	}

	private assertKind(kind: TransferState["kind"]): void {
		if (this.state.kind !== kind) {
			throw new Error(`Cannot transition to ${kind} from ${this.state.kind}`);
		}
	}
}
