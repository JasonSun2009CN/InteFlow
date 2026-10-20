import { describe, expect, it } from "vitest";
import type { WordExam, WordExamResult } from "../api/client";
import {
  buildWordExamShare,
  splitWordExamQrPayloads,
} from "./wordExamQr";

const exam: WordExam = {
  document_id: 7,
  title: "October Review",
  mode: "en-zh",
  total_words: 3,
  eligible_words: 3,
  requested_count: 2,
  count: 2,
  skipped: 0,
  scope: {
    tested: 2,
    eligible: 3,
    total: 3,
    skipped: 0,
    positions: [2, 3],
    all: false,
  },
  questions: [],
  ai_grading: false,
  ai_available: false,
};

const result: WordExamResult = {
  document_id: 7,
  title: "October Review",
  mode: "en-zh",
  total: 2,
  correct: 1,
  accuracy: 50,
  ai_requested: false,
  ai_available: false,
  ai_grading: false,
  warning: "",
  items: [
    {
      row_id: "r3",
      position: 3,
      word: "lucid",
      prompt: "lucid",
      expected: "clear",
      response: "unclear",
      is_correct: false,
      method: "lenient",
      reason: "",
      pos: "",
    },
    {
      row_id: "r2",
      position: 2,
      word: "elate",
      prompt: "elate",
      expected: "to fill with joy",
      response: "to fill with joy",
      is_correct: true,
      method: "lenient",
      reason: "",
      pos: "",
    },
  ],
};

describe("buildWordExamShare", () => {
  it("carries accuracy, scope, correct answers and the student's answers", () => {
    const share = buildWordExamShare(exam, result, "abc");

    expect(share.app).toBe("InteFlow");
    expect(share.acc).toBe(50);
    expect(share.ok).toBe(1);
    expect(share.n).toBe(2);
    expect(share.scope.positions).toEqual([2, 3]);
    expect(share.items).toEqual([
      { p: 2, w: "elate", q: "elate", a: "to fill with joy", c: "to fill with joy", ok: true },
      { p: 3, w: "lucid", q: "lucid", a: "unclear", c: "clear", ok: false },
    ]);
  });
});

describe("splitWordExamQrPayloads", () => {
  it("keeps small payloads in one code with a reassembly header", () => {
    const codes = splitWordExamQrPayloads('{"a":1}', "abc");
    expect(codes).toEqual(['IFWT1|abc|1/1|{"a":1}']);
  });

  it("splits large payloads without breaking multi-byte characters", () => {
    const json = JSON.stringify({ text: "高兴".repeat(400) });
    const codes = splitWordExamQrPayloads(json, "abc", 120);

    expect(codes.length).toBeGreaterThan(1);
    const rebuilt = codes
      .map((code) => code.split("|", 4)[3])
      .join("");
    expect(rebuilt).toBe(json);
    expect(codes[0].startsWith(`IFWT1|abc|1/${codes.length}|`)).toBe(true);
    expect(codes.join("")).not.toContain("\uFFFD");
  });
});
