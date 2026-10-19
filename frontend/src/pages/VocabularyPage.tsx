/**
 * Placeholder for the vocabulary collection.
 *
 * Each exam keeps its own word list (the review workspace's vocabulary sheet);
 * re-practising that exam edits the same list rather than starting a new one.
 * This screen will index those per-exam lists in one place. Spec: AGENT.md §5.
 */
export default function VocabularyPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <header className="max-w-2xl">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
          Reference
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Vocabulary</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Each exam keeps its own word list. Coming soon — this screen will index the lists
          from every exam, and adding words while re-practising updates the same exam&apos;s
          list.
        </p>
      </header>

      <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
        <p className="font-display text-2xl tracking-tight text-slate-700">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Add words from the review workspace and they will appear in this collection.
        </p>
      </div>
    </div>
  );
}
