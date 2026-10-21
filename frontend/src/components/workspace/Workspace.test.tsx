import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AppSettings, type ResultItem, type SessionDetail, type SubmitResult } from "../../api/client";
import Workspace from "./Workspace";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getAnalysis: vi.fn(),
      getWords: vi.fn(),
      getSettings: vi.fn(),
      listStarredIds: vi.fn(),
      starQuestion: vi.fn(),
      unstarQuestion: vi.fn(),
    },
  };
});

const getAnalysis = vi.mocked(api.getAnalysis);
const getWords = vi.mocked(api.getWords);
const getSettings = vi.mocked(api.getSettings);
const listStarredIds = vi.mocked(api.listStarredIds);
const starQuestion = vi.mocked(api.starQuestion);

function media(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

const emptyGrid = {
  version: 2,
  columns: [
    { id: "c1", name: "Word", width: 180 },
    { id: "c2", name: "Meaning", width: 260 },
    { id: "c3", name: "Notes", width: 220 },
  ],
  rows: [],
  view: { sort: null, filter: {} },
};

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
    subject: null,
    created_at: "2026-10-19 09:15:00",
  },
  questions: [],
};

const result: SubmitResult = { session_id: 11, total: 1, graded: 1, correct: 0, items: [item] };

describe("Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    media(false);
    getAnalysis.mockResolvedValue({ document_id: 7, title: "October Review", pages: [] });
    getWords.mockResolvedValue(emptyGrid);
    getSettings.mockResolvedValue({ analysis_template: "" } as AppSettings);
    listStarredIds.mockResolvedValue({ question_ids: [] });
    starQuestion.mockResolvedValue({ question_id: 5, starred: true });
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

  it("stars the selected question from the review workspace", async () => {
    render(
      <MemoryRouter>
        <Workspace detail={detail} result={result} t={0} sessionId={11} />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "☆ Star" }));

    expect(await screen.findByRole("button", { name: "★ Starred" })).toBeInTheDocument();
    expect(starQuestion).toHaveBeenCalledWith(5);
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

  it("defaults to question | analysis and switches either pane to another tool", async () => {
    media(true);
    render(
      <MemoryRouter>
        <Workspace detail={detail} result={result} t={0} sessionId={11} />
      </MemoryRouter>,
    );

    const left = screen.getByTestId("left-pane");
    const right = screen.getByTestId("right-pane");
    expect(left).toHaveAttribute("data-tool", "question");
    expect(right).toHaveAttribute("data-tool", "analysis");

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Switch right pane"), {
        target: { value: "ai" },
      });
    });
    expect(screen.getByTestId("right-pane")).toHaveAttribute("data-tool", "ai");
    expect(screen.getByTestId("left-pane")).toHaveAttribute("data-tool", "question");
  });

  it("swaps panes when a tool is chosen that is already on the other side", async () => {
    media(true);
    render(
      <MemoryRouter>
        <Workspace detail={detail} result={result} t={0} sessionId={11} />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Switch right pane"), {
        target: { value: "vocabulary" },
      });
    });
    expect(await screen.findByTestId("vocabulary-pane")).toBeInTheDocument();
    expect(screen.getByTestId("left-pane")).toHaveAttribute("data-tool", "question");
    expect(screen.getByTestId("right-pane")).toHaveAttribute("data-tool", "vocabulary");

    // Vocabulary now lives on the right; choosing it on the left must swap.
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Switch left pane"), {
        target: { value: "vocabulary" },
      });
    });
    await waitFor(() => expect(getWords).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("left-pane")).toHaveAttribute("data-tool", "vocabulary");
    expect(screen.getByTestId("right-pane")).toHaveAttribute("data-tool", "question");
  });

  it("opens the export drawer from the top bar", async () => {
    media(true);
    render(
      <MemoryRouter>
        <Workspace detail={detail} result={result} t={0} sessionId={11} />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Export" }));
    });
    expect(screen.getByRole("dialog", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByText("Export vocabulary .xlsx")).toBeInTheDocument();
  });
});
