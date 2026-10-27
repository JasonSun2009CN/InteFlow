/** Typed client for the FastAPI backend (all paths proxied by Vite in dev). */

/** A question's section is a free-form label (rw | math | physics | ...). */
export type Section = string;
export type AnswersStatus = "inline" | "external" | "none";

/** Palette ids accepted by the backend for user-defined subjects. */
export type SubjectColor =
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "cyan"
  | "lime"
  | "slate";

/** The subject label carried by a paper. */
export interface SubjectRef {
  id: number;
  name: string;
  color: SubjectColor;
}

/** A managed subject, with how many papers currently use it. */
export interface Subject extends SubjectRef {
  document_count: number;
  created_at: string;
}

export interface DocumentSummary {
  id: number;
  title: string;
  source_filename: string;
  answers_status: AnswersStatus;
  question_count: number;
  answered_count: number;
  needs_answers: boolean;
  /** User-defined subject group, or null when uncategorized. */
  subject: SubjectRef | null;
  created_at: string;
  warnings?: string[];
}

export type ImportJobStatus =
  | "detecting"
  | "converting"
  | "review"
  | "done"
  | "failed"
  | "cancelled";

export interface ImportPageReport {
  no: number;
  status: string; // text | ocr_ok | low_confidence | ocr_unavailable | ocr_failed | empty
  source: string | null;
  confidence: number | null;
  reason: string | null;
}

export interface ImportJob {
  id: string;
  filename: string;
  status: ImportJobStatus;
  stage: string;
  kind: string | null;
  import_source: string | null;
  pages_total: number;
  pages_done: number;
  question_count: number;
  used_ai: boolean;
  document_id: number | null;
  error: string | null;
  created_at: string;
  pages: ImportPageReport[];
  warnings: string[];
  needs_review: boolean;
}

export type QuestionKind = "choice" | "blank";

export interface Question {
  id: number;
  ext_id: string;
  no: number | null;
  sec: Section;
  type: string | null;
  difficulty: string | null;
  material: string | null;
  material2?: string | null;
  stem: string;
  options: string[];
  kind: QuestionKind;
  multi: boolean;
  images: string[];
  source: string | null;
  explain: string | null;
  answer: string | null;
  answers: string[];
}

/** What the quiz UI receives — the correct answers never leave the server. */
export type QuizQuestion = Omit<Question, "answer" | "answers">;

export interface StartResponse {
  session_id: number;
  document: DocumentSummary;
  questions: QuizQuestion[];
}

/** GET /api/sessions/{id} — enough to render the results page. */
export interface SessionDetail {
  id: number;
  document_id: number;
  started_at: string;
  finished_at: string | null;
  timer_mode?: TimerMode;
  timer_seconds?: number | null;
  document: DocumentSummary;
  questions: QuizQuestion[];
}

/** How the practice clock runs: up from zero, or down to zero. */
export type TimerMode = "countup" | "countdown";

export interface TimerPreference {
  mode: TimerMode;
  /** Countdown length in seconds; null for count-up. */
  seconds: number | null;
  /** Where the default came from: this paper, another paper, or no record. */
  source: "document" | "global" | "none";
}

export interface ResultItem {
  question_id: number;
  no: number;
  source_no: number | null;
  sec: Section;
  kind: QuestionKind;
  multi: boolean;
  material: string | null;
  material2?: string | null;
  stem: string;
  options: string[];
  images: string[];
  source: string | null;
  chosen: string | null;
  chosen_answers: string[];
  answer: string | null;
  answers: string[];
  is_correct: boolean | null;
  explain: string | null;
}

export interface SubmitResult {
  session_id: number;
  total: number;
  graded: number;
  correct: number;
  items: ResultItem[];
}

export interface ProbeResult {
  ok: boolean;
  detail: string;
}

/** Free-form vocabulary grid (default headers Word | Meaning | Notes). */
export interface VocabColumn {
  id: string;
  name: string;
  width: number;
}

export interface VocabRow {
  id: string;
  cells: Record<string, string>;
}

export interface WordView {
  sort: { columnId: string; direction: "asc" | "desc" } | null;
  filter: Record<string, string>;
}

export interface WordGrid {
  version: number;
  columns: VocabColumn[];
  rows: VocabRow[];
  view: WordView;
}

