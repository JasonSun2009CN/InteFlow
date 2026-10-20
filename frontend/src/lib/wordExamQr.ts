import type { WordExam, WordExamMode, WordExamResult } from "../api/client";

/** The compact result QR carries every word's prompt, correct answer and the
 * student's answer. Large tests are split into several codes so the payload is
 * never truncated (the reader concatenates the chunks in order). */
export interface WordExamShareItem {
  /** 1-based position in the word list. */
  p: number;
  /** Headword. */
  w: string;
  /** Prompt the student saw (word for en-zh, meaning for zh-en). */
  q: string;
  /** The student's answer. */
  a: string;
  /** The correct answer (meaning for en-zh, word for zh-en). */
  c: string;
  ok: boolean;
}

export interface WordExamShare {
  v: 1;
  app: "InteFlow";
  id: string;
  title: string;
  mode: WordExamMode;
  /** Accuracy in percent (0–100). */
  acc: number;
  ok: number;
  n: number;
  scope: {
    tested: number;
    eligible: number;
    total: number;
    positions: number[];
    all: boolean;
  };
  items: WordExamShareItem[];
}

export const QR_CHUNK_BYTES = 900;

export function makeWordExamShareId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildWordExamShare(
  exam: WordExam,
  result: WordExamResult,
  id: string,
): WordExamShare {
  return {
    v: 1,
    app: "InteFlow",
    id,
    title: result.title || exam.title,
    mode: result.mode,
    acc: result.accuracy,
    ok: result.correct,
    n: result.total,
    scope: {
      tested: exam.scope.tested,
      eligible: exam.scope.eligible,
      total: exam.scope.total,
      positions: exam.scope.positions,
      all: exam.scope.all,
    },
    items: [...result.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        p: item.position,
        w: item.word,
        q: item.prompt,
        a: item.response,
        c: item.expected,
        ok: item.is_correct,
      })),
  };
}

/**
 * Split a UTF-8 payload into QR-safe chunks. Each code starts with
 * `IFWT1|<id>|<part>/<total>|`, so a reader can tell them apart and reassemble
 * the JSON in order. Chunks never split a multi-byte character.
 */
export function splitWordExamQrPayloads(
  json: string,
  id: string,
  limit = QR_CHUNK_BYTES,
): string[] {
  const bytes = new TextEncoder().encode(json);
  const chunks: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end -= 1;
    }
    if (end === start) {
      end = Math.min(start + limit, bytes.length);
    }
    chunks.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
  }

  if (chunks.length === 0) chunks.push("");
  return chunks.map(
    (chunk, index) => `IFWT1|${id}|${index + 1}/${chunks.length}|${chunk}`,
  );
}
