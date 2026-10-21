import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AppSettings, type ReviewItem } from "../api/client";
import MistakesPage from "./MistakesPage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listMistakes: vi.fn(),
      listStarredQuestions: vi.fn(),
      getSettings: vi.fn(),
      starQuestion: vi.fn(),
      unstarQuestion: vi.fn(),
      saveAnalysisPage: vi.fn(),
    },
  };
});

const listMistakes = vi.mocked(api.listMistakes);
const listStarredQuestions = vi.mocked(api.listStarredQuestions);
const starQuestion = vi.mocked(api.starQuestion);
const unstarQuestion = vi.mocked(api.unstarQuestion);

function reviewItem(partial: Partial<ReviewItem> = {}): ReviewItem {
  return {
    question_id: 1,
    document_id: 7,
    document_title: "October Review",
    subject: { id: 2, name: "SAT Math", color: "emerald" },
    no: 1,
    source_no: 1,
    sec: "math",
    kind: "choice",
    multi: false,
    material: null,
    stem: "What is 2 + 2?",
    options: ["A) 3", "B) 4", "C) 5", "D) 6"],
    images: [],
    source: null,
    chosen: "A",
    chosen_answers: ["A"],
    answer: "B",
    answers: ["B"],
    is_correct: false,
    session_id: 11,
    answered_at: "2026-10-20 10:00:00",
    finished_at: "2026-10-20 10:05:00",
    starred: false,
    starred_at: null,
    explain: null,
    analysis: "Contrast words turn at *but*.",
    analyses: [
      {
        source: "page",
        content: "Contrast words turn at *but*.",
        updated_at: "2026-10-20 10:06:00",
      },
    ],
    ...partial,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MistakesPage />
    </MemoryRouter>,
  );
}

describe("MistakesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMistakes.mockResolvedValue([reviewItem()]);
    listStarredQuestions.mockResolvedValue([]);
    vi.mocked(api.getSettings).mockResolvedValue({ analysis_template: "" } as AppSettings);
    starQuestion.mockResolvedValue({ question_id: 1, starred: true });
    unstarQuestion.mockResolvedValue({ question_id: 1, starred: false });
    vi.mocked(api.saveAnalysisPage).mockResolvedValue({
      id: 1,
      document_id: 7,
      question_id: 1,
      position: 0,
      content: "",
      created_at: null,
      updated_at: null,
    });
  });

  it("lists mistakes with the question, answers and analysis", async () => {
    renderPage();

    expect((await screen.findAllByText("Question 1")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Correct: B/)).toBeInTheDocument();
    expect(screen.getByText(/Yours: A/)).toBeInTheDocument();
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(await screen.findByLabelText("Analysis")).toHaveValue(
      "Contrast words turn at *but*.",
    );
    expect(screen.getByRole("link", { name: "Open attempt" })).toHaveAttribute(
      "href",
      "/session/11/result",
    );
  });

  it("searches papers, stems and options and stars a mistake", async () => {
    listMistakes.mockResolvedValue([
      reviewItem(),
      reviewItem({
        question_id: 2,
        no: 2,
        stem: "A geometry question",
        options: ["A) circle", "B) triangle"],
      }),
    ]);
    renderPage();
    await screen.findByText("A geometry question");

    fireEvent.change(screen.getByLabelText("Search review sets"), {
      target: { value: "geometry" },
    });
    await waitFor(() =>
      expect(screen.queryByText("What is 2 + 2?")).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText("A geometry question").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Search review sets"), {
      target: { value: "" },
    });
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Star question 1" }))[0],
    );

    await waitFor(() => expect(starQuestion).toHaveBeenCalledWith(1));
    expect(
      (await screen.findAllByRole("button", { name: "Unstar question 1" })).length,
    ).toBeGreaterThan(0);
  });

  it("loads and unstars items from the starred tab", async () => {
    listStarredQuestions.mockResolvedValue([
      reviewItem({
        question_id: 3,
        no: 4,
        starred: true,
        starred_at: "2026-10-20 11:00:00",
        is_correct: null,
        session_id: null,
        chosen: null,
        chosen_answers: [],
      }),
    ]);
    renderPage();
    await screen.findAllByText("Question 1");

    fireEvent.click(screen.getByRole("tab", { name: /Starred/ }));
    expect(await screen.findByText("Question 4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unstar question 4" }));
    await waitFor(() => expect(unstarQuestion).toHaveBeenCalledWith(3));
  });

  it("shows extra saved analyses alongside the editable one", async () => {
    listMistakes.mockResolvedValue([
      reviewItem({
        analyses: [
          { source: "page", content: "Current analysis.", updated_at: null },
          { source: "legacy", content: "Earlier legacy note.", updated_at: null },
        ],
        analysis: "Current analysis.",
      }),
    ]);
    renderPage();

    expect(await screen.findByText("Earlier analyses")).toBeInTheDocument();
    expect(screen.getByText("Earlier legacy note.")).toBeInTheDocument();
    expect(screen.getByLabelText("Analysis")).toHaveValue("Current analysis.");
  });
});
