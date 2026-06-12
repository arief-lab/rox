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
  it("renders a spinning icon", () => {
    const { container, unmount } = render();
    // lucide-react renders an SVG inside the component
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // The SVG has the animate-spin class
    expect(svg?.getAttribute("class")).toContain("animate-spin");
    unmount();
  });
});
