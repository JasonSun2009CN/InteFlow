import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type SessionSummary } from "../api/client";
import SessionsPage from "./SessionsPage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
    },
  };
});

const listSessions = vi.mocked(api.listSessions);
const deleteSession = vi.mocked(api.deleteSession);

const sessions: SessionSummary[] = [
  {
    session_id: 11,
    document_id: 1,
    document_title: "October Review",
    started_at: "2026-10-19 09:15:00",
    finished_at: "2026-10-19 09:40:00",
    correct: 30,
    graded: 40,
    answered: 40,
  },
  {
    session_id: 12,
    document_id: 2,
    document_title: "September Practice",
    started_at: "2026-09-08 14:00:00",
    finished_at: null,
    correct: 0,
    graded: 0,
    answered: 5,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <SessionsPage />
    </MemoryRouter>,
  );
}

describe("SessionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lists attempts newest first with score and links", async () => {
    listSessions.mockResolvedValue(sessions);
    renderPage();

    const links = await screen.findAllByRole("link");
    const firstRow = links.find((l) => l.getAttribute("href")?.includes("/result"));
    expect(firstRow).toHaveAttribute("href", "/session/11/result");
    expect(screen.getByText("30/40 · 75%")).toBeInTheDocument();
    expect(screen.getByText("unfinished")).toBeInTheDocument();
  });

  it("shows the empty state when there are no attempts", async () => {
    listSessions.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No sessions yet.")).toBeInTheDocument();
  });

  it("filters by title", async () => {
    listSessions.mockResolvedValue(sessions);
    renderPage();
    await screen.findByText("October Review");

    fireEvent.change(screen.getByLabelText("Search sessions"), {
      target: { value: "september" },
    });
    expect(screen.getByText("September Practice")).toBeInTheDocument();
    expect(screen.queryByText("October Review")).not.toBeInTheDocument();
  });

  it("shows a message when nothing matches the search", async () => {
    listSessions.mockResolvedValue(sessions);
    renderPage();
    await screen.findByText("October Review");

    fireEvent.change(screen.getByLabelText("Search sessions"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(/No sessions match/)).toBeInTheDocument();
  });

  it("deletes an attempt after confirmation", async () => {
    listSessions.mockResolvedValue(sessions);
    deleteSession.mockResolvedValue(undefined as never);
    renderPage();
    await screen.findByText("October Review");

    fireEvent.click(screen.getByRole("button", { name: "Delete attempt 11" }));

    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith(11));
    await waitFor(() => expect(screen.queryByText("October Review")).not.toBeInTheDocument());
    expect(screen.getByText("September Practice")).toBeInTheDocument();
  });

  it("keeps the row when deletion is cancelled", async () => {
    listSessions.mockResolvedValue(sessions);
    vi.mocked(window.confirm).mockReturnValue(false);
    renderPage();
    await screen.findByText("October Review");

    fireEvent.click(screen.getByRole("button", { name: "Delete attempt 11" }));
    expect(deleteSession).not.toHaveBeenCalled();
    expect(screen.getByText("October Review")).toBeInTheDocument();
  });
});
