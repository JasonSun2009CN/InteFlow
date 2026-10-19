import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DocumentSummary, type Question } from "../api/client";
import AnswerKeyPage, { parseBulk } from "./AnswerKeyPage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getDocument: vi.fn(),
      getQuestions: vi.fn(),
      putAnswers: vi.fn(),
    },
  };
});

const getDocument = vi.mocked(api.getDocument);
const getQuestions = vi.mocked(api.getQuestions);
const putAnswers = vi.mocked(api.putAnswers);

const doc: DocumentSummary = {
  id: 7,
  title: "October Review",
  source_filename: "october.pdf",
  answers_status: "none",
  question_count: 3,
  answered_count: 0,
  needs_answers: true,
  created_at: "2026-10-19 09:15:00",
};

function question(partial: Partial<Question> & Pick<Question, "ext_id" | "no" | "stem">): Question {
  return {
    id: partial.no ?? 0,
    sec: "rw",
    type: null,
    difficulty: null,
    material: null,
    options: ["A) one", "B) two", "C) three", "D) four"],
    kind: "choice",
    multi: false,
    images: [],
    source: null,
    explain: null,
    answer: null,
    answers: [],
    ...partial,
  };
}

const questions: Question[] = [
  question({ ext_id: "q1", no: 1, stem: "One" }),
  question({ ext_id: "q2", no: 2, stem: "Two", multi: true }),
  question({ ext_id: "q3", no: 3, stem: "Three", kind: "blank", options: [] }),
];

function rowFor(stem: string): HTMLElement {
  // The Preview section repeats the first stem, so take the first match.
  return screen.getAllByText(stem)[0].closest("div") as HTMLElement;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/doc/7/answers"]}>
      <Routes>
        <Route path="/doc/:id/answers" element={<AnswerKeyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("parseBulk", () => {
  it("parses numbered single answers", () => {
    expect(parseBulk("1-A 2-C 3-D")).toEqual({ 1: ["A"], 2: ["C"], 3: ["D"] });
  });

  it("parses dotted and bare-letter forms", () => {
    expect(parseBulk("1. A\n2. B")).toEqual({ 1: ["A"], 2: ["B"] });
    expect(parseBulk("ACBD")).toEqual({ 1: ["A"], 2: ["C"], 3: ["B"], 4: ["D"] });
  });

  it("accepts letters past D (AMC prints five)", () => {
    expect(parseBulk("1-E 2-E")).toEqual({ 1: ["E"], 2: ["E"] });
  });

  it("keeps multiple letters for a multi question and sorts them", () => {
    expect(parseBulk("3-CA")).toEqual({ 3: ["A", "C"] });
  });
});

describe("AnswerKeyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocument.mockResolvedValue(doc);
    getQuestions.mockResolvedValue(questions);
  });

  it("renders choice toggles, a multi badge and blank inputs", async () => {
    renderPage();
    expect(await screen.findByText("October Review")).toBeInTheDocument();
    expect(screen.getByText("multi")).toBeInTheDocument();
    expect(screen.getByLabelText("Accepted answer 1 for question 3")).toBeInTheDocument();
  });

  it("lets a multi question hold several answers", async () => {
    renderPage();
    await screen.findByText("October Review");

    const row = rowFor("Two");
    fireEvent.click(within(row).getByRole("button", { name: "A" }));
    fireEvent.click(within(row).getByRole("button", { name: "C" }));

    expect(within(row).getByRole("button", { name: "A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(row).getByRole("button", { name: "C" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps a single-choice question to one answer", async () => {
    renderPage();
    await screen.findByText("October Review");

    const row = rowFor("One");
    fireEvent.click(within(row).getByRole("button", { name: "A" }));
    fireEvent.click(within(row).getByRole("button", { name: "B" }));

    expect(within(row).getByRole("button", { name: "A" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(row).getByRole("button", { name: "B" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("adds another acceptable blank answer", async () => {
    renderPage();
    await screen.findByText("October Review");

    fireEvent.click(screen.getByRole("button", { name: /Add acceptable answer/ }));
    expect(screen.getByLabelText("Accepted answer 2 for question 3")).toBeInTheDocument();
  });

  it("offers a fifth option letter for AMC-style questions", async () => {
    getQuestions.mockResolvedValue([
      question({
        ext_id: "amc",
        no: 1,
        stem: "Five options",
        options: ["A) 3", "B) 4", "C) 5", "D) 6", "E) 7"],
      }),
    ]);
    renderPage();
    await screen.findByText("October Review");

    const row = rowFor("Five options");
    expect(within(row).getByRole("button", { name: "E" })).toBeInTheDocument();
  });

  it("applies bulk answers and saves them", async () => {
    putAnswers.mockResolvedValue({ ...doc, answered_count: 2 });
    renderPage();
    await screen.findByText("October Review");

    fireEvent.change(screen.getByPlaceholderText("1-A 2-C 3-D 4-A 5-B"), {
      target: { value: "1-A 2-C" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply to grid" }));
    expect(screen.getByText(/Parsed 2 answer/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Save answers" })[0]);
    await waitFor(() => expect(putAnswers).toHaveBeenCalledWith(7, { q1: ["A"], q2: ["C"] }));
  });
});
