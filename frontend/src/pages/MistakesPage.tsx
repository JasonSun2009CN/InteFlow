/**
 * Placeholder for the mistake-analysis collection.
 *
 * Will gather every missed question across all practice sessions, de-duplicate
 * repeated misses, and allow filtering by exam and section. Spec: AGENT.md §5.
 */
export default function MistakesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
      <header className="max-w-2xl">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400">
          Review
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Mistake analysis</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Every question you have missed, gathered across all practice sessions. It will
          de-duplicate repeated misses and let you filter by exam and section.
        </p>
      </header>

      <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
        <p className="font-display text-2xl tracking-tight text-slate-700">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Practice an exam and your wrong answers will collect here automatically.
        </p>
      </div>
    </div>
  );
}