/** Local dictionary index state (`GET /api/dictionary/status`). */
export interface DictionaryStatus {
  kind: "standard";
  available: boolean;
  indexed: boolean;
  stale: boolean;
  source: string | null;
  source_name: string | null;
  index_path: string;
  entry_count: number;
  /** Number of MW entries that have a "Definition for English Learners" block. */
  learner_count: number;
  learner_enabled: boolean;
  custom_dictionary: {
    enabled: boolean;
    count: number;
  };
  built_at: string | null;
  title: string | null;
  author: string | null;
  building: boolean;
}

export interface DictionaryEntry {
  id: number;
  headword: string;
  /** Full English-English text on exact matches; null on suggestions. */
  definition: string | null;
  /** MW's optional in-entry Definition for English Learners section. */
  learner_definition: string | null;
  snippet: string;
  pos?: string;
  source: "standard" | "custom";
}

export interface DictionaryLookup {
  query: string;
  exact: DictionaryEntry[];
  matches: DictionaryEntry[];
  entry_count: number;
  source: "standard";
  learner_enabled: boolean;
  custom_dictionary: {
    enabled: boolean;
    count: number;
  };
  warning: string;
}

/** One row in the user's own dictionary. */
export interface CustomDictionaryEntry {
  id: number;
  word: string;
  pos: string;
  definition: string;
  created_at: string;
  updated_at: string;
}

export interface CustomDictionary {
  enabled: boolean;
  count: number;
  entries: CustomDictionaryEntry[];
}

export interface CustomDictionaryImport {
  added: number;
  updated: number;
  skipped: number;
  total: number;
}

/** One exam in the vocabulary collection. */
export interface VocabularyDocument {
  document_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  preview: string[];
  columns: { id: string; name: string }[];
  has_grid: boolean;
}

export interface VocabularyOverview {
  documents: VocabularyDocument[];
  total_documents: number;
  total_words: number;
}

export type WordExamMode = "en-zh" | "zh-en";

export interface WordExamQuestion {
  row_id: string;
  position: number;
  prompt: string;
  prompt_source: "word" | "list" | "dictionary";
  pos: string;
}

export interface WordExamScope {
  tested: number;
  eligible: number;
  total: number;
  skipped: number;
  positions: number[];
  all: boolean;
}

/** A freshly generated word test — the correct answers stay on the server. */
export interface WordExam {
  document_id: number;
  title: string;
  mode: WordExamMode;
  total_words: number;
  eligible_words: number;
  requested_count: number | null;
  count: number;
  skipped: number;
  scope: WordExamScope;
  questions: WordExamQuestion[];
  ai_grading: boolean;
  ai_available: boolean;
}

export type WordExamMethod = "spelling" | "lenient" | "ai" | "fallback";

export interface WordExamResultItem {
  row_id: string;
  position: number;
  word: string;
  prompt: string;
  expected: string;
  response: string;
  is_correct: boolean;
  method: WordExamMethod;
  reason: string;
  pos: string;
}

export interface WordExamResult {
  document_id: number;
  title: string;
  mode: WordExamMode;
  total: number;
  correct: number;
  accuracy: number;
  ai_requested: boolean;
  ai_available: boolean;
  ai_grading: boolean;
  warning: string;
  items: WordExamResultItem[];
}

export interface WordEntryInput {
  word: string;
  meaning?: string;
  pos?: string;
  notes?: string;
  context?: string;
  source?: string;
  question_no?: number | null;
}

export interface WordEntryResult {
  grid: WordGrid;
  row: VocabRow;
  row_id: string;
  word: string;
  created: boolean;
  matched?: boolean;
  used_ai?: boolean;
  pos?: string;
  definition?: string;
  entry_id?: number | string | null;
  dictionary_word?: string | null;
  reason?: string;
  warning?: string;
  selected?: string;
  source?: "standard" | "custom";
  dictionary_title?: string | null;
  learner?: boolean;
}

