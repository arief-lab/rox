import { describe, expect, it } from "vitest";

import { TransferMachine } from "@/lib/transfer/state-machine";

// Module-level constants — Biome's `noMisleadingCharacterClass` /
// `useTopLevelRegex` rules flag regex literals created inside
// function scopes on every call. Extracting them once is both
// cheaper and clearer about what each test is asserting.
const CANCELLED_FROM_COMPLETED = /Cannot cancel from completed/;
const CANCELLED_FROM_FAILED = /Cannot cancel from failed/;
const CANCELLED_FROM_IDLE = /Cannot cancel from idle/;

/**
 * TransferMachine.cancel() guards every entry point.
 *
 * The cancel() method is only legal from "sending" or "receiving"
 * (the two active states). From any terminal state ("completed",
 * "failed", "cancelled") or from the initial "idle" state, it
 * throws — the assumption being that once a transfer has reached
 * a terminal state, there's nothing left to cancel, and calling
 * cancel() on a machine that never started is a programmer error.
 *
 * These guards matter because the send()/receive() catch blocks
 * check `if (machine.getState().kind === "sending")` before
 * calling machine.fail() — so a machine that silently allows
 * cancel() from a terminal state would also silently allow
 * fail() to overwrite the "cancelled" state with "failed",
 * breaking the PRD invariant that a cancel is not a failure.
 */
describe("TransferMachine.cancel()", () => {
  it("sending→cancelled is legal", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.cancel();
    expect(m.getState().kind).toBe("cancelled");
  });

  it("receiving→cancelled is legal", () => {
    const m = new TransferMachine();
    m.startReceiving("file-1", "test.txt", 1024);
    m.cancel();
    expect(m.getState().kind).toBe("cancelled");
  });

  it("completed→cancelled throws", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.complete();
    expect(() => m.cancel()).toThrow(CANCELLED_FROM_COMPLETED);
    // Illegal transition is a no-op: the machine stays in its
    // prior state, not partially mutated to "cancelled".
    expect(m.getState().kind).toBe("completed");
  });

  it("failed→cancelled throws", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.fail("test failure");
    expect(() => m.cancel()).toThrow(CANCELLED_FROM_FAILED);
    expect(m.getState().kind).toBe("failed");
  });

  it("idle→cancelled throws", () => {
    const m = new TransferMachine();
    expect(() => m.cancel()).toThrow(CANCELLED_FROM_IDLE);
    expect(m.getState().kind).toBe("idle");
  });
});
