import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type AppSettings } from "../api/client";
import SettingsPage from "./SettingsPage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getSettings: vi.fn(),
      saveSettings: vi.fn(),
      listProviders: vi.fn(),
      testSettings: vi.fn(),
    },
  };
});

const getSettings = vi.mocked(api.getSettings);
const saveSettings = vi.mocked(api.saveSettings);
const listProviders = vi.mocked(api.listProviders);

const settings: AppSettings = {
  provider: "orcarouter",
  protocol: "openai",
  base_url: "https://example.test/v1",
  model: "demo-model",
  api_key_masked: "",
  api_key_set: false,
  user_name: "Alex",
  llm_fallback: true,
  vocab_ai_sense: true,
  vocab_learner_definitions: false,
  vocab_exam_ai_grading: false,
  custom_dictionary_enabled: true,
  analysis_template: "",
  show_builtin_library: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue(settings);
  listProviders.mockResolvedValue([]);
  saveSettings.mockImplementation(async (input) => ({ ...settings, ...input }));
});

afterEach(() => {
  delete window.inteflow;
});

describe("SettingsPage vocabulary options", () => {
  it("loads and saves the AI sense and English-learner definition toggles", async () => {
    render(<SettingsPage />);

    const aiSense = await screen.findByRole("checkbox", { name: /AI sense matching/ });
    const learner = screen.getByRole("checkbox", {
      name: /Definition for English Learners/,
    });
    const custom = screen.getByRole("checkbox", { name: /Use my dictionary first/ });
    expect(aiSense).toBeChecked();
    expect(learner).not.toBeChecked();
    expect(custom).toBeChecked();

    fireEvent.click(aiSense);
    fireEvent.click(learner);
    fireEvent.click(custom);
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          vocab_ai_sense: false,
          vocab_learner_definitions: true,
          custom_dictionary_enabled: false,
        }),
      ),
    );
    expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
  });

  it("saves the AI word-test grading toggle", async () => {
    render(<SettingsPage />);

    const examAi = await screen.findByRole("checkbox", {
      name: /AI grading for word tests/,
    });
    expect(examAi).not.toBeChecked();

    fireEvent.click(examAi);
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ vocab_exam_ai_grading: true }),
      ),
    );
  });

  it("keeps the built-in library hidden by default and can enable it", async () => {
    render(<SettingsPage />);

    const builtin = await screen.findByRole("checkbox", {
      name: /Show built-in library/,
    });
    expect(builtin).not.toBeChecked();

    fireEvent.click(builtin);
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ show_builtin_library: true }),
      ),
    );
  });

  it("resets local data through the desktop bridge", async () => {
    const resetData = vi.fn().mockResolvedValue({ ok: false, cancelled: true });
    window.inteflow = { desktop: true, resetData };
    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset local data…" }));

    await waitFor(() => expect(resetData).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Reset cancelled.")).toBeInTheDocument();
  });

  it("loads and saves the analysis template exactly as typed", async () => {
    getSettings.mockResolvedValue({
      ...settings,
      analysis_template: "**Why the key works**\n\n**Takeaway**\n",
    });
    render(<SettingsPage />);

    const field = await screen.findByLabelText("Analysis template");
    expect(field).toHaveValue("**Why the key works**\n\n**Takeaway**\n");

    fireEvent.change(field, {
      target: { value: "**Why**\n- evidence\n\n**Takeaway**" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis_template: "**Why**\n- evidence\n\n**Takeaway**",
        }),
      ),
    );
  });
});
