import RichText from "./RichText";
import { useI18n } from "../lib/i18n";

interface Props {
  material: string | null;
  /** Second text of a paired-passage question (SAT dual-text items). */
  material2?: string | null;
  docId?: number;
  textClassName?: string;
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
  textClassName = "text-[15px]",
}: Props) {
  const { t } = useI18n();
  if (!material && !material2) return null;
  const label =
    "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500";
  return (
    <>
      <div className={label}>{material2 ? t("Text 1") : t("Passage")}</div>
      <div className={textClassName}>
        <RichText text={material ?? ""} docId={docId} breaks />
      </div>
      {material2 && (
        <>
          <div className="my-4 border-t border-slate-200" />
          <div className={label}>{t("Text 2")}</div>
          <div className={textClassName}>
            <RichText text={material2} docId={docId} breaks />
          </div>
        </>
      )}
    </>
  );
}
