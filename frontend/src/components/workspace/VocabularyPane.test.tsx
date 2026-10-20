import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ResultItem, type WordGrid } from "../../api/client";
import VocabularyPane, { WORD_MIME } from "./VocabularyPane";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getWords: vi.fn(),
      putWords: vi.fn(),
      addWordEntry: vi.fn(),
      addWordFromSelection: vi.fn(),
    },
  };
});

const getWords = vi.mocked(api.getWords);
const putWords = vi.mocked(api.putWords);
const addWordEntry = vi.mocked(api.addWordEntry);
const addWordFromSelection = vi.mocked(api.addWordFromSelection);

const item: ResultItem = {
  question_id: 5,
  no: 3,
  source_no: null,
  sec: "rw",
  kind: "choice",
  multi: false,
  material: "The victory served to elate the researchers.",
  stem: "Which choice best completes the text?",
  options: ["A) elate", "B) abate", "C) allay", "D) dull"],
  images: [],
  source: null,
  chosen: "A",
  chosen_answers: ["A"],
  answer: "A",
  answers: ["A"],
  is_correct: true,
  explain: null,
};

function gridWith(row?: { word: string; meaning: string }): WordGrid {
  return {
    version: 2,
    columns: [
      { id: "c1", name: "Word", width: 180 },
      { id: "c2", name: "Meaning", width: 260 },
      { id: "c3", name: "Notes", width: 220 },
    ],
    rows: row
      ? [{ id: "r1", cells: { c1: row.word, c2: row.meaning, c3: "" } }]
      : [],
    view: { sort: null, filter: {} },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getWords.mockResolvedValue(gridWith());
  putWords.mockImplementation(async (_docId, grid) => grid);
});

describe("VocabularyPane", () => {
  it("drops a dragged word, sending the question context to the AI sense picker", async () => {
    addWordFromSelection.mockResolvedValue({
      grid: gridWith({ word: "elate", meaning: "to fill with joy or pride" }),
      row: { id: "r1", cells: { c1: "elate", c2: "to fill with joy or pride", c3: "" } },
      row_id: "r1",
      word: "elate",
      created: true,
      matched: true,
      used_ai: true,
      pos: "v.",
      definition: "to fill with joy or pride",
      warning: "",
    });

    render(<VocabularyPane docId={7} item={item} />);
    await screen.findByTestId("vocab-grid");
    const pane = screen.getByTestId("vocabulary-pane");

    fireEvent.drop(pane, {
      dataTransfer: {
        getData: (type: string) => (type === WORD_MIME ? "elate" : ""),
      },
    });

    await waitFor(() =>
      expect(addWordFromSelection).toHaveBeenCalledWith(7, {
        text: "elate",
        context: expect.stringContaining("The victory served to elate"),
        question_id: 5,
      }),
    );
    expect(await screen.findByText(/Added “elate” · v\./)).toBeInTheDocument();
    expect(screen.getByText(/to fill with joy or pride/)).toBeInTheDocument();
  });

  it("shows the AI fallback warning without blocking the drop", async () => {
    addWordFromSelection.mockResolvedValue({
      grid: gridWith({ word: "abate", meaning: "to make less" }),
      row: { id: "r1", cells: { c1: "abate", c2: "to make less", c3: "" } },
      row_id: "r1",
      word: "abate",
      created: true,
      matched: true,
      used_ai: false,
      pos: "v.",
      definition: "to make less",
      warning: "AI is not configured; used the first Merriam-Webster sense.",
    });

    render(<VocabularyPane docId={7} item={item} />);
    await screen.findByTestId("vocab-grid");

    fireEvent.drop(screen.getByTestId("vocabulary-pane"), {
      dataTransfer: { getData: () => "abate" },
    });

    expect(
      await screen.findByText(/AI is not configured/),
    ).toBeInTheDocument();
  });

  it("adds a manually typed word", async () => {
    addWordEntry.mockResolvedValue({
      grid: gridWith({ word: "cadence", meaning: "" }),
      row: { id: "r1", cells: { c1: "cadence", c2: "", c3: "" } },
      row_id: "r1",
      word: "cadence",
      created: true,
    });

    render(<VocabularyPane docId={7} item={item} />);
    await screen.findByTestId("vocab-grid");

    fireEvent.change(screen.getByLabelText("Add a word manually"), {
      target: { value: "cadence" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addWordEntry).toHaveBeenCalledWith(7, { word: "cadence" }),
    );
    expect(await screen.findByText(/Added “cadence”/)).toBeInTheDocument();
  });

  it("saves unsaved grid edits before adding a manually typed word", async () => {
    addWordEntry.mockResolvedValue({
      grid: gridWith(),
      row: { id: "r2", cells: { c1: "lucid", c2: "", c3: "" } },
      row_id: "r2",
      word: "lucid",
      created: true,
    });

    render(<VocabularyPane docId={7} item={item} />);
    await screen.findByTestId("vocab-grid");

    fireEvent.click(screen.getByRole("button", { name: "+ Row" }));
    fireEvent.change(screen.getByLabelText("Word row 1"), {
      target: { value: "pending" },
    });
    expect(screen.getByText("unsaved")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Add a word manually"), {
      target: { value: "lucid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(addWordEntry).toHaveBeenCalled());
    expect(putWords).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        rows: [expect.objectContaining({ cells: expect.objectContaining({ c1: "pending" }) })],
      }),
    );
  });
});
