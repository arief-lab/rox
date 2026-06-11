/**
 * Transfer state machine.
 *
 * Pure — tracks which phase a Transfer is in. The send/receive functions
 * drive the transitions; the UI reads the state to render progress.
 *
 * States:
 * - idle: no Transfer in progress
 * - sending: a send is in progress (this side is the Sender)
 * - receiving: a receive is in progress (this side is the Receiver)
 * - completed: the Transfer finished successfully
 * - failed: the Transfer ended with an error
 * - cancelled: the Transfer was cancelled by the user
 *
 * Legal transitions:
 * - idle → sending (startSending)
 * - idle → receiving (startReceiving)
 * - sending → completed (complete)
 * - sending → failed (fail)
 * - sending → cancelled (cancel)
 * - receiving → completed (complete)
 * - receiving → failed (fail)
 * - receiving → cancelled (cancel)
 * - any → idle (reset)
 *
 * Illegal transitions throw an Error so tests can assert on them.
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
    this.state = { kind: "sending", fileId, name, totalSize };
  }

  startReceiving(fileId: string, name: string, totalSize: number): void {
    this.assertKind("idle");
    this.state = { kind: "receiving", fileId, name, totalSize };
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
      throw new Error(
        `Cannot fail from ${this.state.kind} — must be sending or receiving`
      );
    }
    this.state = { kind: "failed", reason };
  }

  cancel(): void {
    if (this.state.kind !== "sending" && this.state.kind !== "receiving") {
      throw new Error(
        `Cannot cancel from ${this.state.kind} — must be sending or receiving`
      );
    }
    this.state = { kind: "cancelled" };
  }

  reset(): void {
    this.state = { kind: "idle" };
  }

  private assertKind(expected: TransferState["kind"]): void {
    if (this.state.kind !== expected) {
      throw new Error(
        `Illegal Transfer transition: expected to be in "${expected}" but was in "${this.state.kind}"`
      );
    }
  }
}
