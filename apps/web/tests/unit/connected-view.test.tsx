import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ConnectedView } from "@/components/connected-view/connected-view";
import type { Inbox, PendingEntry } from "@/lib/inbox";
import { Inbox as InboxClass } from "@/lib/inbox";
import type { Session } from "@/lib/webrtc";

const NOOP = vi.fn();

/**
 * Stub Session that satisfies the Session type used by SessionTimer.
 * Only the methods actually called by the component need implementations.
 */
function mockSession(overrides?: {
  getRemainingIdleMs?: () => number;
  isClosed?: () => boolean;
  getCloseReason?: () => string | null;
}) {
  return {
    getRemainingIdleMs: overrides?.getRemainingIdleMs ?? (() => 300_000),
    isClosed: overrides?.isClosed ?? (() => false),
    getCloseReason: overrides?.getCloseReason ?? (() => null),
  } as unknown as Session;
}

interface RenderProps {
  connectionStatus?: "connecting" | "connected" | "disconnected";
  handleCancelReceive?: () => void;
  handleCancelSend?: () => void;
  handleClose?: () => void;
  handleSend?: (file: File) => Promise<void>;
  inbox?: Inbox;
  peerName?: string | undefined;
  progress?: { bytes: number; total: number } | null;
  receiveProgress?: { bytes: number; total: number } | null;
  sendLog?: string[];
  session?: ReturnType<typeof mockSession> | null;
  wasDisconnected?: boolean;
}

