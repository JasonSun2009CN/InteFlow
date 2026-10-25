import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AppSettings, type DictionaryStatus } from "../../api/client";
import DictionaryPane from "./DictionaryPane";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getSettings: vi.fn(),
      dictionaryStatus: vi.fn(),
      dictionaryLookup: vi.fn(),
      addCustomDictionaryEntry: vi.fn(),
    },
  };
});

const getSettings = vi.mocked(api.getSettings);
const dictionaryStatus = vi.mocked(api.dictionaryStatus);
const dictionaryLookup = vi.mocked(api.dictionaryLookup);
const addCustomDictionaryEntry = vi.mocked(api.addCustomDictionaryEntry);

const settings: AppSettings = {
  provider: "orcarouter",
  protocol: "openai",
  base_url: "",
  model: "",
  api_key_masked: "",
  api_key_set: false,
  user_name: "",
  analysis_template: "",
  llm_fallback: true,
  vocab_ai_sense: true,
  vocab_auto_definition: true,
  vocab_learner_definitions: false,
  vocab_exam_ai_grading: false,
  custom_dictionary_enabled: true,
  show_builtin_library: false,
  dictionary_auto_lookup: true,
};

const status: DictionaryStatus = {
  kind: "standard",
  available: true,
  indexed: true,
  stale: false,
  source: "eudb",
  source_name: "mw.eudb",
  index_path: "/tmp/mw.db",
  entry_count: 92006,
  learner_count: 0,
  learner_enabled: false,
  custom_dictionary: { enabled: true, count: 2 },
  built_at: null,
  title: "Merriam-Webster",
  author: null,
  building: false,
};

const lookup = {
  query: "fern",
  exact: [
    {
      id: 1,
      headword: "fern",
      definition: "a flowerless plant with feathery fronds",
      learner_definition: null,
      snippet: "fern",
      pos: "noun",
      source: "standard" as const,
    },
  ],
  matches: [
    {
      id: 2,
      headword: "fernery",
      definition: null,
      learner_definition: null,
      snippet: "a place where ferns grow",
      source: "standard" as const,
    },
  ],
  entry_count: 92006,
  source: "standard" as const,
  learner_enabled: false,
  custom_dictionary: { enabled: true, count: 2 },
  warning: "",
};

describe("DictionaryPane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue(settings);
    dictionaryStatus.mockResolvedValue(status);
    dictionaryLookup.mockResolvedValue(lookup);
    addCustomDictionaryEntry.mockResolvedValue({
      id: 9,
      word: "fern",
      pos: "noun",
      definition: "my own definition",
      created_at: "",
      updated_at: "",
      count: 3,
    });
  });

  it("looks a word up automatically and shows the full entry", async () => {
    render(<DictionaryPane />);
    await screen.findByText(/92,006 entries/);

    fireEvent.change(screen.getByPlaceholderText("Look up a word…"), {
      target: { value: "fern" },
    });

    await waitFor(() => expect(dictionaryLookup).toHaveBeenCalledWith("fern"), {
      timeout: 1500,
    });
    expect(await screen.findByText("a flowerless plant with feathery fronds")).toBeInTheDocument();
    expect(screen.getByText("fernery")).toBeInTheDocument();
  });

  it("waits for Enter when auto lookup is off", async () => {
    getSettings.mockResolvedValue({ ...settings, dictionary_auto_lookup: false });
    render(<DictionaryPane />);
    await screen.findByText(/Auto lookup is off/);

    fireEvent.change(screen.getByPlaceholderText("Look up a word…"), {
      target: { value: "fern" },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(dictionaryLookup).not.toHaveBeenCalled();

    fireEvent.submit(screen.getByRole("button", { name: "Look up" }).closest("form")!);
    await waitFor(() => expect(dictionaryLookup).toHaveBeenCalledWith("fern"));
  });

  it("saves the student's own definition and re-runs the lookup", async () => {
    render(<DictionaryPane />);
    await screen.findByText(/92,006 entries/);

    fireEvent.click(screen.getByRole("button", { name: "Add my own definition" }));
    fireEvent.change(screen.getByLabelText("Word"), { target: { value: "fern" } });
    fireEvent.change(screen.getByLabelText("Definition"), {
      target: { value: "my own definition" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save definition" }));

    await waitFor(() =>
      expect(addCustomDictionaryEntry).toHaveBeenCalledWith({
        word: "fern",
        pos: "",
        definition: "my own definition",
      }),
    );
    expect(await screen.findByText(/Saved “fern” to My dictionary/)).toBeInTheDocument();
    await waitFor(() => expect(dictionaryLookup).toHaveBeenCalledWith("fern"));
  });
});
