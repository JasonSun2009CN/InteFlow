import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  type DocumentAnnotations,
  type HighlightColor,
  type QuestionHighlight,
} from "../api/client";
import type { HighlightInput } from "../components/AnnotatableText";

const EMPTY: DocumentAnnotations = { highlights: [], notes: {} };

function message(err: unknown): string {
  return err instanceof ApiError ? err.message : String(err);
}

/** Highlights + question notes for one paper, kept in sync with the backend. */
export function useAnnotations(docId: number) {
  const [data, setData] = useState<DocumentAnnotations>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(EMPTY);
    setError(null);
    api
      .getAnnotations(docId)
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((err) => {
        if (!cancelled) setError(message(err));
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const addHighlight = useCallback(
    async (input: HighlightInput) => {
      setError(null);
      try {
        const created = await api.addHighlight(docId, input);
        setData((current) => ({
          ...current,
          highlights: [...current.highlights, created],
        }));
      } catch (err) {
        setError(message(err));
        throw err;
      }
    },
    [docId],
  );

  const updateHighlight = useCallback(
    async (id: number, patch: { color?: HighlightColor; note?: string }) => {
      setError(null);
      try {
        const updated = await api.updateHighlight(docId, id, patch);
        setData((current) => ({
          ...current,
          highlights: current.highlights.map((item) =>
            item.id === updated.id ? updated : item,
          ),
        }));
      } catch (err) {
        setError(message(err));
        throw err;
      }
    },
    [docId],
  );

  const deleteHighlight = useCallback(
    async (id: number) => {
      setError(null);
      const snapshot = data.highlights;
      setData((current) => ({
        ...current,
        highlights: current.highlights.filter((item) => item.id !== id),
      }));
      try {
        await api.deleteHighlight(docId, id);
      } catch (err) {
        setData((current) => ({ ...current, highlights: snapshot }));
        setError(message(err));
        throw err;
      }
    },
    [docId, data.highlights],
  );

  const saveNote = useCallback(
    async (questionId: number, content: string) => {
      setError(null);
      setData((current) => ({
        ...current,
        notes: { ...current.notes, [String(questionId)]: content },
      }));
      try {
        await api.saveQuestionNote(docId, questionId, content);
      } catch (err) {
        setError(message(err));
        throw err;
      }
    },
    [docId],
  );

  return {
    highlights: data.highlights,
    notes: data.notes,
    error,
    setError,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    saveNote,
  };
}

export function highlightsFor(
  highlights: QuestionHighlight[],
  questionId: number | null | undefined,
): QuestionHighlight[] {
  if (!questionId) return [];
  return highlights.filter((item) => item.question_id === questionId);
}
