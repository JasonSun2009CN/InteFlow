import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type DictionaryStatus,
  type VocabularyOverview,
  type WordGrid,
} from "../api/client";
import VocabularyPage from "./VocabularyPage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getVocabulary: vi.fn(),
      getWords: vi.fn(),
      putWords: vi.fn(),
      addWordEntry: vi.fn(),
      addWordFromEntry: vi.fn(),
      dictionaryStatus: vi.fn(),
      dictionaryLookup: vi.fn(),
    },
  };
});

const getVocabulary = vi.mocked(api.getVocabulary);
const getWords = vi.mocked(api.getWords);
const putWords = vi.mocked(api.putWords);
const addWordEntry = vi.mocked(api.addWordEntry);
const addWordFromEntry = vi.mocked(api.addWordFromEntry);
const dictionaryStatus = vi.mocked(api.dictionaryStatus);
const dictionaryLookup = vi.mocked(api.dictionaryLookup);

const overview: VocabularyOverview = {
  documents: [
    {
      document_id: 7,
      title: "October Review",
      created_at: "2026-10-19 09:15:00",
      updated_at: "2026-10-19 09:40:00",
      word_count: 1,
      preview: ["elate"],
      columns: [
        { id: "c1", name: "Word" },
        { id: "c2", name: "Meaning" },
      ],
      has_grid: true,
    },
    {
      document_id: 8,
      title: "September Practice",
      created_at: "2026-09-08 14:00:00",
      updated_at: "2026-09-08 14:30:00",
      word_count: 0,
      preview: [],
      columns: [],
      has_grid: false,
    },
  ],
  total_documents: 2,
  total_words: 1,
};

const grid: WordGrid = {
  version: 2,
  columns: [
    { id: "c1", name: "Word", width: 180 },
    { id: "c2", name: "Meaning", width: 260 },
    { id: "c3", name: "Notes", width: 220 },
  ],
  rows: [{ id: "r1", cells: { c1: "elate", c2: "to fill with joy", c3: "" } }],
  view: { sort: null, filter: {} },
};

const status: DictionaryStatus = {
  kind: "standard",
  available: true,
  indexed: true,
  stale: false,
  source: "/dictionary/mw.eudb",
  source_name: "mw.eudb",
  index_path: "/data/dictionary/mw.db",
  entry_count: 92006,
  built_at: "2026-10-19T10:00:00+00:00",
  title: "Merriam-Webster's Collegiate Dictionary",
  author: "Merriam-Webster",
  building: false,
  learner_enabled: false,
  learner: {
    kind: "learner",
    available: false,
    indexed: false,
    stale: true,
    source: null,
    source_name: null,
    index_path: "/data/dictionary/learners.db",
    entry_count: 0,
    built_at: null,
    title: null,
    author: null,
    building: false,
  },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <VocabularyPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getVocabulary.mockResolvedValue(overview);
  getWords.mockResolvedValue(grid);
  putWords.mockImplementation(async (_docId, next) => next);
  dictionaryStatus.mockResolvedValue(status);
});

describe("VocabularyPage", () => {
  it("indexes exams on the left and opens the default list on the right", async () => {
    renderPage();

    expect(await screen.findAllByText("October Review")).not.toHaveLength(0);
    expect(screen.getByText("September Practice")).toBeInTheDocument();
    expect(await screen.findByTestId("vocab-grid")).toBeInTheDocument();
    expect(screen.getByDisplayValue("elate")).toBeInTheDocument();
    expect(getWords).toHaveBeenCalledWith(7);
    expect(screen.getByText(/92,006 entries/)).toBeInTheDocument();
  });

  it("switches exams from the index", async () => {
    getWords.mockImplementation(async (docId) =>
      docId === 8 ? { ...grid, rows: [] } : grid,
    );
    renderPage();
    await screen.findByTestId("vocab-grid");

    fireEvent.click(screen.getByRole("button", { name: /September Practice/ }));

    await waitFor(() => expect(getWords).toHaveBeenCalledWith(8));
    expect(screen.getByRole("heading", { name: "September Practice" })).toBeInTheDocument();
  });

  it("adds a word manually with POS and meaning", async () => {
    addWordEntry.mockResolvedValue({
      grid,
      row: grid.rows[0],
      row_id: "r1",
      word: "lucid",
      created: true,
    });
    renderPage();
    await screen.findByTestId("vocab-grid");

    fireEvent.change(screen.getByLabelText("Word"), { target: { value: "lucid" } });
    fireEvent.change(screen.getByLabelText("Part of speech"), { target: { value: "adj." } });
    fireEvent.change(screen.getByLabelText("Meaning"), { target: { value: "clear" } });
    fireEvent.click(screen.getByRole("button", { name: "Add word" }));

    await waitFor(() =>
      expect(addWordEntry).toHaveBeenCalledWith(7, {
        word: "lucid",
        pos: "adj.",
        meaning: "clear",
        notes: "",
      }),
    );
    expect(await screen.findByText(/Added “lucid”/)).toBeInTheDocument();
  });

  it("looks a word up in the local dictionary and adds the chosen sense", async () => {
    dictionaryLookup.mockResolvedValue({
      query: "elate",
      exact: [
        {
          id: 12,
          headword: "elate",
          definition: "v.\nFunction: verb\n: to fill with joy or pride",
          snippet: "v. Function: verb : to fill with joy or pride",
        },
      ],
      matches: [],
      entry_count: 92006,
      source: "standard",
      learner: false,
      fallback: "",
    });
    addWordFromEntry.mockResolvedValue({
      grid,
      row: grid.rows[0],
      row_id: "r1",
      word: "elate",
      created: false,
      matched: true,
      used_ai: false,
      pos: "v.",
      definition: "to fill with joy or pride",
    });
    renderPage();
    await screen.findByTestId("vocab-grid");

    fireEvent.change(screen.getByLabelText("Look up a word"), {
      target: { value: "elate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));

    expect(await screen.findByText(/to fill with joy or pride/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addWordFromEntry).toHaveBeenCalledWith(7, {
        entry_id: 12,
        source: "standard",
      }),
    );
  });

  it("uses the learner source from a lookup when adding", async () => {
    dictionaryLookup.mockResolvedValue({
      query: "abate",
      exact: [
        {
          id: 77,
          headword: "abate",
          definition: "v.\nFunction: verb\n: to become weaker",
          snippet: "v. Function: verb : to become weaker",
        },
      ],
      matches: [],
      entry_count: 50000,
      source: "learner",
      learner: true,
      fallback: "",
    });
    addWordFromEntry.mockResolvedValue({
      grid,
      row: grid.rows[0],
      row_id: "r1",
      word: "abate",
      created: true,
      matched: true,
      used_ai: false,
      pos: "v.",
      definition: "to become weaker",
      source: "learner",
    });
    renderPage();
    await screen.findByTestId("vocab-grid");

    fireEvent.change(screen.getByLabelText("Look up a word"), {
      target: { value: "abate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));

    expect(await screen.findByText("Learner's definition")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addWordFromEntry).toHaveBeenCalledWith(7, {
        entry_id: 77,
        source: "learner",
      }),
    );
  });

  it("explains how to install the dictionary when it is missing", async () => {
    dictionaryStatus.mockResolvedValue({
      ...status,
      available: false,
      indexed: false,
      entry_count: 0,
    });
    renderPage();
    await screen.findByTestId("vocab-grid");

    expect(screen.getByText(/Merriam-Webster is not installed/)).toBeInTheDocument();
    expect(screen.getByText("dictionary/")).toBeInTheDocument();
  });
});
