import { describe, expect, it } from "vitest";

import { TransferMachine } from "@/lib/transfer/state-machine";

// Module-level constants — Biome's `noMisleadingCharacterClass` /
// `useTopLevelRegex` rules flag regex literals created inside
// function scopes on every call. Extracting them once is both
// cheaper and clearer about what each test is asserting.
const CANCELLED_FROM_COMPLETED = /Cannot cancel from completed/;
const CANCELLED_FROM_FAILED = /Cannot cancel from failed/;
const CANCELLED_FROM_IDLE = /Cannot cancel from idle/;

const COMPLETED_FROM_COMPLETED = /Cannot complete from completed/;
const COMPLETED_FROM_FAILED = /Cannot complete from failed/;
const COMPLETED_FROM_IDLE = /Cannot complete from idle/;
const COMPLETED_FROM_CANCELLED = /Cannot complete from cancelled/;

const FAILED_FROM_COMPLETED = /Cannot fail from completed/;
const FAILED_FROM_FAILED = /Cannot fail from failed/;
const FAILED_FROM_IDLE = /Cannot fail from idle/;
const FAILED_FROM_CANCELLED = /Cannot fail from cancelled/;

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

/**
 * TransferMachine.complete() guards every entry point.
 *
 * The complete() method is only legal from "sending" or
 * "receiving" (the two active states). From any terminal state
 * ("completed", "failed", "cancelled") or from the initial
 * "idle" state, it throws — a machine that silently allowed
 * complete() from a terminal state would also silently allow
 * cancel() / fail() to overwrite the "completed" state, breaking
 * the PRD invariant that a successful transfer is a final
 * state. The same no-op invariant applies: an illegal
 * transition is a no-op, not a partial state mutation.
 */
describe("TransferMachine.complete()", () => {
  it("sending→completed is legal", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.complete();
    expect(m.getState().kind).toBe("completed");
  });

  it("receiving→completed is legal", () => {
    const m = new TransferMachine();
    m.startReceiving("file-1", "test.txt", 1024);
    m.complete();
    expect(m.getState().kind).toBe("completed");
  });

  it("completed→completed throws", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.complete();
    expect(() => m.complete()).toThrow(COMPLETED_FROM_COMPLETED);
    // Illegal transition is a no-op: the machine stays in its
    // prior state, not partially mutated.
    expect(m.getState().kind).toBe("completed");
  });

  it("failed→completed throws", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.fail("test failure");
    expect(() => m.complete()).toThrow(COMPLETED_FROM_FAILED);
    expect(m.getState().kind).toBe("failed");
  });

  it("idle→completed throws", () => {
    const m = new TransferMachine();
    expect(() => m.complete()).toThrow(COMPLETED_FROM_IDLE);
    expect(m.getState().kind).toBe("idle");
  });

  it("cancelled→completed throws", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.cancel();
    expect(() => m.complete()).toThrow(COMPLETED_FROM_CANCELLED);
    // The cancel is a final state — a later complete() must
    // not silently overwrite it. This is the symmetric
    // invariant to the cancel()→failed concern documented
    // above: neither terminal transition can be clobbered
    // by the other.
    expect(m.getState().kind).toBe("cancelled");
  });
});

/**
 * TransferMachine.fail() guards every entry point.
 *
 * The fail() method is only legal from "sending" or "receiving"
 * (the two active states). From any terminal state ("completed",
 * "failed", "cancelled") or from the initial "idle" state, it
 * throws — the same no-op invariant as complete() and cancel().
 * The send()/receive() catch blocks call fail() on errors, so
 * a machine that silently allowed fail() from a terminal state
 * would let a late error corrupt the final state of a transfer
 * that already settled.
 */
describe("TransferMachine.fail()", () => {
  it("sending→failed is legal", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.fail("network error");
    // Store the state in a local so the `if` below narrows the
    // same object (two calls to getState() would return the
    // same shape, but TS doesn't narrow across calls).
    const state = m.getState();
    expect(state.kind).toBe("failed");
    if (state.kind === "failed") {
      expect(state.reason).toBe("network error");
    }
  });

  it("receiving→failed is legal", () => {
    const m = new TransferMachine();
    m.startReceiving("file-1", "test.txt", 1024);
    m.fail("protocol error");
    const state = m.getState();
    expect(state.kind).toBe("failed");
    if (state.kind === "failed") {
      expect(state.reason).toBe("protocol error");
    }
  });

  it("completed→failed throws", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.complete();
    expect(() => m.fail("late error")).toThrow(FAILED_FROM_COMPLETED);
    // A successful transfer must not be silently overwritten
    // by a later failure. The Inbox-side consumers rely on
    // "completed" being a final, trusted state — if fail()
    // could clobber it, the Inbox could end up holding a
    // "failed" entry that was already pushed.
    expect(m.getState().kind).toBe("completed");
  });

  it("failed→failed throws", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.fail("first error");
    expect(() => m.fail("second error")).toThrow(FAILED_FROM_FAILED);
    // The original reason is preserved — the first error
    // wins, which matters for diagnostics (the second error
    // might be a less specific "transport closed" masking
    // the real "protocol error").
    const state = m.getState();
    expect(state.kind).toBe("failed");
    if (state.kind === "failed") {
      expect(state.reason).toBe("first error");
    }
  });

  it("idle→failed throws", () => {
    const m = new TransferMachine();
    expect(() => m.fail("nothing to fail")).toThrow(FAILED_FROM_IDLE);
    expect(m.getState().kind).toBe("idle");
  });

  it("cancelled→failed throws", () => {
    const m = new TransferMachine();
    m.startSending("file-1", "test.txt", 1024);
    m.cancel();
    expect(() => m.fail("late error")).toThrow(FAILED_FROM_CANCELLED);
    // This is the specific invariant the cancel() test's
    // JSDoc warned about: a cancel must not be silently
    // overwritten by a late fail() from the send()/receive()
    // catch block. The machine stays "cancelled" so the
    // PRD contract "a cancel is not a failure" holds.
    expect(m.getState().kind).toBe("cancelled");
  });
});
