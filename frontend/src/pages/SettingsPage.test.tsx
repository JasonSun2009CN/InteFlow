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
      health: vi.fn(),
    },
  };
});

const getSettings = vi.mocked(api.getSettings);
const saveSettings = vi.mocked(api.saveSettings);
const listProviders = vi.mocked(api.listProviders);
const health = vi.mocked(api.health);

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
  vocab_auto_definition: true,
  vocab_learner_definitions: false,
  vocab_exam_ai_grading: false,
  custom_dictionary_enabled: true,
  analysis_template: "",
  show_builtin_library: false,
  dictionary_auto_lookup: true,
};

/** Auto-save is debounced, so give the PUT more room than the default 1s. */
async function waitForSave() {
  await waitFor(() => expect(saveSettings).toHaveBeenCalled(), { timeout: 3000 });
  return saveSettings.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue(settings);
  listProviders.mockResolvedValue([]);
  health.mockResolvedValue({ status: "ok", version: "1.0.0", ocr: [] });
  saveSettings.mockImplementation(async (input) => ({ ...settings, ...input }));
});

afterEach(() => {
  delete window.inteflow;
});

describe("SettingsPage", () => {
  it("shows the app version reported by the backend", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Version 1.0.0")).toBeInTheDocument();
  });

  it("auto-saves edits without a Save button", async () => {
    render(<SettingsPage />);

    const name = await screen.findByLabelText("Your name");
    expect(screen.queryByRole("button", { name: "Save settings" })).not.toBeInTheDocument();

    fireEvent.change(name, { target: { value: "Alexandra" } });

    expect(await waitForSave()).toEqual(
      expect.objectContaining({ user_name: "Alexandra" }),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("keeps edits typed while an API-key save is in flight", async () => {
    let resolveFirst!: (value: AppSettings) => void;
    saveSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((resolve) => { resolveFirst = resolve; }),
    );
    render(<SettingsPage />);

    const key = await screen.findByLabelText("API Key");
    fireEvent.change(key, { target: { value: "sk-test-123456" } });
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1), { timeout: 3000 });

    // This edit lands while the key PUT is still pending.
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alexandra" },
    });
    resolveFirst({ ...settings, api_key_set: true, api_key_masked: "sk-t…3456" });

    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(saveSettings.mock.calls[1][0]).toEqual(
      expect.objectContaining({ user_name: "Alexandra" }),
    );
    expect(saveSettings.mock.calls[1][0].api_key).toBeUndefined();
  });

  it("coalesces rapid keystrokes into one save with the final value", async () => {
    render(<SettingsPage />);

    const name = await screen.findByLabelText("Your name");
    fireEvent.change(name, { target: { value: "A" } });
    fireEvent.change(name, { target: { value: "Al" } });
    fireEvent.change(name, { target: { value: "Alexandra" } });

    await waitForSave();
    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings.mock.calls[0][0]).toEqual(
      expect.objectContaining({ user_name: "Alexandra" }),
    );
  });
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

    expect(await waitForSave()).toEqual(
      expect.objectContaining({
        vocab_ai_sense: false,
        vocab_learner_definitions: true,
        custom_dictionary_enabled: false,
      }),
    );
  });

  it("lets the user turn off automatically filled vocabulary definitions", async () => {
    render(<SettingsPage />);

    const auto = await screen.findByRole("checkbox", {
      name: /Auto-fill definitions in the word list/,
    });
    expect(auto).toBeChecked();

    fireEvent.click(auto);

    expect(await waitForSave()).toEqual(
      expect.objectContaining({ vocab_auto_definition: false }),
    );
  });

  it("auto-saves the dictionary lookup toggle too", async () => {
    render(<SettingsPage />);

    const auto = await screen.findByRole("checkbox", {
      name: /Look up dictionary words while typing/,
    });
    expect(auto).toBeChecked();

    fireEvent.click(auto);

    expect(await waitForSave()).toEqual(
      expect.objectContaining({ dictionary_auto_lookup: false }),
    );
  });

  it("saves the AI word-test grading toggle", async () => {
    render(<SettingsPage />);

    const examAi = await screen.findByRole("checkbox", {
      name: /AI grading for word tests/,
    });
    expect(examAi).not.toBeChecked();

    fireEvent.click(examAi);

    expect(await waitForSave()).toEqual(
      expect.objectContaining({ vocab_exam_ai_grading: true }),
    );
  });

  it("keeps the built-in library hidden by default and can enable it", async () => {
    render(<SettingsPage />);

    const builtin = await screen.findByRole("checkbox", {
      name: /Show built-in library/,
    });
    expect(builtin).not.toBeChecked();

    fireEvent.click(builtin);

    expect(await waitForSave()).toEqual(
      expect.objectContaining({ show_builtin_library: true }),
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

    expect(await waitForSave()).toEqual(
      expect.objectContaining({
        analysis_template: "**Why**\n- evidence\n\n**Takeaway**",
      }),
    );
  });
});
