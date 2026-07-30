// SPDX-License-Identifier: AGPL-3.0-or-later
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import Loader from "@/components/loader";

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Loader />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("Loader", () => {
  it("renders a loading status element", () => {
    const { container, unmount } = render();
    const loader = container.querySelector('[role="status"]');
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute("aria-label")).toBe("Loading");
    unmount();
  });
});
