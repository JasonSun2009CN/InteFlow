import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DocumentSummary } from "../api/client";
import ExamHomePage from "./ExamHomePage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: { ...actual.api, listDocuments: vi.fn() },
  };
});

const listDocuments = vi.mocked(api.listDocuments);

const exam: DocumentSummary = {
  id: 7,
  title: "October Review",
  source_filename: "october.pdf",
  answers_status: "external",
  question_count: 40,
  answered_count: 12,
  needs_answers: true,
  created_at: "2026-10-19 09:15:00",
};

function renderHome() {
  return render(
    <MemoryRouter>
      <ExamHomePage />
    </MemoryRouter>,
  );
}

describe("ExamHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists exams with their status and working links", async () => {
    listDocuments.mockResolvedValue([exam]);
    renderHome();

    expect(await screen.findByRole("link", { name: "October Review" })).toHaveAttribute(
      "href",
      "/doc/7/practice",
    );
    expect(screen.getByText(/Answer key 12\/40/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /enter answers/i })).toHaveAttribute(
      "href",
      "/doc/7/answers",
    );
    expect(screen.getByRole("link", { name: /start/i })).toHaveAttribute(
      "href",
      "/doc/7/practice",
    );
  });

  it("shows the empty state with a library entry point", async () => {
    listDocuments.mockResolvedValue([]);
    renderHome();

    expect(await screen.findByText("No exams yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open library/i })).toHaveAttribute(
      "href",
      "/library",
    );
  });

  it("surfaces load errors and retries", async () => {
    listDocuments
      .mockRejectedValueOnce(new Error("backend down"))
      .mockResolvedValueOnce([exam]);
    renderHome();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your exams.",
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("October Review")).toBeInTheDocument();
    expect(listDocuments).toHaveBeenCalledTimes(2);
  });
});
