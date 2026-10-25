import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type AppSettings,
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
      getSettings: vi.fn(),
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
const getSettings = vi.mocked(api.getSettings);

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
  learner_count: 1200,
  learner_enabled: false,
  custom_dictionary: { enabled: true, count: 0 },
  built_at: "2026-10-19T10:00:00+00:00",
  title: "Merriam-Webster's Collegiate Dictionary",
  author: "Merriam-Webster",
  building: false,
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
  getSettings.mockResolvedValue(settings);
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
          learner_definition: null,
          snippet: "v. Function: verb : to fill with joy or pride",
          source: "standard",
        },
      ],
      matches: [],
      entry_count: 92006,
      source: "standard",
      learner_enabled: false,
      custom_dictionary: { enabled: true, count: 0 },
      warning: "",
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

  it("uses the in-entry Definition for English Learners section", async () => {
    dictionaryStatus.mockResolvedValue({ ...status, learner_enabled: true });
    dictionaryLookup.mockResolvedValue({
      query: "abate",
      exact: [
        {
          id: 77,
          headword: "abate",
          definition: "v.\nFunction: verb\n: to make less in amount",
          learner_definition: "to become weaker : decrease",
          snippet: "v. Function: verb : to make less in amount",
          source: "standard",
        },
      ],
      matches: [],
      entry_count: 50000,
      source: "standard",
      learner_enabled: true,
      custom_dictionary: { enabled: true, count: 0 },
      warning: "",
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
      definition: "to become weaker : decrease",
      source: "standard",
      learner: true,
    });
    renderPage();
    await screen.findByTestId("vocab-grid");

    fireEvent.change(screen.getByLabelText("Look up a word"), {
      target: { value: "abate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));

    expect(
      await screen.findByText("Definition for English Learners"),
    ).toBeInTheDocument();
    expect(screen.getByText("to become weaker : decrease")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addWordFromEntry).toHaveBeenCalledWith(7, {
        entry_id: 77,
        source: "standard",
      }),
    );
  });

  it("shows and adds entries from my dictionary", async () => {
    dictionaryLookup.mockResolvedValue({
      query: "zzword",
      exact: [
        {
          id: 3,
          headword: "zzword",
          definition: "my own definition",
          learner_definition: null,
          snippet: "my own definition",
          source: "custom",
        },
      ],
      matches: [],
      entry_count: 92006,
      source: "standard",
      learner_enabled: false,
      custom_dictionary: { enabled: true, count: 1 },
      warning: "",
    });
    addWordFromEntry.mockResolvedValue({
      grid,
      row: grid.rows[0],
      row_id: "r1",
      word: "zzword",
      created: true,
      matched: true,
      used_ai: false,
      pos: "",
      definition: "my own definition",
      source: "custom",
    });
    renderPage();
    await screen.findByTestId("vocab-grid");

    fireEvent.change(screen.getByLabelText("Look up a word"), {
      target: { value: "zzword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));

    expect(await screen.findByText("My dictionary")).toBeInTheDocument();
    expect(screen.getByText("my own definition")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(addWordFromEntry).toHaveBeenCalledWith(7, {
        entry_id: 3,
        source: "custom",
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

  it("switches from the word list to the word test", async () => {
    renderPage();
    await screen.findByTestId("vocab-grid");

    fireEvent.click(screen.getByRole("tab", { name: "Word test" }));

    expect(
      await screen.findByRole("heading", { name: "Word test" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start test" })).toBeInTheDocument();
    expect(getSettings).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Word list" }));
    expect(screen.getByTestId("vocab-grid")).toBeInTheDocument();
  });
});
