import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AppSettings, type BuiltinBank } from "../api/client";
import ImportPage from "./ImportPage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getSettings: vi.fn(),
      listDocuments: vi.fn(),
      listSubjects: vi.fn(),
      listBanks: vi.fn(),
      importBank: vi.fn(),
      health: vi.fn(),
    },
  };
});

const getSettings = vi.mocked(api.getSettings);
const listDocuments = vi.mocked(api.listDocuments);
const listSubjects = vi.mocked(api.listSubjects);
const listBanks = vi.mocked(api.listBanks);
const importBank = vi.mocked(api.importBank);
const health = vi.mocked(api.health);

const settings: AppSettings = {
  provider: "orcarouter",
  protocol: "openai",
  base_url: "",
  model: "",
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

const bank: BuiltinBank = {
  id: "sample",
  title: "Sample question bank",
  source: "builtin",
  origin: "builtin",
  removable: false,
  units: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue(settings);
  listDocuments.mockResolvedValue([]);
  listSubjects.mockResolvedValue([]);
  listBanks.mockResolvedValue([bank]);
  health.mockResolvedValue({ status: "ok", version: "0.1.0", ocr: [] });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ImportPage />
    </MemoryRouter>,
  );
}

describe("ImportPage built-in library", () => {
  it("keeps the sample bank hidden by default but still offers bank import", async () => {
    renderPage();

    expect(await screen.findByText("Nothing imported yet.")).toBeInTheDocument();
    await waitFor(() => expect(listBanks).toHaveBeenCalled());
    expect(screen.queryByText("Sample question bank")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Question banks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import bank" })).toBeInTheDocument();
  });

  it("always shows user-imported banks, even when the sample bank is off", async () => {
    listBanks.mockResolvedValue([
      { ...bank, id: "mine", title: "My imported bank", origin: "user", removable: true },
    ]);
    renderPage();

    expect(await screen.findByText("My imported bank")).toBeInTheDocument();
    expect(screen.getByText("imported")).toBeInTheDocument();
  });

  it("imports a bank ZIP and reports the unit/question count", async () => {
    importBank.mockResolvedValue({
      bank_id: "mine",
      title: "My bank",
      units: 3,
      questions: 81,
      assets: 2,
    });
    renderPage();
    await waitFor(() => expect(listBanks).toHaveBeenCalled());

    const file = new File(["zip"], "bank.zip", { type: "application/zip" });
    fireEvent.change(screen.getByTestId("bank-file"), { target: { files: [file] } });

    await waitFor(() => expect(importBank).toHaveBeenCalledWith(file));
    expect(
      await screen.findByText("Imported “My bank” · 3 units · 81 questions."),
    ).toBeInTheDocument();
  });

  it("shows the sample bank when the setting is enabled", async () => {
    getSettings.mockResolvedValue({ ...settings, show_builtin_library: true });
    renderPage();

    expect(await screen.findByText("Sample question bank")).toBeInTheDocument();
    expect(listBanks).toHaveBeenCalledTimes(1);
  });
});
