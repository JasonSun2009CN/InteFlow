import type { HighlightColor } from "../api/client";

/**
 * Highlights are stored as a normalized quotation + occurrence index, never as
 * raw Markdown offsets. Markdown syntax is invisible when rendered, so offsets
 * in the source cannot be mapped back reliably. Finding the quote again in the
 * visible text survives re-renders, edits to surrounding text, and the
 * difference between practice and review surfaces.
 */

const registry = new Map<string, { color: HighlightColor; range: Range }[]>();

function cssHighlights(): {
  set: (name: string, value: unknown) => void;
  delete: (name: string) => void;
} | null {
  const api = (globalThis as { CSS?: { highlights?: unknown } }).CSS
    ?.highlights as
    | { set: (name: string, value: unknown) => void; delete: (name: string) => void }
    | undefined;
  return api ?? null;
}

function HighlightCtor(): (new (...ranges: Range[]) => unknown) | null {
  const ctor = (globalThis as { Highlight?: unknown }).Highlight;
  return typeof ctor === "function"
    ? (ctor as new (...ranges: Range[]) => unknown)
    : null;
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  "yellow",
  "green",
  "blue",
  "pink",
];

export function highlightClass(color: HighlightColor): string {
  return `if-hl-${color}`;
}

function rebuild(): void {
  const api = cssHighlights();
  const Highlight = HighlightCtor();
  if (!api || !Highlight) return;

  for (const color of HIGHLIGHT_COLORS) {
    const ranges: Range[] = [];
    for (const entries of registry.values()) {
      for (const entry of entries) {
        if (entry.color === color) ranges.push(entry.range);
      }
    }
    if (ranges.length === 0) {
      api.delete(highlightClass(color));
    } else {
      api.set(highlightClass(color), new Highlight(...ranges));
    }
  }
}

export function registerHighlights(
  key: string,
  items: { color: HighlightColor; range: Range }[],
): void {
  if (items.length === 0) registry.delete(key);
  else registry.set(key, items);
  rebuild();
}

export function clearHighlights(key: string): void {
  registry.delete(key);
  rebuild();
}

/**
 * Collapse whitespace and remember where every normalized character came from.
 * `map[i]` is the index in the original string of normalized character `i`.
 */
export function normalizeWithMap(raw: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (/\s/.test(ch)) {
      pendingSpace = text.length > 0;
      continue;
    }
    if (pendingSpace) {
      text += " ";
      map.push(i);
      pendingSpace = false;
    }
    text += ch;
    map.push(i);
  }
  return { text, map };
}

function rawToNormalized(map: number[], rawOffset: number): number {
  let low = 0;
  let high = map.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (map[mid] < rawOffset) low = mid + 1;
    else high = mid;
  }
  return low;
}

function offsetWithin(container: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  try {
    range.setEnd(node, offset);
  } catch {
    return 0;
  }
  return range.toString().length;
}

function textNodes(container: Node): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    out.push(node as Text);
    node = walker.nextNode();
  }
  return out;
}

function rangeAtOffsets(container: Node, start: number, end: number): Range | null {
  const nodes = textNodes(container);
  let pos = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  for (const node of nodes) {
    const length = node.data.length;
    if (startNode === null && pos + length >= start) {
      startNode = node;
      startOffset = Math.max(0, start - pos);
    }
    if (endNode === null && pos + length >= end) {
      endNode = node;
      endOffset = Math.max(0, end - pos);
      break;
    }
    pos += length;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, Math.min(startOffset, startNode.data.length));
  range.setEnd(endNode, Math.min(endOffset, endNode.data.length));
  return range;
}

export interface SelectionInfo {
  quote: string;
  occurrence: number;
  start: number;
  end: number;
  rect: DOMRect;
}

/** Turn the current browser selection inside `container` into storage data. */
export function selectionInfo(
  container: HTMLElement,
  range: Range,
): SelectionInfo | null {
  if (!container.contains(range.commonAncestorContainer)) return null;
  const raw = container.textContent ?? "";
  const start = offsetWithin(container, range.startContainer, range.startOffset);
  const end = offsetWithin(container, range.endContainer, range.endOffset);
  if (end <= start) return null;

  const selected = raw.slice(start, end);
  const normalized = normalizeWithMap(selected);
  const quote = normalized.text.trim();
  if (!quote) return null;

  const whole = normalizeWithMap(raw);
  const normStart = rawToNormalized(whole.map, start);
  const prefix = whole.text.slice(0, normStart);
  let occurrence = 0;
  let at = prefix.indexOf(quote);
  while (at !== -1) {
    occurrence += 1;
    at = prefix.indexOf(quote, at + Math.max(quote.length, 1));
  }

  const leading = normalized.text.length - normalized.text.trimStart().length;
  const trailing = normalized.text.length - normalized.text.trimEnd().length;
  const quoteStart = normStart + leading;
  const quoteEnd = rawToNormalized(whole.map, end) - trailing;
  const rect =
    typeof range.getBoundingClientRect === "function"
      ? range.getBoundingClientRect()
      : ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect);
  return {
    quote,
    occurrence,
    start: whole.map[quoteStart] ?? start,
    end: whole.map[Math.max(quoteEnd - 1, quoteStart)] ?? end,
    rect,
  };
}

/** Find the Range for one stored highlight inside a freshly rendered field. */
export function quoteRange(
  container: HTMLElement,
  quote: string,
  occurrence: number,
): Range | null {
  const raw = container.textContent ?? "";
  const whole = normalizeWithMap(raw);
  const needle = normalizeWithMap(quote).text.trim();
  if (!needle) return null;
  let at = whole.text.indexOf(needle);
  for (let n = 0; n < occurrence && at !== -1; n += 1) {
    at = whole.text.indexOf(needle, at + Math.max(needle.length, 1));
  }
  if (at === -1) at = whole.text.indexOf(needle);
  if (at === -1) return null;
  const startRaw = whole.map[at];
  const endRaw = whole.map[at + needle.length - 1];
  if (startRaw === undefined || endRaw === undefined) return null;
  return rangeAtOffsets(container, startRaw, endRaw + 1);
}

export function scrollToQuote(
  container: HTMLElement,
  quote: string,
  occurrence: number,
): void {
  const range = quoteRange(container, quote, occurrence);
  if (!range) return;
  const element =
    range.startContainer.parentElement ?? container;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}
