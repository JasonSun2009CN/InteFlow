import RichText from "./RichText";
import AnnotatableText, { type HighlightInput } from "./AnnotatableText";
import type { QuestionHighlight } from "../api/client";
import { useI18n } from "../lib/i18n";

interface Props {
  material: string | null;
  /** Second text of a paired-passage question (SAT dual-text items). */
  material2?: string | null;
  docId?: number;
  textClassName?: string;
  /** When set, selecting passage text can create highlights for this question. */
  questionId?: number | null;
  highlights?: QuestionHighlight[];
  onCreateHighlight?: (input: HighlightInput) => Promise<void> | void;
  onHighlightError?: (message: string) => void;
}

/**
 * Reading material for one question. Single passages keep the "Passage"
 * heading; paired passages are stacked with "Text 1" / "Text 2" labels so the
 * student can tell which text a claim comes from.
 */
export default function PassageText({
  material,
  material2 = null,
  docId,
  textClassName = "text-base",
  questionId = null,
  highlights = [],
  onCreateHighlight,
  onHighlightError,
}: Props) {
  const { t } = useI18n();
  if (!material && !material2) return null;
  const label = "mb-2 text-xs font-medium text-slate-500";

  const body = (text: string, field: string) =>
    onCreateHighlight && questionId ? (
      <AnnotatableText
        text={text}
        docId={docId}
        field={field}
        questionId={questionId}
        highlights={highlights}
        onCreate={onCreateHighlight}
        onError={onHighlightError}
        breaks
      />
    ) : (
      <RichText text={text} docId={docId} breaks />
    );

  return (
    <>
      <div className={label}>{material2 ? t("Text 1") : t("Passage")}</div>
      <div className={textClassName}>{body(material ?? "", "material")}</div>
      {material2 && (
        <>
          <div className="my-4 border-t border-slate-200" />
          <div className={label}>{t("Text 2")}</div>
          <div className={textClassName}>{body(material2, "material2")}</div>
        </>
      )}
    </>
  );
}
