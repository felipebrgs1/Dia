// Turns markdown text into positioned rows of styled pieces: headings bigger, links and
// syntax colored, code blocks and quotes marked. Pure (the measurer comes in), so the editor
// draws from it and the tests check it. Coordinates are local to the editor.

export type Role = "text" | "heading" | "muted" | "faint" | "accent" | "link" | "code" | "tag" | "strike" | "highlight";

export interface PieceStyle {
  role: Role;
  size: number;
  bold: boolean;
  italic?: boolean;
  /** Monospace font (code). */
  mono?: boolean;
  /** Background behind the piece (inline code, ==highlight==). */
  bg?: "code" | "highlight";
}

export interface Segment {
  start: number;
  end: number;
  /** What is drawn (tabs become spaces). */
  display: string;
  x: number;
  width: number;
  /** x of each caret position inside the piece, relative to `x` (length end - start + 1). */
  xs: number[];
  style: PieceStyle;
  /** Target of a `[[wikilink]]` (set on every piece of the link). */
  link?: string;
  url?: string;
}

export type Block = "none" | "code" | "quote" | "hr" | "frontmatter";

export interface Row {
  line: number;
  start: number;
  end: number;
  y: number;
  height: number;
  /** Top of the text inside the row. */
  textY: number;
  /** Where the caret goes on a row with no pieces (and where wrapped rows start). */
  indent: number;
  segments: Segment[];
  /** Last row of its line (the next row is a new line, not a wrap). */
  last: boolean;
}

export interface Line {
  start: number;
  end: number;
  block: Block;
  /** Indices into `rows`: [first, last]. */
  rows: [number, number];
}

export interface DocLayout {
  rows: Row[];
  lines: Line[];
  width: number;
  height: number;
}

export type Measure = (text: string, size: number, bold: boolean, font?: { italic?: boolean; mono?: boolean }) => { width: number; height: number };

