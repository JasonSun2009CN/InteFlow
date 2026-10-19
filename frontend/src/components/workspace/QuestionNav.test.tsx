import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResultItem } from "../../api/client";
import QuestionNav, { type Filter } from "./QuestionNav";

function item(no: number, is_correct: boolean | null): ResultItem {
  return {
    question_id: no,
    no,
    source_no: null,
    sec: "rw",
    kind: "choice",
    multi: false,
    material: null,
    stem: `Stem ${no}`,
    options: ["A) one", "B) two", "C) three", "D) four"],
    images: [],
    source: null,
    chosen: null,
    chosen_answers: [],
    answer: null,
    answers: [],
    is_correct,
    explain: null,
  };
}

const items = [item(1, true), item(2, false), item(3, null)];
const counts: Record<Filter, number> = { all: 3, wrong: 1, correct: 1 };

function setup(overrides: Partial<Parameters<typeof QuestionNav>[0]> = {}) {
  const props = {
    items,
    visible: items,
    filter: "all" as Filter,
    counts,
    selectedId: null as number | null,
    open: false,
    onOpenChange: vi.fn(),
    onFilter: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  render(<QuestionNav {...props} />);
  return props;
}

describe("QuestionNav", () => {
  it("collapses to a pill that shows the current question", () => {
    setup({ selectedId: 2 });
    const toggle = screen.getByRole("button", { name: /questions/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.queryByTestId("question-nav-panel")).not.toBeInTheDocument();
  });

  it("requests to open when the pill is clicked", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /questions/i }));
    expect(props.onOpenChange).toHaveBeenCalledWith(true);
  });

  it("renders the panel when open", () => {
    setup({ open: true });
    expect(screen.getByTestId("question-nav-panel")).toBeInTheDocument();
    expect(screen.getByText("Jump to question")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All/ })).toHaveAttribute("aria-selected", "true");
  });

  it("reports the filter choice", () => {
    const props = setup({ open: true });
    fireEvent.click(screen.getByRole("tab", { name: /Wrong/ }));
    expect(props.onFilter).toHaveBeenCalledWith("wrong");
  });

  it("selects a question and closes the overlay", () => {
    const props = setup({ open: true });
    fireEvent.click(screen.getByRole("button", { name: /Question 2/ }));
    expect(props.onSelect).toHaveBeenCalledWith(2);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on Escape", () => {
    const props = setup({ open: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a friendly empty state for the wrong filter", () => {
    setup({
      open: true,
      filter: "wrong",
      visible: [],
      counts: { all: 3, wrong: 0, correct: 3 },
    });
    expect(screen.getByText(/Nothing wrong here/)).toBeInTheDocument();
  });
});
