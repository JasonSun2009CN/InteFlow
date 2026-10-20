import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlidingTabs } from "./SlidingTabs";

const TABS = [
  { key: "mistakes", label: "Mistakes (3)" },
  { key: "starred", label: "Starred (1)" },
];

function Harness() {
  const [active, setActive] = useState("mistakes");
  return (
    <SlidingTabs tabs={TABS} activeKey={active} onChange={setActive} ariaLabel="Review sets" />
  );
}

describe("SlidingTabs", () => {
  it("moves the sliding indicator when a tab is clicked", () => {
    render(<Harness />);
    const indicator = screen.getByTestId("sliding-indicator");

    expect(screen.getByRole("tab", { name: "Mistakes (3)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(indicator).toHaveStyle({ transform: "translateX(0%)" });

    fireEvent.click(screen.getByRole("tab", { name: "Starred (1)" }));

    expect(screen.getByRole("tab", { name: "Starred (1)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(indicator).toHaveStyle({ transform: "translateX(100%)" });
  });

  it("supports arrow-key tab navigation", () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Mistakes (3)" }), {
      key: "ArrowRight",
    });

    expect(screen.getByRole("tab", { name: "Starred (1)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("sliding-indicator")).toHaveStyle({
      transform: "translateX(100%)",
    });
  });
});
