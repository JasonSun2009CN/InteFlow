import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type AppSettings,
  type VocabularyDocument,
  type WordExam,
  type WordExamResult,
} from "../../api/client";
import WordExamPanel from "./WordExamPanel";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getSettings: vi.fn(),
      startWordExam: vi.fn(),
      gradeWordExam: vi.fn(),
    },
  };
});

const getSettings = vi.mocked(api.getSettings);
const startWordExam = vi.mocked(api.startWordExam);
const gradeWordExam = vi.mocked(api.gradeWordExam);

const doc: VocabularyDocument = {
  document_id: 7,
  title: "October Review",
  created_at: "2026-10-19 09:15:00",
  updated_at: "2026-10-19 09:40:00",
  word_count: 2,
  preview: ["elate", "abate"],
  columns: [
    { id: "c1", name: "Word" },
    { id: "c2", name: "Meaning" },
  ],
  has_grid: true,
};

const settings: AppSettings = {
  provider: "orcarouter",
  protocol: "openai",
  base_url: "https://example.test/v1",
  model: "demo-model",
  api_key_masked: "",
  api_key_set: false,
  user_name: "",
  llm_fallback: true,
  vocab_ai_sense: true,
  vocab_auto_definition: true,
  vocab_learner_definitions: false,
  vocab_exam_ai_grading: false,
  custom_dictionary_enabled: true,
  analysis_template: "",
  show_builtin_library: false,
  dictionary_auto_lookup: true,
};

const exam: WordExam = {
  document_id: 7,
  title: "October Review",
  mode: "en-zh",
  total_words: 2,
  eligible_words: 2,
  requested_count: 2,
  count: 2,
  skipped: 0,
  scope: {
    tested: 2,
    eligible: 2,
    total: 2,
    skipped: 0,
    positions: [1, 2],
    all: true,
  },
  questions: [
    { row_id: "r1", position: 1, prompt: "elate", prompt_source: "word", pos: "v." },
    { row_id: "r2", position: 2, prompt: "abate", prompt_source: "word", pos: "v." },
  ],
  ai_grading: false,
  ai_available: false,
};

function makeResult(
  items: WordExamResult["items"],
): WordExamResult {
  const correct = items.filter((item) => item.is_correct).length;
  return {
    document_id: 7,
    title: "October Review",
    mode: "en-zh",
    total: items.length,
    correct,
    accuracy: Math.round((correct / items.length) * 1000) / 10,
    ai_requested: false,
    ai_available: false,
    ai_grading: false,
    warning: "",
    items,
  };
}

const result: WordExamResult = makeResult([
  {
    row_id: "r1",
    position: 1,
    word: "elate",
    prompt: "elate",
    expected: "to fill with joy",
    response: "to fill with joy",
    is_correct: true,
    method: "lenient",
    reason: "",
    pos: "v.",
  },
  {
    row_id: "r2",
    position: 2,
    word: "abate",
    prompt: "abate",
    expected: "to become less",
    response: "stronger",
    is_correct: false,
    method: "lenient",
    reason: "",
    pos: "v.",
  },
]);

function renderPanel() {
  return render(
    <MemoryRouter>
      <WordExamPanel doc={doc} onBack={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue(settings);
  startWordExam.mockResolvedValue(exam);
  gradeWordExam.mockResolvedValue(result);
});

describe("WordExamPanel", () => {
  it("configures a test and starts it", async () => {
    renderPanel();

    expect(await screen.findByText(/AI grading is off/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /English → Chinese/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Start test" }));

    await waitFor(() =>
      expect(startWordExam).toHaveBeenCalledWith(7, { mode: "en-zh", count: 2 }),
    );
    expect(await screen.findByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("elate")).toBeInTheDocument();
  });

  it("answers every question, grades, and shows the result + QR", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Start test" }));
    await screen.findByText("Question 1 of 2");

    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "to fill with joy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Question 2 of 2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "stronger" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit test" }));

    await waitFor(() =>
      expect(gradeWordExam).toHaveBeenCalledWith(7, {
        mode: "en-zh",
        items: [
          { row_id: "r1", response: "to fill with joy" },
          { row_id: "r2", response: "stronger" },
        ],
      }),
    );
    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByText("1 / 2 correct")).toBeInTheDocument();
    expect(screen.getAllByTestId("word-exam-qr")).toHaveLength(1);
    expect(screen.getAllByText(/Correct answer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Your answer/).length).toBeGreaterThan(0);
  });

  it("splits a large result across several QR codes", async () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      row_id: `r${index + 1}`,
      position: index + 1,
      word: `word${index + 1}`,
      prompt: `word${index + 1}`,
      expected: `definition ${index + 1}`,
      response: index % 2 === 0 ? `definition ${index + 1}` : "wrong",
      is_correct: index % 2 === 0,
      method: "lenient" as const,
      reason: "",
      pos: "",
    }));
    const large: WordExamResult = {
      ...makeResult(items),
      total: 40,
    };
    startWordExam.mockResolvedValue({
      ...exam,
      count: 40,
      questions: items.map((item) => ({
        row_id: item.row_id,
        position: item.position,
        prompt: item.prompt,
        prompt_source: "word" as const,
        pos: "",
      })),
    });
    gradeWordExam.mockResolvedValue(large);

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Start test" }));
    await screen.findByText("Question 1 of 40");
    // Jump to the last question and submit without filling every answer.
    fireEvent.click(screen.getByRole("button", { name: "Question 40" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit now" }));

    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getAllByTestId("word-exam-qr").length).toBeGreaterThan(1);
    expect(screen.getByText(/scan them in order/)).toBeInTheDocument();
  });

  it("explains AI grading status from Settings", async () => {
    getSettings.mockResolvedValue({
      ...settings,
      vocab_exam_ai_grading: true,
      api_key_set: true,
    });
    renderPanel();
    expect(await screen.findByText(/AI grading is on/)).toBeInTheDocument();
  });

  it("stops with a friendly message when the list is empty", async () => {
    render(
      <MemoryRouter>
        <WordExamPanel doc={{ ...doc, word_count: 0 }} onBack={vi.fn()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("This list is empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start test" })).not.toBeInTheDocument();
  });
});
