import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ResultItem, type SessionDetail, type SubmitResult } from "../../api/client";
import Workspace from "./Workspace";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: { ...actual.api, getAnalysis: vi.fn() },
  };
});

const getAnalysis = vi.mocked(api.getAnalysis);

const item: ResultItem = {
  question_id: 5,
  no: 1,
  source_no: null,
  sec: "rw",
  kind: "choice",
  multi: false,
  material: null,
  stem: "Stem",
  options: ["A) one", "B) two", "C) three", "D) four"],
  images: [],
  source: null,
  chosen: "A",
  chosen_answers: ["A"],
  answer: "B",
  answers: ["B"],
  is_correct: false,
  explain: null,
};

const detail: SessionDetail = {
  id: 11,
  document_id: 7,
  started_at: "2026-10-19 09:15:00",
  finished_at: "2026-10-19 09:40:00",
  document: {
    id: 7,
    title: "October Review",
    source_filename: "october.pdf",
    answers_status: "external",
    question_count: 1,
    answered_count: 1,
    needs_answers: false,
    created_at: "2026-10-19 09:15:00",
  },
  questions: [],
};

const result: SubmitResult = { session_id: 11, total: 1, graded: 1, correct: 0, items: [item] };

describe("Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnalysis.mockResolvedValue({ document_id: 7, title: "October Review", pages: [] });
  });

  it("opens the full notebook preview from the top bar", async () => {
    getAnalysis.mockResolvedValue({
      document_id: 7,
      title: "October Review",
      pages: [
        {
          id: 1,
          document_id: 7,
          question_id: 5,
          position: 0,
          content: "My saved analysis.",
          created_at: null,
          updated_at: null,
        },
      ],
    });

    render(
      <MemoryRouter>
        <Workspace detail={detail} result={result} t={0} sessionId={11} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Notebook" }));

    expect(screen.getByRole("dialog", { name: "Analysis notebook" })).toBeInTheDocument();
    expect(await screen.findByText("My saved analysis.")).toBeInTheDocument();
  });

  it("offers a Back link to the sessions list, not the exam picker", async () => {
    render(
      <MemoryRouter>
        <Workspace detail={detail} result={result} t={0} sessionId={11} />
      </MemoryRouter>,
    );

    const back = await screen.findByRole("link", { name: "Back" });
    expect(back).toHaveAttribute("href", "/sessions");
    expect(screen.queryByRole("link", { name: "Exams" })).not.toBeInTheDocument();
  });
});
