import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PassageText from "./PassageText";

describe("PassageText", () => {
  it("labels a single passage as Passage", () => {
    render(<PassageText material="A single text." />);
    expect(screen.getByText("Passage")).toBeInTheDocument();
    expect(screen.queryByText("Text 1")).not.toBeInTheDocument();
  });

  it("stacks paired passages with Text 1 / Text 2 labels", () => {
    const { container } = render(
      <PassageText material="First passage." material2="Second passage." />,
    );
    expect(screen.getByText("Text 1")).toBeInTheDocument();
    expect(screen.getByText("Text 2")).toBeInTheDocument();
    expect(screen.queryByText("Passage")).not.toBeInTheDocument();
    expect(container.textContent).toContain("First passage.");
    expect(container.textContent).toContain("Second passage.");
  });

  it("keeps verse line breaks instead of collapsing them", () => {
    const { container } = render(
      <PassageText material={"The little fern-leaf, bending\nUpon the brink"} />,
    );
    expect(container.querySelectorAll("br")).toHaveLength(1);
  });

  it("renders nothing when both texts are empty", () => {
    const { container } = render(<PassageText material={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
