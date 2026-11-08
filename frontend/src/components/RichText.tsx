import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { api } from "../api/client";

interface Props {
  text: string;
  /** Document id, used to resolve `assets/...` image paths. */
  docId?: number;
  /** Render single newlines as hard breaks (hand-written prose, not source text). */
  breaks?: boolean;
}

/**
 * Markdown elements that never depend on props. Kept at module scope so their
 * identity is stable: react-markdown treats a new component function as a new
 * element type, which remounts images on every parent render. In the practice
 * timer that meant an image reload (and a collapsing passage) once a second.
 */
const BASE_COMPONENTS: Components = {
  p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-6">{children}</ol>,
  ul: ({ children }) => <ul className="my-2 list-disc pl-6">{children}</ul>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h3 className="my-2 text-lg font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="my-2 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h3 className="my-2 text-base font-semibold">{children}</h3>,
  // Imported exam text uses <u>…</u> for source underlines. These tags are the
  // only raw HTML we intentionally allow; rehype-sanitize drops everything else.
  u: ({ children }) => <u className="underline decoration-1 underline-offset-2">{children}</u>,
  s: ({ children }) => <s className="line-through">{children}</s>,
  del: ({ children }) => <del className="line-through">{children}</del>,
};

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u", "s", "mark"],
  attributes: {
    ...defaultSchema.attributes,
    u: ["className"],
    s: ["className"],
    mark: ["className", "data-color"],
  },
};

/** Markdown + `$math$` renderer shared by every question surface. */
function RichText({ text, docId, breaks = false }: Props) {
  const components = useMemo<Components>(
    () => ({
      ...BASE_COMPONENTS,
      img: ({ src, alt }) => (
        <img
          src={api.assetUrl(docId, String(src ?? ""))}
          alt={alt ?? "figure"}
          className="my-2 h-auto max-w-full rounded"
          loading="lazy"
          decoding="async"
        />
      ),
    }),
    [docId],
  );

  return (
    <ReactMarkdown
      remarkPlugins={breaks ? [remarkMath, remarkBreaks] : [remarkMath]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, SANITIZE_SCHEMA],
        [rehypeKatex, { throwOnError: false, strict: false }],
      ]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
}

/**
 * Memoised: question surfaces re-render on unrelated state changes (countdown
 * ticks, answer selection, marks). Without this, the whole Markdown tree —
 * including `<img>` elements — was rebuilt every second.
 */
export default memo(RichText);
