import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, type AppSettings, type ResultItem } from "../../api/client";
import AnalysisEditor from "./AnalysisEditor";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getSettings: vi.fn(),
      saveAnalysisPage: vi.fn(),
    },
  };
});

const getSettings = vi.mocked(api.getSettings);
const saveAnalysisPage = vi.mocked(api.saveAnalysisPage);

const settings: AppSettings = {
  provider: "orcarouter",
  protocol: "openai",
  base_url: "https://example.test/v1",
  model: "demo-model",
  api_key_masked: "",
  api_key_set: false,
  user_name: "",
  analysis_template: "",
  llm_fallback: true,
  vocab_ai_sense: true,
  vocab_learner_definitions: false,
  vocab_exam_ai_grading: false,
  custom_dictionary_enabled: true,
};

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
    getSettings.mockResolvedValue(settings);
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

  it("adopts the saved page when the notebook loads after mount", async () => {
    const { rerender } = render(
      <AnalysisEditor docId={1} item={item(1)} content="" onSaved={vi.fn()} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
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

  it("resets the draft when the question changes", async () => {
    const { rerender } = render(
      <AnalysisEditor docId={1} item={item(1)} content="page one" onSaved={vi.fn()} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
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

  it("pre-fills an empty page with the template but only saves after an edit", async () => {
    getSettings.mockResolvedValue({
      ...settings,
      analysis_template: "**Why the key works**\n\n**Takeaway**\n",
    });
    vi.useFakeTimers();
    try {
      render(<AnalysisEditor docId={1} item={item(1)} content="" onSaved={vi.fn()} />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const editor = screen.getByLabelText("Analysis");
      expect(editor).toHaveValue("**Why the key works**\n\n**Takeaway**\n");
      expect(screen.getByText("template")).toBeInTheDocument();

      // Pristine template: the autosave debounce must not persist it.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(saveAnalysisPage).not.toHaveBeenCalled();

      fireEvent.change(editor, { target: { value: "template plus my note" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(900);
      });
      expect(saveAnalysisPage).toHaveBeenCalledWith(1, 1, "template plus my note");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never overwrites an existing analysis with the template", async () => {
    getSettings.mockResolvedValue({ ...settings, analysis_template: "template body" });
    render(
      <AnalysisEditor docId={1} item={item(1)} content="My saved analysis." onSaved={vi.fn()} />,
    );
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Analysis")).toHaveValue("My saved analysis.");
  });

  it("waits for the notebook before filling the template", async () => {
    getSettings.mockResolvedValue({ ...settings, analysis_template: "template body" });
    const { rerender } = render(
      <AnalysisEditor docId={1} item={item(1)} content="" onSaved={vi.fn()} loaded={false} />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Analysis")).toHaveValue("");

    rerender(
      <AnalysisEditor docId={1} item={item(1)} content="Loaded page." onSaved={vi.fn()} />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Analysis")).toHaveValue("Loaded page."),
    );
  });
});
