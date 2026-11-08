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

  it("keeps the same image node across re-renders with unchanged props", () => {
    const text = "![chart](assets/q008.png)";
    const { container, rerender } = render(<RichText text={text} docId={7} />);
    const before = container.querySelector("img");
    expect(before).not.toBeNull();

    // A practice-page timer tick re-renders the question card once a second.
    rerender(<RichText text={text} docId={7} />);

    expect(container.querySelector("img")).toBe(before);
  });

  it("resolves assets against the document id", () => {
    const { container } = render(<RichText text="![chart](assets/q008.png)" docId={7} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/documents/7/assets/q008.png",
    );
  });

  it("renders imported source underlines and strike-throughs", () => {
    const { container } = render(
      <RichText text="The <u>underlined portion</u> and <s>crossed out</s> words." />,
    );
    expect(container.querySelector("u")?.textContent).toBe("underlined portion");
    expect(container.querySelector("s")?.textContent).toBe("crossed out");
    expect(container.textContent).toContain("The underlined portion");
  });

  it("sanitizes any other raw HTML in imported text", () => {
    const { container } = render(
      <RichText text={'safe <script>alert("x")</script> <b>bold</b>'} />,
    );
    expect(container.querySelector("script")).toBeNull();
  });
});
