import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RichText from "./RichText";

describe("RichText", () => {
  it("keeps single newlines by default (source text keeps its own layout)", () => {
    const { container } = render(<RichText text={"line one\nline two"} />);
    expect(container.querySelector("br")).not.toBeInTheDocument();
  });

  it("renders single newlines as hard breaks when asked", () => {
    const { container } = render(<RichText text={"line one\nline two"} breaks />);
    expect(container.querySelector("br")).toBeInTheDocument();
  });
});
