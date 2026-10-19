import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, type ResultItem } from "../../api/client";
import AnalysisEditor from "./AnalysisEditor";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: { ...actual.api, saveAnalysisPage: vi.fn() },
  };
});

const saveAnalysisPage = vi.mocked(api.saveAnalysisPage);

function item(no: number, kind: "choice" | "blank" = "choice"): ResultItem {
  return {
    question_id: no,
    no,
    source_no: null,
    sec: "rw",
    kind,
    multi: false,
    material: null,
    stem: `Stem ${no}`,
    options: ["A) one", "B) two", "C) three", "D) four"],
    images: [],
    source: "Practice 1",
    chosen: null,
    chosen_answers: ["B"],
    answer: null,
    answers: ["A"],
    is_correct: false,
    explain: null,
  };
}

describe("AnalysisEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveAnalysisPage.mockResolvedValue(undefined as never);
  });

  it("prompts the user to pick a question when none is selected", () => {
    render(<AnalysisEditor docId={1} item={null} content="" onSaved={vi.fn()} />);
    expect(screen.getByText(/Pick a question/)).toBeInTheDocument();
  });

  it("shows the question, the correct answer and the user's pick", () => {
    render(<AnalysisEditor docId={1} item={item(3)} content="" onSaved={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Question 3" })).toBeInTheDocument();
    expect(screen.getByText("correct")).toBeInTheDocument();
    expect(screen.getByText("yours")).toBeInTheDocument();
  });

  it("autosaves the analysis after the debounce", async () => {
    const onSaved = vi.fn();
    vi.useFakeTimers();
    try {
      render(<AnalysisEditor docId={1} item={item(1)} content="" onSaved={onSaved} />);
      await act(async () => {
        fireEvent.change(screen.getByLabelText("Analysis"), {
          target: { value: "I misread the graph." },
        });
      });
      expect(saveAnalysisPage).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });

      expect(saveAnalysisPage).toHaveBeenCalledWith(1, 1, "I misread the graph.");
      expect(onSaved).toHaveBeenCalledWith(1, "I misread the graph.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves with ⌘S immediately", async () => {
    render(<AnalysisEditor docId={1} item={item(1)} content="" onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Analysis"), {
      target: { value: "note" },
    });
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    await waitFor(() => expect(saveAnalysisPage).toHaveBeenCalledWith(1, 1, "note"));
  });

  it("surfaces a save error", async () => {
    saveAnalysisPage.mockRejectedValueOnce(new ApiError("boom", 500));
    render(<AnalysisEditor docId={1} item={item(1)} content="" onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Analysis"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("adopts the saved page when the notebook loads after mount", () => {
    const { rerender } = render(
      <AnalysisEditor docId={1} item={item(1)} content="" onSaved={vi.fn()} />,
    );
    expect(screen.getByLabelText("Analysis")).toHaveValue("");

    rerender(<AnalysisEditor docId={1} item={item(1)} content="loaded page" onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Analysis")).toHaveValue("loaded page");
  });

  it("never clobbers a draft with a late-arriving notebook page", () => {
    const { rerender } = render(
      <AnalysisEditor docId={1} item={item(1)} content="" onSaved={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Analysis"), { target: { value: "my draft" } });

    rerender(<AnalysisEditor docId={1} item={item(1)} content="server page" onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Analysis")).toHaveValue("my draft");
  });

  it("flushes unsaved typing when the question changes", async () => {
    const { rerender } = render(
      <AnalysisEditor docId={1} item={item(1)} content="" onSaved={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Analysis"), { target: { value: "last keystrokes" } });

    rerender(<AnalysisEditor docId={1} item={item(2)} content="" onSaved={vi.fn()} />);

    await waitFor(() =>
      expect(saveAnalysisPage).toHaveBeenCalledWith(1, 1, "last keystrokes"),
    );
  });

  it("resets the draft when the question changes", () => {
    const { rerender } = render(
      <AnalysisEditor docId={1} item={item(1)} content="page one" onSaved={vi.fn()} />,
    );
    expect(screen.getByLabelText("Analysis")).toHaveValue("page one");
    rerender(<AnalysisEditor docId={1} item={item(2)} content="page two" onSaved={vi.fn()} />);
    expect(screen.getByLabelText("Analysis")).toHaveValue("page two");
  });

  it("renders a blank question with correct/yours values", () => {
    render(
      <AnalysisEditor
        docId={1}
        item={{ ...item(4, "blank"), chosen_answers: ["teh"], answers: ["the", "a"] }}
        content=""
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("the | a")).toBeInTheDocument();
    expect(screen.getByText("teh")).toBeInTheDocument();
  });
});
