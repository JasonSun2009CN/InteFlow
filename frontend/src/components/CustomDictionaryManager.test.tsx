import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import CustomDictionaryManager from "./CustomDictionaryManager";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getCustomDictionary: vi.fn(),
      addCustomDictionaryEntry: vi.fn(),
      deleteCustomDictionaryEntry: vi.fn(),
      importCustomDictionary: vi.fn(),
    },
  };
});

const getCustomDictionary = vi.mocked(api.getCustomDictionary);
const addCustomDictionaryEntry = vi.mocked(api.addCustomDictionaryEntry);
const deleteCustomDictionaryEntry = vi.mocked(api.deleteCustomDictionaryEntry);

const entry = {
  id: 4,
  word: "lucid",
  pos: "adj.",
  definition: "clear and easy to understand",
  created_at: "2026-10-20 10:00:00",
  updated_at: "2026-10-20 10:00:00",
};

describe("CustomDictionaryManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomDictionary.mockResolvedValue({ enabled: true, count: 1, entries: [entry] });
    addCustomDictionaryEntry.mockResolvedValue({ ...entry, id: 5, word: "abate", count: 2 });
    deleteCustomDictionaryEntry.mockResolvedValue({ deleted: 4, count: 1 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lists entries and adds a word", async () => {
    render(<CustomDictionaryManager onClose={vi.fn()} />);

    expect(await screen.findByText("lucid")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Custom dictionary word"), {
      target: { value: "abate" },
    });
    fireEvent.change(screen.getByLabelText("Custom dictionary definition"), {
      target: { value: "to become weaker" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add word" }));

    await waitFor(() =>
      expect(addCustomDictionaryEntry).toHaveBeenCalledWith({
        word: "abate",
        definition: "to become weaker",
        pos: "",
      }),
    );
  });

  it("deletes an entry", async () => {
    render(<CustomDictionaryManager onClose={vi.fn()} />);
    await screen.findByText("lucid");

    fireEvent.click(screen.getByRole("button", { name: "Delete lucid" }));

    await waitFor(() => expect(deleteCustomDictionaryEntry).toHaveBeenCalledWith(4));
  });
});
