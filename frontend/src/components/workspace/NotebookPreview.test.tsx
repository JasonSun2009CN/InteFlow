import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type ResultItem } from "../../api/client";
import NotebookPreview from "./NotebookPreview";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    api: { ...actual.api, exportAnalysis: vi.fn() },
  };
});

const exportAnalysis = vi.mocked(api.exportAnalysis);

function item(no: number): ResultItem {
  return {
    question_id: no,
    no,
    source_no: null,
    sec: "rw",
    kind: "choice",
    multi: false,
    material: no === 1 ? "A short passage." : null,
    stem: `Stem ${no}`,
    options: ["A) one", "B) two", "C) three", "D) four"],
    images: [],
    source: "Practice 1",
    chosen: null,
    chosen_answers: ["B"],
    answer: null,
    answers: ["A"],
    is_correct: false,
    explain: null,
  };
}

describe("NotebookPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportAnalysis.mockResolvedValue({ path: "/tmp/notebook.md", filename: "notebook.md" });
  });

  it("shows the exam title and only questions that have an analysis", () => {
    render(
      <NotebookPreview
        docId={1}
        title="25年北美 Harder A"
        items={[item(1), item(2)]}
        pages={{ 1: "First note.", 2: "   " }}
        sessionId={9}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "25年北美 Harder A" }),
    ).toBeInTheDocument();
    expect(screen.getByText("First note.")).toBeInTheDocument();
    expect(screen.getByText("Stem 1")).toBeInTheDocument();
    expect(screen.getByText("A short passage.")).toBeInTheDocument();
    expect(screen.queryByText("Stem 2")).not.toBeInTheDocument();
    expect(screen.getByText("1 question with analysis")).toBeInTheDocument();
  });

  it("exports only the analysed questions", async () => {
    render(
      <NotebookPreview
        docId={1}
        title="Notebook"
        items={[item(1)]}
        pages={{ 1: "First note." }}
        sessionId={9}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: ".pdf" }));
    await waitFor(() =>
      expect(exportAnalysis).toHaveBeenCalledWith(1, "pdf", 9, true),
    );
    expect(await screen.findByText(/Downloaded/)).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <NotebookPreview
        docId={1}
        title="Notebook"
        items={[item(1)]}
        pages={{ 1: "First note." }}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
