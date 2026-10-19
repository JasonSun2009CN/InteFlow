import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "./useCountUp";

const matchMedia = () => vi.mocked(window.matchMedia);

function mediaQueryList(matches: boolean, query: string): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
}

function mockReducedMotion(reduce: boolean) {
  matchMedia().mockImplementation((query: string) =>
    mediaQueryList(reduce && query.includes("prefers-reduced-motion"), query),
  );
}

afterEach(() => {
  // Restore the suite-wide default (no preference) rather than wiping the mock.
  mockReducedMotion(false);
  vi.useRealTimers();
});

describe("useCountUp", () => {
  it("shows nothing while the data is still loading", () => {
    const { result } = renderHook(() => useCountUp(null, { onceKey: "loading" }));

    expect(result.current).toBeNull();
  });

  it("lands on the exact number even when frames are throttled", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountUp(282, { onceKey: "throttled" }));

    // No animation frame ever runs in this case: only the settle timer can
    // save the number from being stranded part-way.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(282);
  });

  it("falls through intermediate values on the way", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountUp(100, { onceKey: "steps" }));

    act(() => {
      vi.advanceTimersByTime(300);
    });
    const midway = result.current ?? 0;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(midway).toBeGreaterThanOrEqual(0);
    expect(midway).toBeLessThanOrEqual(100);
    expect(result.current).toBe(100);
  });

  it("skips the tick when the user prefers reduced motion", () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useCountUp(27, { onceKey: "reduced" }));

    expect(result.current).toBe(27);
  });

  it("skips the tick for zero, and for a repeat visit in the same page load", () => {
    vi.useFakeTimers();
    const zero = renderHook(() => useCountUp(0, { onceKey: "zero" }));
    expect(zero.result.current).toBe(0);

    // First visit animates (or, here, settles) …
    const first = renderHook(() => useCountUp(9, { onceKey: "repeat" }));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(first.result.current).toBe(9);
    first.unmount();

    // … the second one shows the real number right away.
    const second = renderHook(() => useCountUp(9, { onceKey: "repeat" }));
    expect(second.result.current).toBe(9);
  });
});