/** One question's analysis page — the notebook is one page per question. */
export interface AnalysisPage {
  id: number | null;
  document_id: number;
  question_id: number;
  position: number;
  content: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface AnalysisNotebook {
  document_id: number;
  title: string;
  pages: AnalysisPage[];
}

export interface AnalysisMeta {
  document_id: number;
  title: string;
  user_name: string;
  sessions: {
    session_id: number;
    started_at: string;
    finished_at: string | null;
    correct: number;
    graded: number;
  }[];
}

/** One saved analysis attached to a review item (current page or legacy row). */
export interface ReviewAnalysis {
  source: "page" | "legacy" | "explain";
  content: string;
  updated_at: string | null;
}

/** A question in the Mistakes or Starred collection. */
export interface ReviewItem {
  question_id: number;
  document_id: number;
  document_title: string;
  subject: SubjectRef | null;
  no: number;
  source_no: number | null;
  sec: Section;
  kind: QuestionKind;
  multi: boolean;
  material: string | null;
  material2?: string | null;
  stem: string;
  options: string[];
  images: string[];
  source: string | null;
  chosen: string | null;
  chosen_answers: string[];
  answer: string | null;
  answers: string[];
  is_correct: boolean | null;
  session_id: number | null;
  answered_at: string | null;
  finished_at: string | null;
  starred: boolean;
  starred_at: string | null;
  explain: string | null;
  analysis: string;
  analyses: ReviewAnalysis[];
}

/** One saved attempt, as listed on the Sessions page. */
export interface SessionSummary {
  session_id: number;
  document_id: number;
  document_title: string;
  started_at: string;
  finished_at: string | null;
  correct: number;
  graded: number;
  answered: number;
}

/** One module of a built-in bank, as listed on the import page. */
export interface BuiltinUnit {
  id: string;
  title: string;
  module: number | null;
  questions: number;
  assets: number;
  added: boolean;
  document_id: number | null;
}

/** An installed question bank: shipped sample or user-imported (0 token). */
export interface BuiltinBank {
  id: string;
  title: string;
  source: string;
  origin: "builtin" | "user";
  removable: boolean;
  units: BuiltinUnit[];
}

/** Result of installing a bank ZIP. */
export interface BankImportResult {
  bank_id: string;
  title: string;
  units: number;
  questions: number;
  assets: number;
}

/** Stored LLM API config — the key is write-only and always masked on read. */
export interface AppSettings {
  provider: string;
  protocol: string;
  base_url: string;
  model: string;
  api_key_masked: string;
  api_key_set: boolean;
  user_name: string;
  analysis_template: string;
  llm_fallback: boolean;
  vocab_ai_sense: boolean;
  vocab_auto_definition: boolean;
  vocab_learner_definitions: boolean;
  vocab_exam_ai_grading: boolean;
  custom_dictionary_enabled: boolean;
  show_builtin_library: boolean;
  dictionary_auto_lookup: boolean;
}

/** A model-service provider from the curated catalog (a service, not a protocol). */
export interface ProviderInfo {
  id: string;
  name: string;
  base_url: string;
  protocol: string;
  default_model: string | null;
  note: string;
}

export interface SettingsInput {
  provider?: string;
  base_url?: string;
  api_key?: string;
  model?: string;
  clear_key?: boolean;
  user_name?: string;
  analysis_template?: string;
  llm_fallback?: boolean;
  vocab_ai_sense?: boolean;
  vocab_auto_definition?: boolean;
  vocab_learner_definitions?: boolean;
  vocab_exam_ai_grading?: boolean;
  custom_dictionary_enabled?: boolean;
  show_builtin_library?: boolean;
  dictionary_auto_lookup?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = res.statusText || `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (body?.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

function json(body: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const api = {
  health: () => request<{ status: string; version: string; ocr: string[] }>("/api/health"),

  listDocuments: () => request<DocumentSummary[]>("/api/documents"),

  importDocument: async (file: File): Promise<DocumentSummary> => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentSummary>("/api/documents", { method: "POST", body: form });
  },

  /** Staged import pipeline (detect -> convert -> review -> commit). */
  createImport: async (file: File): Promise<ImportJob> => {
    const form = new FormData();
    form.append("file", file);
    return request<ImportJob>("/api/imports", { method: "POST", body: form });
  },

  getImport: (jobId: string) => request<ImportJob>(`/api/imports/${jobId}`),

  commitImport: (jobId: string) =>
    request<ImportJob>(`/api/imports/${jobId}/commit`, { method: "POST" }),

  cancelImport: (jobId: string) =>
    request<ImportJob>(`/api/imports/${jobId}/cancel`, { method: "POST" }),

  deleteImport: (jobId: string) =>
    request<{ deleted: string }>(`/api/imports/${jobId}`, { method: "DELETE" }),

  /** Trigger AI fallback for pages that had OCR issues. */
  aiFallbackImport: (jobId: string) =>
    request<ImportJob>(`/api/imports/${jobId}/ai-fallback`, { method: "POST" }),

  getDocument: (id: number) => request<DocumentSummary>(`/api/documents/${id}`),

  /** Rename/metadata patch; currently used to assign a subject. */
  setDocumentSubject: (id: number, subjectId: number | null) =>
    request<DocumentSummary>(`/api/documents/${id}`, {
      method: "PATCH",
      ...json({ subject_id: subjectId }),
    }),

  /** User-defined subject groups (global across papers). */
  listSubjects: () => request<Subject[]>("/api/subjects"),

  createSubject: (name: string, color?: SubjectColor) =>
    request<Subject>("/api/subjects", {
      method: "POST",
      ...json({ name, color }),
    }),

  updateSubject: (
    id: number,
    patch: { name?: string; color?: SubjectColor },
  ) =>
    request<Subject>(`/api/subjects/${id}`, {
      method: "PATCH",
      ...json(patch),
    }),

  deleteSubject: (id: number) =>
    request<{ deleted: number }>(`/api/subjects/${id}`, { method: "DELETE" }),

  /** Built-in banks shipped with the app — discovered server-side. */
  listBanks: () => request<BuiltinBank[]>("/api/builtin"),

  /** Add one built-in module to the library (idempotent, 0 token). */
  addBuiltinUnit: (bankId: string, unitId: string) =>
    request<{ document_id: number; added: boolean }>(
      `/api/builtin/${bankId}/units/${unitId}`,
      { method: "POST" },
    ),

  /** Add every not-yet-added module of a bank in one request. */
  addBuiltinAll: (bankId: string) =>
    request<{ added: number; already: number; document_ids: number[] }>(
      `/api/builtin/${bankId}/add-all`,
      { method: "POST" },
    ),

  /** Install a question-bank ZIP (manifest + units, or loose .ifmd.md files). */
  importBank: async (file: File): Promise<BankImportResult> => {
    const form = new FormData();
    form.append("file", file);
    return request<BankImportResult>("/api/builtin/import", {
      method: "POST",
      body: form,
    });
  },

  /** Remove a user-imported bank (shipped sample banks are read-only). */
  removeBank: (bankId: string) =>
    request<{ deleted: number }>(`/api/builtin/${bankId}`, { method: "DELETE" }),

  getQuestions: (id: number) => request<Question[]>(`/api/documents/${id}/questions`),

  putAnswers: (id: number, answers: Record<string, string[]>) =>
    request<DocumentSummary>(`/api/documents/${id}/answers`, {
      method: "PUT",
      ...json({ answers }),
    }),

  deleteDocument: (id: number) =>
    request<{ deleted: number }>(`/api/documents/${id}`, { method: "DELETE" }),

  startSession: (documentId: number) =>
    request<StartResponse>("/api/sessions", {
      method: "POST",
      ...json({ document_id: documentId }),
    }),

  /** Default timer for this paper, taken from its last submitted attempt. */
  getTimerPreference: (documentId: number) =>
    request<TimerPreference>(
      `/api/sessions/timer-preference?document_id=${documentId}`,
    ),

  /** Record the timer choice; it becomes the default for the next attempt. */
  setSessionTimer: (sessionId: number, mode: TimerMode, seconds: number | null) =>
    request<{ session_id: number; timer_mode: TimerMode; timer_seconds: number | null }>(
      `/api/sessions/${sessionId}/timer`,
      { method: "PATCH", ...json({ mode, seconds }) },
    ),

  submit: (sessionId: number, answers: Record<string, string | string[] | null>) =>
    request<SubmitResult>(`/api/sessions/${sessionId}/submit`, {
      method: "POST",
      ...json({ answers }),
    }),

  getSession: (sessionId: number) => request<SessionDetail>(`/api/sessions/${sessionId}`),

  /** Every saved attempt, newest first (the Sessions page). */
  listSessions: () => request<SessionSummary[]>("/api/sessions"),

  deleteSession: (sessionId: number) =>
    request<{ deleted: number }>(`/api/sessions/${sessionId}`, { method: "DELETE" }),

  /** Re-grade a submitted attempt (after the answer key was filled in). */
  regradeSession: (sessionId: number) =>
    request<SubmitResult>(`/api/sessions/${sessionId}/regrade`, { method: "POST" }),

  /** Review collections: latest wrong answers and explicitly starred questions. */
  listMistakes: () => request<ReviewItem[]>("/api/review/mistakes"),

  listStarredQuestions: () => request<ReviewItem[]>("/api/review/starred"),

  listStarredIds: (documentId: number) =>
    request<{ question_ids: number[] }>(
      `/api/review/starred/ids?document_id=${documentId}`,
    ),

  starQuestion: (questionId: number) =>
    request<{ question_id: number; starred: boolean }>(
      `/api/review/starred/${questionId}`,
      { method: "POST" },
    ),

  unstarQuestion: (questionId: number) =>
    request<{ question_id: number; starred: boolean }>(
      `/api/review/starred/${questionId}`,
      { method: "DELETE" },
    ),

  /** Hand-written explanation — saved straight to the DB (0 token). */
  saveExplain: (docId: number, questionId: number, content: string) =>
    request<{ question_id: number; explain: string | null }>(
      `/api/documents/${docId}/questions/${questionId}/explain`,
      { method: "PUT", ...json({ content }) },
    ),

  getWords: (docId: number) => request<WordGrid>(`/api/documents/${docId}/words`),

  putWords: (docId: number, grid: WordGrid) =>
    request<WordGrid>(`/api/documents/${docId}/words`, {
      method: "PUT",
      ...json(grid),
    }),

  wordsExportUrl: (docId: number) => `/api/documents/${docId}/words/export`,

  /** Add one structured word (de-duplicates by word; creates POS if needed). */
  addWordEntry: (docId: number, input: WordEntryInput) =>
    request<WordEntryResult>(`/api/documents/${docId}/words/entries`, {
      method: "POST",
      ...json(input),
    }),

  updateWordEntry: (
    docId: number,
    rowId: string,
    patch: Partial<Pick<WordEntryInput, "word" | "meaning" | "pos" | "notes">>,
  ) =>
    request<{ grid: WordGrid; row: VocabRow; row_id: string }>(
      `/api/documents/${docId}/words/entries/${rowId}`,
      { method: "PATCH", ...json(patch) },
    ),

  deleteWordEntry: (docId: number, rowId: string) =>
    request<{ grid: WordGrid; deleted: number }>(
      `/api/documents/${docId}/words/entries/${rowId}`,
      { method: "DELETE" },
    ),

  /** Drag-to-vocabulary: AI picks the Merriam-Webster sense for the context. */
  addWordFromSelection: (
    docId: number,
    input: { text: string; context?: string; question_id?: number | null },
  ) =>
    request<WordEntryResult>(`/api/documents/${docId}/words/entries/from-selection`, {
      method: "POST",
      ...json(input),
    }),

  /** Add the exact MW entry a user picked in dictionary lookup (0 token). */
  addWordFromEntry: (
    docId: number,
    input: {
      entry_id: number;
      context?: string;
      question_no?: number | null;
      source?: "standard" | "custom";
    },
  ) =>
    request<WordEntryResult>(`/api/documents/${docId}/words/entries/from-entry`, {
      method: "POST",
      ...json(input),
    }),

  /** Every exam's vocabulary list, with counts and a short preview. */
  getVocabulary: () => request<VocabularyOverview>("/api/vocabulary"),

  /** Build a word test from one exam's list (answers are withheld). */
  startWordExam: (
    docId: number,
    input: { mode: WordExamMode; count: number | null },
  ) =>
    request<WordExam>(`/api/documents/${docId}/word-exam`, {
      method: "POST",
      ...json(input),
    }),

  /** Grade a submitted word test (local, or AI when enabled in Settings). */
  gradeWordExam: (
    docId: number,
    input: { mode: WordExamMode; items: { row_id: string; response: string }[] },
  ) =>
    request<WordExamResult>(`/api/documents/${docId}/word-exam/grade`, {
      method: "POST",
      ...json(input),
    }),

  dictionaryStatus: () => request<DictionaryStatus>("/api/dictionary/status"),

  dictionaryLookup: (query: string, limit = 20) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return request<DictionaryLookup>(`/api/dictionary/lookup?${params}`);
  },

  /** The user's own dictionary (global, stored in app.db). */
  getCustomDictionary: (search = "", limit = 500) => {
    const params = new URLSearchParams({ q: search, limit: String(limit) });
    return request<CustomDictionary>(`/api/custom-dictionary?${params}`);
  },

  addCustomDictionaryEntry: (input: { word: string; definition: string; pos?: string }) =>
    request<CustomDictionaryEntry & { count: number }>("/api/custom-dictionary/entries", {
      method: "POST",
      ...json(input),
    }),

  deleteCustomDictionaryEntry: (entryId: number) =>
    request<{ deleted: number; count: number }>(
      `/api/custom-dictionary/entries/${entryId}`,
      { method: "DELETE" },
    ),

  importCustomDictionary: async (file: File): Promise<CustomDictionaryImport> => {
    const form = new FormData();
    form.append("file", file);
    return request<CustomDictionaryImport>("/api/custom-dictionary/import", {
      method: "POST",
      body: form,
    });
  },

  /** Export questions + answers + explanations as PDF/DOCX (0 token). */
  exportUrl: (docId: number, fmt: "pdf" | "docx") =>
    `/api/documents/${docId}/export/${fmt}`,

  /** Explicit AI call: context = material + stem + all options + correct answer + student's choice + section. */
  askAI: (docId: number, questionId: number, sessionId?: number) =>
    request<{ text: string }>("/api/ai/answer", {
      method: "POST",
      ...json({ document_id: docId, question_id: questionId, session_id: sessionId }),
    }),

  /** One exam's analysis notebook (one page per question, in question order). */
  getAnalysis: (docId: number) => request<AnalysisNotebook>(`/api/documents/${docId}/analysis`),

  /** Create or update one question's analysis page. */
  saveAnalysisPage: (docId: number, questionId: number, content: string) =>
    request<AnalysisPage>(`/api/documents/${docId}/analysis/${questionId}`, {
      method: "PUT",
      ...json({ content }),
    }),

  deleteAnalysisPage: (docId: number, questionId: number) =>
    request<{ deleted: number }>(`/api/documents/${docId}/analysis/${questionId}`, {
      method: "DELETE",
    }),

  /** Cover-page metadata: the display name plus this exam's attempts. */
  getAnalysisMeta: (docId: number) =>
    request<AnalysisMeta>(`/api/documents/${docId}/analysis-meta`),

  /** Notebook export URL (md | docx | pdf); a copy is also kept under data/exports. */
  analysisExportUrl: (
    docId: number,
    fmt: "md" | "docx" | "pdf",
    sessionId?: number,
    onlyAnalyzed = false,
  ) => {
    const params = new URLSearchParams();
    if (sessionId) params.set("session_id", String(sessionId));
    if (onlyAnalyzed) params.set("only_analyzed", "true");
    const query = params.toString();
    return `/api/documents/${docId}/analysis/export/${fmt}${query ? `?${query}` : ""}`;
  },

  /** Download the notebook and report the path of the server-side copy. */
  exportAnalysis: async (
    docId: number,
    fmt: "md" | "docx" | "pdf",
    sessionId?: number,
    onlyAnalyzed = false,
  ): Promise<{ path: string | null; filename: string }> => {
    const url = api.analysisExportUrl(docId, fmt, sessionId, onlyAnalyzed);
    const res = await fetch(url);
    if (!res.ok) {
      let detail = res.statusText || `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (typeof body?.detail === "string") detail = body.detail;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(detail, res.status);
    }
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match ? match[1] : `analysis.${fmt}`;
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
    return { path: res.headers.get("X-Export-Path"), filename };
  },

  history: (docId: number) =>
    request<
      { session_id: number; started_at: string; correct: number; graded: number }[]
    >(`/api/documents/${docId}/history`),

  getSettings: () => request<AppSettings>("/api/settings"),

  /** Curated model-service-provider catalog (OrcaRouter first). */
  listProviders: () => request<ProviderInfo[]>("/api/settings/providers"),

  saveSettings: (input: SettingsInput) =>
    request<AppSettings>("/api/settings", { method: "PUT", ...json(input) }),

  testSettings: (input: SettingsInput) =>
    request<ProbeResult>("/api/settings/test", { method: "POST", ...json(input) }),

  /** Resolve a markdown image path (`assets/x.png`) to its served URL. */
  assetUrl: (docId: number | undefined, src: string) =>
    docId && src.startsWith("assets/")
      ? `/api/documents/${docId}/assets/${src.slice("assets/".length)}`
      : src,
};
