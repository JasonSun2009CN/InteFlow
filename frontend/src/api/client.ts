/** Typed client for the FastAPI backend (all paths proxied by Vite in dev). */

/** A question's section is a free-form label (rw | math | physics | ...). */
export type Section = string;
export type AnswersStatus = "inline" | "external" | "none";

export interface DocumentSummary {
  id: number;
  title: string;
  source_filename: string;
  answers_status: AnswersStatus;
  question_count: number;
  answered_count: number;
  needs_answers: boolean;
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
  document: DocumentSummary;
  questions: QuizQuestion[];
}

export interface ResultItem {
  question_id: number;
  no: number;
  source_no: number | null;
  sec: Section;
  kind: QuestionKind;
  multi: boolean;
  material: string | null;
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

/** A question bank shipped with the app (offline, 0 token). */
export interface BuiltinBank {
  id: string;
  title: string;
  source: string;
  units: BuiltinUnit[];
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
  llm_fallback: boolean;
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
  llm_fallback?: boolean;
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
