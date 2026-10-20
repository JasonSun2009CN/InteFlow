import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DocumentSummary, type Subject } from "../api/client";
import { SubjectManager, SubjectPicker } from "./SubjectControls";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      createSubject: vi.fn(),
      setDocumentSubject: vi.fn(),
      updateSubject: vi.fn(),
      deleteSubject: vi.fn(),
    },
  };
});

const createSubject = vi.mocked(api.createSubject);
const setDocumentSubject = vi.mocked(api.setDocumentSubject);
const updateSubject = vi.mocked(api.updateSubject);
const deleteSubject = vi.mocked(api.deleteSubject);

const subject: Subject = {
  id: 1,
  name: "SAT Math",
  color: "emerald",
  document_count: 2,
  created_at: "2026-10-20 10:00:00",
};

const doc: DocumentSummary = {
  id: 7,
  title: "October Review",
  source_filename: "october.pdf",
  answers_status: "none",
  question_count: 3,
  answered_count: 0,
  needs_answers: true,
  subject: null,
  created_at: "2026-10-19 09:15:00",
};

describe("SubjectPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigns an existing subject", async () => {
    setDocumentSubject.mockResolvedValue({
      ...doc,
      subject: { id: 1, name: "SAT Math", color: "emerald" },
    });
    const onChange = vi.fn();
    render(
      <SubjectPicker
        docId={7}
        title="October Review"
        subjects={[subject]}
        value={null}
        onChange={onChange}
        onSubjectsChanged={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Subject for October Review" }),
      { target: { value: "1" } },
    );

    await waitFor(() => expect(setDocumentSubject).toHaveBeenCalledWith(7, 1));
    expect(onChange).toHaveBeenCalledWith({
      id: 1,
      name: "SAT Math",
      color: "emerald",
    });
  });

  it("creates a subject and assigns it in one step", async () => {
    createSubject.mockResolvedValue({ ...subject, id: 2, name: "Physics", color: "violet" });
    setDocumentSubject.mockResolvedValue({
      ...doc,
      subject: { id: 2, name: "Physics", color: "violet" },
    });
    const onChange = vi.fn();
    const onSubjectsChanged = vi.fn();
    render(
      <SubjectPicker
        docId={7}
        subjects={[]}
        value={null}
        onChange={onChange}
        onSubjectsChanged={onSubjectsChanged}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Subject" }), {
      target: { value: "__new__" },
    });
    fireEvent.change(screen.getByLabelText("New subject name"), {
      target: { value: "Physics" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Color Violet" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(createSubject).toHaveBeenCalledWith("Physics", "violet"),
    );
    expect(setDocumentSubject).toHaveBeenCalledWith(7, 2);
    expect(onChange).toHaveBeenCalledWith({
      id: 2,
      name: "Physics",
      color: "violet",
    });
    expect(onSubjectsChanged).toHaveBeenCalled();
  });
});

describe("SubjectManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, renames and deletes subjects", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    createSubject.mockResolvedValue({ ...subject, id: 2, name: "Physics" });
    updateSubject.mockResolvedValue({ ...subject, name: "SAT Math II" });
    deleteSubject.mockResolvedValue({ deleted: 1 });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <SubjectManager subjects={[subject]} onClose={vi.fn()} onChanged={onChanged} />,
    );

    fireEvent.change(screen.getByLabelText("New subject name"), {
      target: { value: "Physics" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add subject" }));
    await waitFor(() =>
      expect(createSubject).toHaveBeenCalledWith("Physics", expect.any(String)),
    );

    fireEvent.change(screen.getByLabelText("Name for SAT Math"), {
      target: { value: "SAT Math II" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateSubject).toHaveBeenCalledWith(1, { name: "SAT Math II" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteSubject).toHaveBeenCalledWith(1));
    expect(window.confirm).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledTimes(3);
  });
});
