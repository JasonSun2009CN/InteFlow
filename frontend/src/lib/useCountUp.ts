import { useEffect, useState } from "react";

/**
 * Counts up to a target number — the little "tick" the exam stats make when the
 * list finishes loading.
 *
 * Two details matter for it to feel right rather than broken:
 *
 * * it always lands on the exact number (a timer settles the value even if
 *   animation frames are throttled in a background tab), and
 * * it plays once per page load — coming back from another tab shows the real
 *   numbers straight away instead of re-running the whole tick.
 *
 * `prefers-reduced-motion` skips it entirely.
 */

/** Keys that already played to completion during this page load. */
const played = new Set<string>();

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface CountUpOptions {
  /** Milliseconds for the full count. */
  duration?: number;
  /** Play-once key; distinct keys animate independently. */
  onceKey?: string;
}

/**
 * Returns the number to render: `null` while `target` is `null` (loading),
 * otherwise a value that grows from 0 to `target`.
 */
export function useCountUp(
  target: number | null,
  { duration = 600, onceKey = "default" }: CountUpOptions = {},
): number | null {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (target === null) {
      setValue(null);
      return;
    }

    // Zero has nothing to count to, and repeated visits shouldn't re-run it.
    if (prefersReducedMotion() || target === 0 || played.has(onceKey)) {
      setValue(target);
      return;
    }

    let frame = 0;
    let started: number | null = null;
    let settled = false;

    const settle = () => {
      if (settled) return;
      settled = true;
      played.add(onceKey);
      setValue(target);
    };

    // Frames can be throttled or dropped; land on the real number regardless.
    const timer = window.setTimeout(settle, duration + 100);

    const step = (now: number) => {
      if (settled) return;
      if (started === null) started = now;
      const progress = Math.min((now - started) / duration, 1);
      if (progress >= 1) {
        settle();
        return;
      }
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [target, duration, onceKey]);

  if (target === null) return null;
  return value ?? 0;
}
