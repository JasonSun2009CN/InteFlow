import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DocumentSummary, type QuizQuestion, type StartResponse } from "../api/client";
import PracticePage from "./PracticePage";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      startSession: vi.fn(),
      getTimerPreference: vi.fn(),
      setSessionTimer: vi.fn(),
      submit: vi.fn(),
      deleteSession: vi.fn(),
      listStarredIds: vi.fn(),
      starQuestion: vi.fn(),
      unstarQuestion: vi.fn(),
    },
  };
});

const startSession = vi.mocked(api.startSession);
const getTimerPreference = vi.mocked(api.getTimerPreference);
const setSessionTimer = vi.mocked(api.setSessionTimer);
const submit = vi.mocked(api.submit);
const deleteSession = vi.mocked(api.deleteSession);
const listStarredIds = vi.mocked(api.listStarredIds);
const starQuestion = vi.mocked(api.starQuestion);
const unstarQuestion = vi.mocked(api.unstarQuestion);

const doc: DocumentSummary = {
  id: 7,
  title: "October Review",
  source_filename: "october.pdf",
  answers_status: "external",
  question_count: 2,
  answered_count: 2,
  needs_answers: false,
  subject: null,
  created_at: "2026-10-19 09:15:00",
};

function quiz(id: number): QuizQuestion {
  return {
    id,
    ext_id: `Q${id}`,
    no: id,
    sec: "rw",
    type: null,
    difficulty: null,
    material: null,
    stem: `Stem ${id}`,
    options: ["A) one", "B) two", "C) three", "D) four"],
    kind: "choice",
    multi: false,
    images: [],
    source: null,
    explain: null,
  };
}

const session: StartResponse = {
  session_id: 42,
  document: doc,
  questions: [quiz(1), quiz(2)],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/doc/7/practice"]}>
      <Routes>
        <Route path="/doc/:id/practice" element={<PracticePage />} />
        <Route path="/session/:sid/result" element={<div>Results</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PracticePage sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startSession.mockResolvedValue(session);
    getTimerPreference.mockResolvedValue({ mode: "countup", seconds: null, source: "none" });
    setSessionTimer.mockResolvedValue({
      session_id: 42,
      timer_mode: "countup",
      timer_seconds: null,
    });
    deleteSession.mockResolvedValue(undefined as never);
    listStarredIds.mockResolvedValue({ question_ids: [] });
    starQuestion.mockResolvedValue({ question_id: 1, starred: true });
    unstarQuestion.mockResolvedValue({ question_id: 1, starred: false });
  });

  it("discards the provisional session when you leave without submitting", async () => {
    const { unmount } = renderPage();
    expect(await screen.findByText("Ready to begin")).toBeInTheDocument();

    unmount();

    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith(42));
  });

  it("persists a starred question while practising", async () => {
    renderPage();
    await screen.findByText("Ready to begin");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Begin — enter fullscreen/ }));
    });
    await screen.findByText("Exit");

    fireEvent.click(screen.getByRole("button", { name: /Star for review/ }));

    expect(await screen.findByRole("button", { name: /★ Starred/ })).toBeInTheDocument();
    await waitFor(() => expect(starQuestion).toHaveBeenCalledWith(1));
  });

  it("keeps the session once the attempt is submitted", async () => {
    submit.mockResolvedValue({
      session_id: 42,
      total: 2,
      graded: 2,
      correct: 1,
      items: [],
    });
    renderPage();
    await screen.findByText("Ready to begin");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Begin — enter fullscreen/ }));
    });
    await screen.findByText("Exit");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });
    const confirm = screen.getAllByRole("button", { name: "Submit" });
    await act(async () => {
      fireEvent.click(confirm[confirm.length - 1]);
    });

    expect(await screen.findByText("Results")).toBeInTheDocument();
    expect(submit).toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
  });
});

describe("PracticePage timer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteSession.mockResolvedValue(undefined as never);
    listStarredIds.mockResolvedValue({ question_ids: [] });
    startSession.mockResolvedValue(session);
    setSessionTimer.mockResolvedValue({
      session_id: 42,
      timer_mode: "countup",
      timer_seconds: null,
    });
  });

  it("defaults to the timer used by this paper's last attempt", async () => {
    getTimerPreference.mockResolvedValue({
      mode: "countdown",
      seconds: 120,
      source: "document",
    });
    renderPage();
    await screen.findByText("Ready to begin");

    expect(screen.getByRole("button", { name: "Count down" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Minutes")).toHaveValue(2);
    expect(screen.getByLabelText("Seconds")).toHaveValue(0);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Begin — enter fullscreen/ }));
    });
    await screen.findByText("Exit");

    await waitFor(() =>
      expect(setSessionTimer).toHaveBeenCalledWith(42, "countdown", 120),
    );
  });

  it("auto-submits when the countdown reaches zero", async () => {
    getTimerPreference.mockResolvedValue({ mode: "countup", seconds: null, source: "none" });
    submit.mockResolvedValue({
      session_id: 42,
      total: 2,
      graded: 2,
      correct: 0,
      items: [],
    });
    renderPage();
    await screen.findByText("Ready to begin");

    fireEvent.click(screen.getByRole("button", { name: "Count down" }));
    fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Seconds"), { target: { value: "1" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Begin — enter fullscreen/ }));
    });
    await screen.findByText("Exit");

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1), { timeout: 2500 });
    expect(await screen.findByText("Results")).toBeInTheDocument();
  });
});

describe("PracticePage five options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteSession.mockResolvedValue(undefined as never);
    listStarredIds.mockResolvedValue({ question_ids: [] });
    getTimerPreference.mockResolvedValue({ mode: "countup", seconds: null, source: "none" });
    setSessionTimer.mockResolvedValue({
      session_id: 7,
      timer_mode: "countup",
      timer_seconds: null,
    });
    startSession.mockResolvedValue({
      session_id: 7,
      document: doc,
      questions: [{ ...quiz(1), options: ["A) 3", "B) 4", "C) 5", "D) 6", "E) 7"] }],
    });
  });

  it("renders and keyboard-selects a fifth option", async () => {
    renderPage();
    await screen.findByText("Ready to begin");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Begin — enter fullscreen/ }));
    });
    await screen.findByText("Exit");

    const eOption = screen.getByRole("button", { name: /7/ });
    expect(eOption).toHaveAttribute("aria-pressed", "false");

    await act(async () => {
      fireEvent.keyDown(window, { key: "e" });
    });
    expect(screen.getByRole("button", { name: /7/ })).toHaveAttribute("aria-pressed", "true");
  });
});
