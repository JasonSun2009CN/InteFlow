import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "inteflow.eliminated.";

type EliminatedMap = Record<string, string[]>;

function read(docId: number): EliminatedMap {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${docId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: EliminatedMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        out[key] = value.filter((letter): letter is string => typeof letter === "string");
      }
    }
    return out;
  } catch {
    return {};
  }
}

function write(docId: number, value: EliminatedMap): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${docId}`, JSON.stringify(value));
  } catch {
    /* private mode: elimination still works for this page view */
  }
}

/**
 * Cross-out choices while practising. Purely a reading aid: the answer can
 * still be selected, and the state is local to this browser (no server call).
 */
export function useEliminated(docId: number) {
  const [map, setMap] = useState<EliminatedMap>(() => read(docId));

  useEffect(() => {
    setMap(read(docId));
  }, [docId]);

  const toggle = useCallback(
    (questionId: number, letter: string) => {
      setMap((current) => {
        const key = String(questionId);
        const existing = current[key] ?? [];
        const next = existing.includes(letter)
          ? existing.filter((item) => item !== letter)
          : [...existing, letter];
        const updated = { ...current, [key]: next };
        if (next.length === 0) delete updated[key];
        write(docId, updated);
        return updated;
      });
    },
    [docId],
  );

  const cleared = useCallback(
    (questionId: number) => new Set(map[String(questionId)] ?? []),
    [map],
  );

  return { toggle, eliminatedFor: cleared };
}
