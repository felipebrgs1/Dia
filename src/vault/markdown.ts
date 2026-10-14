// Markdown facts the app needs outside the editor: wikilinks, headings, tags and names.

export interface WikiLink {
  /** The note name or path inside `[[...]]`, without `#heading` or `|alias`. */
  target: string;
  heading?: string;
  alias?: string;
  start: number;
  end: number;
}

export interface Heading {
  level: number;
  text: string;
  offset: number;
}

const WIKILINK = /\[\[([^\[\]|#\n]*)(?:#([^\[\]|\n]*))?(?:\|([^\[\]\n]*))?\]\]/g;
const FENCE = /^\s*(```|~~~)/;
const TAG = /(?<![\p{L}\p{N}_&#/])#([\p{L}_][\p{L}\p{N}_/-]*)/gu;

/** The note's name: the file name without folder and `.md`. */
export function noteName(path: string) {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.endsWith(".md") ? base.slice(0, -3) : base;
}

export function folderOf(path: string) {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

/** Calls `fn` for each line outside fenced code blocks. */
function eachProseLine(text: string, fn: (line: string, offset: number) => void) {
  let inFence = false;
  let offset = 0;
  for (const line of text.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    else if (!inFence) fn(line, offset);
    offset += line.length + 1;
  }
}

export function parseLinks(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  eachProseLine(text, (line, offset) => {
    for (const m of line.matchAll(WIKILINK)) {
      const target = m[1]!.trim();
      if (!target) continue;
      out.push({ target, heading: m[2]?.trim() || undefined, alias: m[3]?.trim() || undefined, start: offset + m.index!, end: offset + m.index! + m[0].length });
    }
  });
  return out;
}

export function parseHeadings(text: string): Heading[] {
  const out: Heading[] = [];
  eachProseLine(text, (line, offset) => {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) out.push({ level: m[1]!.length, text: m[2]!.trim(), offset });
  });
  return out;
}

export interface Task {
  /** Offset of the line start: what `toggleTask` takes. */
  offset: number;
  done: boolean;
  /** The task text, without the checkbox and the due date. */
  text: string;
  /** "YYYY-MM-DD" from `📅 2026-10-14` (the Obsidian Tasks format) or `@2026-10-14`. */
  due?: string;
}

const TASK = /^\s*(?:[-*+]|\d+[.)]) \[([ xX])\] (.*)$/;
const DUE = /\s*(?:📅\s*|@)(\d{4}-\d{2}-\d{2})/u;

export function parseTasks(text: string): Task[] {
  const out: Task[] = [];
  eachProseLine(text, (line, offset) => {
    const m = TASK.exec(line);
    if (!m) return;
    const due = DUE.exec(m[2]!);
    const body = plainText(due ? m[2]!.replace(due[0], "") : m[2]!).trim();
    if (body || due) out.push({ offset, done: m[1] !== " ", text: body, due: due?.[1] });
  });
  return out;
}

/** Switches the checkbox of the task line starting at `offset`; the text is unchanged if it is not a task. */
export function toggleTaskAt(text: string, offset: number) {
  const end = text.indexOf("\n", offset);
  const line = text.slice(offset, end < 0 ? text.length : end);
  const m = /^(\s*(?:[-*+]|\d+[.)]) \[)([ xX])\]/.exec(line);
  if (!m) return text;
  const at = offset + m[1]!.length;
  return text.slice(0, at) + (m[2] === " " ? "x" : " ") + text.slice(at + 1);
}

export function parseTags(text: string): string[] {
  const out = new Set<string>();
  eachProseLine(text, (line) => {
    if (/^#{1,6}\s/.test(line)) line = line.replace(/^#+/, "");
    for (const m of line.matchAll(TAG)) out.add(m[1]!);
  });
  return [...out];
}

/**
 * Which note a link points to: an exact path (with or without `.md`) or, as in Obsidian, any
 * note with that name; the shortest path wins when several match. Case does not matter.
 */
export function resolveLink(target: string, paths: readonly string[]): string | undefined {
  const t = target.toLowerCase().replace(/\.md$/, "");
  let best: string | undefined;
  for (const p of paths) {
    const lower = p.toLowerCase().replace(/\.md$/, "");
    if (lower === t) return p;
    if (noteName(lower) === t && (!best || p.length < best.length)) best = p;
  }
  return best;
}

/** Rewrites `[[old]]`, `[[old#h]]` and `[[old|alias]]` to point to `next`. */
export function renameLinks(text: string, old: string, next: string) {
  const o = old.toLowerCase();
  return text.replace(WIKILINK, (all, target: string, heading?: string, alias?: string) => {
    const t = target.trim().toLowerCase().replace(/\.md$/, "");
    if (t !== o && noteName(t) !== o) return all;
    return `[[${next}${heading !== undefined ? `#${heading}` : ""}${alias !== undefined ? `|${alias}` : ""}]]`;
  });
}

/** Inline markdown as plain text, for lists: `[[a|b]]` → b, `**x**` → x, `` `c` `` → c. */
export function plainText(text: string) {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, t: string) => t.split("#")[0]!)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__|~~|==|`)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_]([^*_]+)[*_]/g, "$1$2");
}

export function countWords(text: string) {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
}