function render(props: RenderProps = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ConnectedView
        connectionStatus={props.connectionStatus ?? "connected"}
        handleCancelReceive={props.handleCancelReceive ?? NOOP}
        handleCancelSend={props.handleCancelSend ?? NOOP}
        handleClose={props.handleClose ?? NOOP}
        handleSend={props.handleSend ?? vi.fn()}
        inbox={props.inbox ?? new InboxClass()}
        peerName={props.peerName}
        progress={props.progress ?? null}
        receiveProgress={props.receiveProgress ?? null}
        sendLog={props.sendLog ?? []}
        session={props.session ?? null}
        wasDisconnected={props.wasDisconnected ?? false}
      />
    );
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("ConnectedView", () => {
  it("renders the Connected header", () => {
    const { container, unmount } = render();
    expect(container.textContent).toContain("Connected");
    unmount();
  });

  it("shows the peer name", () => {
    const { container, unmount } = render({ peerName: "Alice's iPhone" });
    expect(container.textContent).toContain("Alice's iPhone");
    unmount();
  });

  it("shows (unknown) when peerName is undefined", () => {
    const { container, unmount } = render({ peerName: undefined });
    expect(container.textContent).toContain("(unknown)");
    unmount();
  });

  it("renders SessionTimer when session is provided", () => {
    const session = mockSession();
    const { container, unmount } = render({ session });
    expect(
      container.querySelector('[data-testid="session-timer"]')
    ).not.toBeNull();
    unmount();
  });

  it("does not render SessionTimer when session is null", () => {
    const { container, unmount } = render({ session: null });
    expect(container.querySelector('[data-testid="session-timer"]')).toBeNull();
    unmount();
  });

  it("renders the SendButton (enabled when no progress)", () => {
    const { container, unmount } = render();
    const sendBtn = container.querySelector(
      '[data-testid="send-file"]'
    ) as HTMLButtonElement;
    expect(sendBtn).not.toBeNull();
    expect(sendBtn.disabled).toBe(false);
    unmount();
  });

  it("disables SendButton when progress is not null", () => {
    const { container, unmount } = render({
      progress: { bytes: 50, total: 100 },
    });
    const sendBtn = container.querySelector(
      '[data-testid="send-file"]'
    ) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
    unmount();
  });

  it("disables SendButton when wasDisconnected is true", () => {
    const { container, unmount } = render({ wasDisconnected: true });
    const sendBtn = container.querySelector(
      '[data-testid="send-file"]'
    ) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
    unmount();
  });

  it("shows send progress when progress is not null", () => {
    const { container, unmount } = render({
      progress: { bytes: 50, total: 100 },
    });
    expect(
      container.querySelector('[data-testid="send-progress"]')
    ).not.toBeNull();
    unmount();
  });

  it("shows the send log when sendLog is non-empty", () => {
    const { container, unmount } = render({
      sendLog: ["Sent file.txt (100 B)"],
    });
    const log = container.querySelector('[data-testid="send-log"]');
    expect(log).not.toBeNull();
    expect(log?.textContent).toContain("Sent file.txt");
    unmount();
  });

  it("does not show send log when sendLog is empty", () => {
    const { container, unmount } = render({ sendLog: [] });
    expect(container.querySelector('[data-testid="send-log"]')).toBeNull();
    unmount();
  });

  it("shows receive progress when receiveProgress is not null", () => {
    const { container, unmount } = render({
      receiveProgress: { bytes: 30, total: 200 },
    });
    expect(
      container.querySelector('[data-testid="receive-section"]')
    ).not.toBeNull();
    unmount();
  });

  it("does not show receive section when receiveProgress is null", () => {
    const { container, unmount } = render({ receiveProgress: null });
    expect(
      container.querySelector('[data-testid="receive-section"]')
    ).toBeNull();
    unmount();
  });

  it("renders the InboxScreen", () => {
    const { container, unmount } = render();
    expect(
      container.querySelector('[data-testid="inbox-section"]')
    ).not.toBeNull();
    unmount();
  });

  it('shows "Close session" button text when not disconnected', () => {
    const { container, unmount } = render({ wasDisconnected: false });
    const closeBtn = container.querySelector(
      '[data-testid="close-session"]'
    ) as HTMLButtonElement;
    expect(closeBtn.textContent).toBe("Close session");
    unmount();
  });

  it('shows "Start over" button text when disconnected', () => {
    const { container, unmount } = render({ wasDisconnected: true });
    const closeBtn = container.querySelector(
      '[data-testid="close-session"]'
    ) as HTMLButtonElement;
    expect(closeBtn.textContent).toBe("Start over");
    unmount();
  });

  it("calls handleClose when the close button is clicked", () => {
    const handleClose = vi.fn();
    const { container, unmount } = render({ handleClose });
    const closeBtn = container.querySelector(
      '[data-testid="close-session"]'
    ) as HTMLButtonElement;
    closeBtn.click();
    expect(handleClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("renders ConnectionStatus with the given status", () => {
    const { container, unmount } = render({
      connectionStatus: "connected",
    });
    const status = container.querySelector('[data-testid="connection-status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("data-status")).toBe("connected");
    unmount();
  });

  describe("pending send entries", () => {
    function makePending(overrides: Partial<PendingEntry> = {}): PendingEntry {
      return {
        blob: new Blob(["data"]),
        id: "pending-1",
        name: "photo.jpg",
        sharedAt: Date.now(),
        size: 1024,
        type: "image/jpeg",
        ...overrides,
      };
    }

    it("shows pending entries when inbox has them", () => {
      const inbox = new InboxClass();
      inbox.pushPending(makePending({ id: "p1", name: "doc.pdf" }));
      const { container, unmount } = render({ inbox });
      expect(
        container.querySelector('[data-testid="pending-send-section"]')
      ).not.toBeNull();
      expect(container.textContent).toContain("doc.pdf");
      unmount();
    });

    it("does not show pending section when inbox has no pending", () => {
      const inbox = new InboxClass();
      const { container, unmount } = render({ inbox });
      expect(
        container.querySelector('[data-testid="pending-send-section"]')
      ).toBeNull();
      unmount();
    });

    it("Discard button calls inbox.removePending", () => {
      const inbox = new InboxClass();
      inbox.pushPending(makePending({ id: "p1" }));
      const removeSpy = vi.spyOn(inbox, "removePending");
      const { container, unmount } = render({ inbox });

      const discardBtn = container.querySelector(
        '[data-testid="pending-discard-button"]'
      ) as HTMLButtonElement;
      discardBtn.click();

      expect(removeSpy).toHaveBeenCalledWith("p1");
      unmount();
    });

    it("Send button calls handleSend and removes from pending", () => {
      const inbox = new InboxClass();
      inbox.pushPending(
        makePending({
          id: "p1",
          name: "doc.pdf",
          blob: new Blob(["hello"]),
          type: "application/pdf",
        })
      );
      const removeSpy = vi.spyOn(inbox, "removePending");
      const handleSend = vi.fn();
      const { container, unmount } = render({ inbox, handleSend });

      const sendBtn = container.querySelector(
        '[data-testid="pending-send-button"]'
      ) as HTMLButtonElement;
      sendBtn.click();

      expect(removeSpy).toHaveBeenCalledWith("p1");
      expect(handleSend).toHaveBeenCalledTimes(1);
      expect(handleSend.mock.calls[0][0]).toBeInstanceOf(File);
      expect(handleSend.mock.calls[0][0].name).toBe("doc.pdf");
      unmount();
    });

    it("disables pending Send button when progress is not null", () => {
      const inbox = new InboxClass();
      inbox.pushPending(makePending({ id: "p1" }));
      const { container, unmount } = render({
        inbox,
        progress: { bytes: 10, total: 100 },
      });

      const sendBtn = container.querySelector(
        '[data-testid="pending-send-button"]'
      ) as HTMLButtonElement;
      expect(sendBtn.disabled).toBe(true);
      unmount();
    });

    it("disables pending Send button when wasDisconnected is true", () => {
      const inbox = new InboxClass();
      inbox.pushPending(makePending({ id: "p1" }));
      const { container, unmount } = render({
        inbox,
        wasDisconnected: true,
      });

      const sendBtn = container.querySelector(
        '[data-testid="pending-send-button"]'
      ) as HTMLButtonElement;
      expect(sendBtn.disabled).toBe(true);
      unmount();
    });
  });
});