const HEADING_SCALE = [1.75, 1.5, 1.3, 1.15, 1.05, 1];
const LINE_HEIGHT = 1.6;
const QUOTE_INDENT = 16;
const CODE_INDENT = 14;

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})(\s+)/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^(\s*>+\s?)/;
const LIST = /^(\s*)([-*+]|\d+[.)])( \[[ xX]\])?( )/;
const INLINE =
  /(`+)([^`\n]+?)\1|\[\[([^\[\]\n]+)\]\]|(\*\*|__)(?=\S)(.+?)(?<=\S)\4|(\*|_)(?=\S)([^*_\n]+?)(?<=\S)\6|~~(.+?)~~|==(.+?)==|\[([^\]\n]+)\]\(([^)\n]+)\)|(?<![\p{L}\p{N}_&#/])(#[\p{L}_][\p{L}\p{N}_/-]*)|(https?:\/\/[^\s)>\]]+)/gu;

/** Style of each character of a prose line (headings: bigger and bold). */
function styleLine(line: string, base: PieceStyle): { styles: PieceStyle[]; links: (string | undefined)[]; urls: (string | undefined)[] } {
  const styles: PieceStyle[] = new Array(line.length).fill(base);
  const links: (string | undefined)[] = new Array(line.length).fill(undefined);
  const urls: (string | undefined)[] = new Array(line.length).fill(undefined);
  const paint = (from: number, to: number, patch: Partial<PieceStyle>) => {
    for (let i = from; i < to; i++) styles[i] = { ...styles[i]!, ...patch };
  };
  const faint = { role: "faint" as Role, bg: undefined };

  let start = 0;
  const heading = HEADING.exec(line);
  if (heading) {
    paint(0, heading[0].length, faint);
    start = heading[0].length;
  } else {
    const quote = QUOTE.exec(line);
    if (quote) {
      paint(0, quote[0].length, faint);
      start = quote[0].length;
    }
    const list = LIST.exec(line.slice(start));
    if (list) {
      const markerEnd = start + list[1]!.length + list[2]!.length;
      paint(start + list[1]!.length, markerEnd, { role: "accent", bold: true });
      if (list[3]) {
        const done = list[3].trim() !== "[ ]";
        paint(markerEnd, markerEnd + list[3].length, { role: "accent" });
        if (done) paint(markerEnd + list[0].length - list[1]!.length - list[2]!.length, line.length, { role: "muted" });
      }
      start += list[0].length;
    }
  }

  INLINE.lastIndex = start;
  for (let m = INLINE.exec(line); m; m = INLINE.exec(line)) {
    const a = m.index;
    const b = a + m[0].length;
    if (m[1] !== undefined) {
      const n = m[1].length;
      paint(a, b, { role: "code", bg: "code", mono: true });
      paint(a, a + n, faint);
      paint(b - n, b, faint);
    } else if (m[3] !== undefined) {
      const target = m[3].split(/[|#]/)[0]!.trim();
      paint(a, b, { role: "link" });
      for (let i = a; i < b; i++) links[i] = target;
      paint(a, a + 2, faint);
      paint(b - 2, b, faint);
      const pipe = m[3].indexOf("|");
      if (pipe >= 0) paint(a + 2, a + 3 + pipe, faint);
    } else if (m[4] !== undefined) {
      paint(a, b, { bold: true });
      paint(a, a + 2, faint);
      paint(b - 2, b, faint);
    } else if (m[6] !== undefined) {
      paint(a, b, { italic: true });
      paint(a, a + 1, faint);
      paint(b - 1, b, faint);
    } else if (m[8] !== undefined) {
      paint(a, b, { role: "strike" });
      paint(a, a + 2, faint);
      paint(b - 2, b, faint);
    } else if (m[9] !== undefined) {
      paint(a + 2, b - 2, { bg: "highlight" });
      paint(a, a + 2, faint);
      paint(b - 2, b, faint);
    } else if (m[10] !== undefined) {
      paint(a, b, faint);
      paint(a + 1, a + 1 + m[10].length, { role: "link" });
      for (let i = a; i < b; i++) urls[i] = m[11];
    } else if (m[12] !== undefined) {
      paint(a, b, { role: "tag" });
    } else if (m[13] !== undefined) {
      paint(a, b, { role: "link" });
      for (let i = a; i < b; i++) urls[i] = m[13];
    }
  }
  return { styles, links, urls };
}

const sameStyle = (a: PieceStyle, b: PieceStyle) =>
  a.role === b.role && a.size === b.size && a.bold === b.bold && a.italic === b.italic && a.mono === b.mono && a.bg === b.bg;

export function layoutDocument(text: string, width: number, measure: Measure, baseSize = 16): DocLayout {
  const rows: Row[] = [];
  const lines: Line[] = [];
  const w = Math.max(width, 40);
  let y = 0;
  let inFence = false;
  let inFrontmatter = text.startsWith("---\n") || text === "---";
  let offset = 0;
  const all = text.split("\n");

  for (let li = 0; li < all.length; li++) {
    const line = all[li]!;
    const start = offset;
    offset += line.length + 1;

    // Block of the line.
    let block: Block = "none";
    let base: PieceStyle = { role: "text", size: baseSize, bold: false };
    let spaceAbove = 0;
    if (inFrontmatter) {
      block = "frontmatter";
      base = { role: "muted", size: baseSize * 0.9, bold: false, mono: true };
      if (li > 0 && line === "---") inFrontmatter = false;
    } else if (FENCE.test(line)) {
      block = "code";
      base = { role: "faint", size: baseSize * 0.9, bold: false, mono: true };
      inFence = !inFence;
    } else if (inFence) {
      block = "code";
      base = { role: "code", size: baseSize * 0.9, bold: false, mono: true };
    } else if (HR.test(line)) {
      block = "hr";
      base = { role: "faint", size: baseSize, bold: false };
    } else {
      const h = HEADING.exec(line);
      if (h) {
        base = { role: "heading", size: Math.round(baseSize * HEADING_SCALE[h[1]!.length - 1]!), bold: true };
        if (li > 0) spaceAbove = Math.round(base.size * 0.5);
      } else if (QUOTE.test(line)) block = "quote";
    }

    const plain = block === "code" || block === "frontmatter" || block === "hr";
    const { styles, links, urls } = plain
      ? { styles: new Array<PieceStyle>(line.length).fill(base), links: [], urls: [] }
      : styleLine(line, base);

    // Pieces: split where the style or link changes and after each run of spaces (wrap points).
    type Piece = { from: number; to: number; style: PieceStyle; link?: string; url?: string; breakAfter: boolean };
    const pieces: Piece[] = [];
    for (let i = 0; i < line.length; ) {
      const style = styles[i]!;
      let j = i + 1;
      while (j < line.length && sameStyle(styles[j]!, style) && links[j] === links[i] && urls[j] === urls[i]) {
        if (line[j - 1] === " " && line[j] !== " ") break;
        j++;
      }
      pieces.push({ from: i, to: j, style, link: links[i], url: urls[i], breakAfter: line[j - 1] === " " || j === line.length });
      i = j;
    }

    const lineHeight = Math.round(base.size * LINE_HEIGHT);
    const indent0 = block === "quote" ? QUOTE_INDENT : block === "code" || block === "frontmatter" ? CODE_INDENT : 0;
    // Wrapped rows of a list item line up with the text after the marker.
    const list = !plain && LIST.exec(line.replace(QUOTE, ""));
    let hang = indent0;
    const firstRow = rows.length;
    let row: Row | null = null;
    let x = 0;

    const newRow = (rowStart: number) => {
      if (row) row.end = start + rowStart;
      row = { line: li, start: start + rowStart, end: start + line.length, y: y + (rows.length === firstRow ? spaceAbove : 0), height: lineHeight, textY: 0, indent: rows.length === firstRow ? indent0 : hang, segments: [], last: false };
      if (rows.length === firstRow) y += spaceAbove;
      rows.push(row);
      y += lineHeight;
      x = row.indent;
      return row;
    };
    newRow(0);

    const toSegment = (p: Piece, from: number, to: number): Segment => {
      const raw = line.slice(from, to);
      const display = raw.replace(/\t/g, "    ");
      const xs = [0];
      for (let k = 1; k <= raw.length; k++) xs.push(measure(raw.slice(0, k).replace(/\t/g, "    "), p.style.size, p.style.bold, p.style).width);
      return { start: start + from, end: start + to, display, x: 0, width: xs[xs.length - 1]!, xs, style: p.style, link: p.link, url: p.url };
    };

    // Greedy wrap, one word (pieces up to a break) at a time.
    for (let pi = 0; pi < pieces.length; ) {
      let pj = pi;
      while (!pieces[pj]!.breakAfter) pj++;
      const word = pieces.slice(pi, pj + 1).map((p) => toSegment(p, p.from, p.to));
      const last = word[word.length - 1]!;
      const raw = line.slice(last.start - start, last.end - start);
      const trailing = raw.length - raw.trimEnd().length;
      const visible = word.reduce((a, s) => a + s.width, 0) - (last.width - last.xs[raw.length - trailing]!);
      if (x + visible > w && x > row!.indent) newRow(word[0]!.start - start);
      for (let si = 0; si < word.length; si++) {
        let seg = word[si]!;
        // A word longer than the whole row is cut where it fills the row.
        while (x + seg.width > w && seg.end - seg.start > 1 && seg.display.trim()) {
          let k = 1;
          while (k < seg.xs.length - 1 && x + seg.xs[k + 1]! <= w) k++;
          if (x + seg.xs[k]! > w && x > row!.indent) {
            newRow(seg.start - start);
            continue;
          }
          const p = pieces[pi + si]!;
          const head = toSegment(p, seg.start - start, seg.start - start + k);
          head.x = x;
          row!.segments.push(head);
          newRow(seg.start - start + k);
          seg = toSegment(p, seg.start - start + k, seg.end - start);
        }
        seg.x = x;
        row!.segments.push(seg);
        x += seg.width;
      }
      pi = pj + 1;
      if (list && hang === indent0) {
        const markerEnd = start + line.length - line.replace(QUOTE, "").length + list[0].length;
        const seg = rows[firstRow]!.segments.find((s) => s.start <= markerEnd && s.end >= markerEnd);
        if (seg) hang = seg.x + seg.xs[markerEnd - seg.start]!;
      }
    }

    for (let r = firstRow; r < rows.length; r++) {
      const rr = rows[r]!;
      const tallest = rr.segments.reduce((m, s) => Math.max(m, measure("Ag", s.style.size, s.style.bold, s.style).height), measure("Ag", base.size, base.bold, base).height);
      rr.textY = Math.round((rr.height - tallest) / 2);
    }
    rows[rows.length - 1]!.last = true;
    rows[rows.length - 1]!.end = start + line.length;
    lines.push({ start, end: start + line.length, block, rows: [firstRow, rows.length - 1] });
  }
  return { rows, lines, width: w, height: y };
}

/** Index of the row that shows the caret at `offset` (the start of a wrapped row wins). */
export function rowAt(layout: DocLayout, offset: number) {
  const rows = layout.rows;
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rows[mid]!.start <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function caretRect(layout: DocLayout, offset: number) {
  const row = layout.rows[rowAt(layout, offset)]!;
  return { x: xInRow(row, offset), y: row.y, height: row.height };
}

export function xInRow(row: Row, offset: number) {
  for (const s of row.segments) if (offset >= s.start && offset <= s.end) return s.x + s.xs[offset - s.start]!;
  const last = row.segments[row.segments.length - 1];
  return last && offset > last.end ? last.x + last.width : row.indent;
}

/** Nearest caret position to `x` in a row. */
export function offsetInRow(row: Row, x: number) {
  let best = row.start;
  let bestDist = Infinity;
  for (const s of row.segments) {
    for (let k = 0; k < s.xs.length; k++) {
      const d = Math.abs(s.x + s.xs[k]! - x);
      if (d < bestDist) {
        bestDist = d;
        best = s.start + k;
      }
    }
  }
  // A wrapped row ends where the next one starts: stay before the space that wrapped.
  if (!row.last && best >= row.end && row.end > row.start) best = row.end - 1;
  return best;
}

export function rowAtY(layout: DocLayout, y: number) {
  const rows = layout.rows;
  for (let i = 0; i < rows.length; i++) if (y < rows[i]!.y + rows[i]!.height) return i;
  return rows.length - 1;
}

export function hitTest(layout: DocLayout, x: number, y: number) {
  return offsetInRow(layout.rows[rowAtY(layout, y)]!, x);
}

/** The piece under a point, to follow links. */
export function segmentAt(layout: DocLayout, x: number, y: number): Segment | undefined {
  const row = layout.rows[rowAtY(layout, y)]!;
  if (y < row.y || y > row.y + row.height) return undefined;
  return row.segments.find((s) => x >= s.x && x <= s.x + s.width);
}
