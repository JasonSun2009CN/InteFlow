import { describe, expect, it } from "vitest";
import {
  normalizeWithMap,
  quoteRange,
  selectionInfo,
  type SelectionInfo,
} from "./highlightRanges";

function container(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
}

describe("highlightRanges", () => {
  it("collapses whitespace and keeps a map back to the source", () => {
    const { text, map } = normalizeWithMap("one  two\nthree");
    expect(text).toBe("one two three");
    expect(map).toHaveLength(text.length);
    expect("one  two\nthree".slice(map[4], map[4] + 3)).toBe("two");
  });

  it("finds a quote across inline Markdown nodes", () => {
    const element = container("<p>An <em>important</em> idea, then another important idea.</p>");
    const first = quoteRange(element, "important idea", 0);
    const second = quoteRange(element, "important idea", 1);

    expect(first?.toString()).toBe("important idea");
    expect(second?.toString()).toBe("important idea");
    expect(first?.startOffset).not.toBe(second?.startOffset);
  });

  it("matches quotes through collapsed whitespace", () => {
    const element = container("<p>alpha   beta\ngamma</p>");
    expect(quoteRange(element, "alpha beta gamma", 0)?.toString()).toBe(
      "alpha   beta\ngamma",
    );
  });

  it("turns a browser selection into a quote and occurrence", () => {
    const element = container("<p>same word, then same word</p>");
    const text = element.querySelector("p")!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 16);
    range.setEnd(text, 25);
    const info: SelectionInfo | null = selectionInfo(element, range);

    expect(info?.quote).toBe("same word");
    expect(info?.occurrence).toBe(1);
    expect(info?.start).toBeGreaterThan(0);
  });
});
