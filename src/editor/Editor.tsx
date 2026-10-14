// Multi-line markdown editor. nodebuilder's TextField is single-line, so this one draws the
// text itself on a <Canvas> (from the layout in layout.ts) and handles keys and the mouse
// on the Box around it. The caret is a separate small Box, so blinking does not redraw text.

import {
  Box,
  Canvas,
  type Child,
  Column,
  type DrawContext,
  type ElementRef,
  type KeyEvent,
  type PointerEvent,
  Scroll,
  clipboard,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  theme,
  untrack,
} from "@nodebuilderjs/core";
import { colors, roleColor } from "../theme.js";
import { type DocLayout, type Measure, caretRect, hitTest, layoutDocument, offsetInRow, rowAt, segmentAt, xInRow } from "./layout.js";
import { createDocument } from "./model.js";

export interface EditorApi {
  focus(): void;
  /** Puts the caret at `offset` and scrolls to it. */
  goto(offset: number): void;
  /** The [[link]] or URL under the caret, if any. */
  linkAtCaret(): string | undefined;
}

const MAX_WIDTH = 720;
const SIDE_PADDING = 40;
const FONT_SIZE = 16;
const MONO = "'JetBrains Mono', 'Fira Code', 'DejaVu Sans Mono', monospace";
const TASK = /^(\s*(?:>+\s?)?\s*(?:[-*+]|\d+[.)]) )\[[ xX/]\]/;

export function Editor(props: {
  path: () => string | null;
  load: (path: string) => string;
  /** The note's current text (tracked): changes made elsewhere show up in the editor. */
  text?: () => string;
  onChange: (path: string, text: string) => void;
  onOpenLink: (target: string) => void;
  onOpenUrl?: (url: string) => void;
  jump?: () => { path: string; offset: number } | null;
  /** Shown above the text, inside the scrolling area (the note title). */
  header?: Child;
  api?: (api: EditorApi) => void;
}) {
  const doc = createDocument();

  // Measuring: the real text measurer is only reachable from a Canvas draw, so until the
  // first draw an estimate is used; then the layout is computed again with real widths.
  let rawMeasure: Measure = (t, size) => ({ width: t.length * size * 0.55, height: Math.round(size * 1.25) });
  const fontOf = (font?: { italic?: boolean; mono?: boolean }) => ({ italic: font?.italic, family: font?.mono ? MONO : undefined });
  let realMetrics = false;
  const [metrics, setMetrics] = createSignal(0);
  const cache = new Map<string, { width: number; height: number }>();
  const measure: Measure = (t, size, bold, font) => {
    const key = `${size}${bold ? "b" : "r"}${font?.italic ? "i" : ""}${font?.mono ? "m" : ""}|${t}`;
    let m = cache.get(key);
    if (!m) {
      if (cache.size > 200_000) cache.clear();
      m = rawMeasure(t, size, bold, font);
      cache.set(key, m);
    }
    return m;
  };

  const [viewWidth, setViewWidth] = createSignal(800);
  const [viewHeight, setViewHeight] = createSignal(600);
  const [focused, setFocused] = createSignal(false);
  const [blink, setBlink] = createSignal(true);
  const [hoverLink, setHoverLink] = createSignal(false);
  const width = () => Math.max(160, Math.min(MAX_WIDTH, viewWidth() - SIDE_PADDING * 2));

  const layout = createMemo<DocLayout>(() => {
    metrics();
    return layoutDocument(doc.text(), width(), measure, FONT_SIZE);
  });

  let scroller: ElementRef | undefined;
  let box: ElementRef | undefined;
  let currentPath: string | null = null;
  let goalX: number | null = null;
  let dragging = false;

  // Opening another note loads its text (keeping the caret if only the name changed).
  createEffect(() => {
    const path = props.path();
    untrack(() => {
      if (path === currentPath) return;
      currentPath = path;
      const text = path ? props.load(path) : "";
      const jump = props.jump?.();
      if (text !== doc.text()) {
        doc.reset(text, jump?.path === path ? jump.offset : 0);
        scroller?.scrollTo(0);
      }
    });
  });
  createEffect(() => {
    const text = doc.text();
    if (currentPath) untrack(() => props.onChange(currentPath!, text));
  });
  createEffect(() => {
    const outside = props.text?.();
    if (outside !== undefined && untrack(() => props.path()) === currentPath) untrack(() => doc.sync(outside));
  });

  // Caret blink, restarted by every move.
  let timer: ReturnType<typeof setInterval> | undefined;
  createEffect(() => {
    doc.head();
    const on = focused();
    clearInterval(timer);
    setBlink(true);
    if (on) timer = setInterval(() => setBlink((b) => !b), 530);
  });
  onCleanup(() => clearInterval(timer));

  const caret = createMemo(() => caretRect(layout(), doc.head()));

  /** Scrolls the minimum needed for the caret to show. */
  const reveal = () => {
    if (!scroller || !box) return;
    const c = untrack(caret);
    const top = box.y - scroller.y + scroller.scrollY + c.y;
    const margin = 24;
    if (top - margin < scroller.scrollY) scroller.scrollTo(Math.max(0, top - margin));
    else if (top + c.height + margin > scroller.scrollY + scroller.height) scroller.scrollTo(top + c.height + margin - scroller.height);
  };

  const goto = (offset: number) => {
    doc.moveTo(offset);
    box?.focus();
    // After the next layout, the box has its position.
    queueMicrotask(reveal);
    setTimeout(reveal, 16);
  };

  // After goto exists: opening a note with a target offset (search hit, daily note) jumps there.
  createEffect(() => {
    const jump = props.jump?.();
    if (jump && jump.path === untrack(() => props.path())) untrack(() => goto(jump.offset));
  });

  const linkAt = (offset: number) => {
    const row = untrack(layout).rows[rowAt(untrack(layout), offset)]!;
    const seg = row.segments.find((s) => offset >= s.start && offset <= s.end && (s.link || s.url));
    return seg?.link ?? seg?.url;
  };

  props.api?.({ focus: () => box?.focus(), goto, linkAtCaret: () => linkAt(untrack(doc.head)) });

  const follow = (seg: { link?: string; url?: string }) => {
    if (seg.link) props.onOpenLink(seg.link);
    else if (seg.url) props.onOpenUrl?.(seg.url);
  };

  // ---- Mouse --------------------------------------------------------------------------

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const L = layout();
    const at = hitTest(L, e.localX, e.localY);
    goalX = null;
    if (e.clicks === 1) {
      const seg = segmentAt(L, e.localX, e.localY);
      // Clicking the link text follows it; clicking the brackets puts the caret there.
      if (seg && seg.style.role === "link" && (seg.link || seg.url)) return follow(seg);
      const ls = doc.lineStart(at);
      const task = TASK.exec(doc.text().slice(ls, doc.lineEnd(at)));
      if (task && at >= ls + task[1]!.length && at <= ls + task[0].length && doc.toggleTask(at)) return;
    }
    if (e.clicks === 2) {
      doc.select(doc.wordStart(Math.min(at + 1, doc.text().length)), doc.wordEnd(at));
    } else if (e.clicks >= 3) {
      const end = doc.lineEnd(at);
      doc.select(doc.lineStart(at), Math.min(end + 1, doc.text().length));
    } else {
      doc.moveTo(at);
      dragging = true;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const L = layout();
    if (dragging && e.button === 0) {
      doc.moveTo(hitTest(L, e.localX, e.localY), true);
      reveal();
      return;
    }
    const seg = segmentAt(L, e.localX, e.localY);
    setHoverLink(!!seg && seg.style.role === "link" && !!(seg.link || seg.url));
  };

  // ---- Keyboard -----------------------------------------------------------------------

  const copy = () => {
    const text = doc.selectedText();
    if (text) clipboard.writeText(text);
    return !!text;
  };
  const paste = async () => {
    const text = (await clipboard.readText()).replace(/\r\n?/g, "\n");
    if (text) {
      doc.insertText(text);
      reveal();
    }
  };

  const vertical = (rows: number, extend: boolean) => {
    const L = layout();
    const head = doc.head();
    const i = rowAt(L, head);
    if (goalX === null) goalX = xInRow(L.rows[i]!, head);
    const j = Math.max(0, Math.min(L.rows.length - 1, i + rows));
    if (j === i) return doc.moveTo(rows < 0 ? 0 : doc.text().length, extend);
    doc.moveTo(offsetInRow(L.rows[j]!, goalX), extend);
  };

  const onKeyDown = (e: KeyEvent) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const shift = e.shift;
    const keepGoal = key === "Up" || key === "Down" || key === "Prior" || key === "Next";
    if (!keepGoal) goalX = null;

    if (e.ctrl) {
      switch (key) {
        case "a": doc.selectAll(); break;
        case "c": copy(); break;
        case "x": if (copy()) doc.insertText(""); break;
        case "v": void paste(); break;
        case "z": shift ? doc.redo() : doc.undo(); break;
        case "y": doc.redo(); break;
        case "b": doc.wrap("**"); break;
        case "i": doc.wrap("*"); break;
        case "Return":
        case "KP_Enter": {
          const link = linkAt(doc.head());
          if (link) props.onOpenLink(link);
          break;
        }
        case "Left": doc.moveTo(doc.wordStart(doc.head()), shift); break;
        case "Right": doc.moveTo(doc.wordEnd(doc.head()), shift); break;
        case "BackSpace": doc.backspace(true); break;
        case "Delete": doc.deleteForward(true); break;
        case "Home": doc.moveTo(0, shift); break;
        case "End": doc.moveTo(doc.text().length, shift); break;
        default: return; // app shortcuts (Ctrl+O, Ctrl+N...) go up to the App
      }
      e.stop();
      reveal();
      return;
    }

    const [from, to] = doc.selection();
    const L = layout();
    switch (key) {
      case "Left":
        if (from !== to && !shift) doc.moveTo(from);
        else doc.moveTo(doc.prev(doc.head()), shift);
        break;
      case "Right":
        if (from !== to && !shift) doc.moveTo(to);
        else doc.moveTo(doc.next(doc.head()), shift);
        break;
      case "Up": vertical(-1, shift); break;
      case "Down": vertical(1, shift); break;
      case "Prior":
      case "Next": {
        const page = Math.max(1, Math.floor((scroller?.height ?? viewHeight()) / (FONT_SIZE * 1.6)) - 2);
        vertical(key === "Prior" ? -page : page, shift);
        break;
      }
      case "Home": {
        const row = L.rows[rowAt(L, doc.head())]!;
        doc.moveTo(row.start, shift);
        break;
      }
      case "End": {
        const row = L.rows[rowAt(L, doc.head())]!;
        doc.moveTo(row.last ? row.end : row.end - 1, shift);
        break;
      }
      case "BackSpace": doc.backspace(); break;
      case "Delete":
      case "KP_Delete": doc.deleteForward(); break;
      case "Return":
      case "KP_Enter": doc.newline(); break;
      case "Tab": shift ? doc.outdent() : doc.indent(); break;
      case "ISO_Left_Tab": doc.outdent(); break;
      case "Escape": return;
      default: {
        if (!e.text) return;
        const text = doc.text();
        const head = doc.head();
        // "[" pairs with "]" (so "[[" makes "[[]]"); typing "]" over a "]" steps over it.
        if (e.text === "]" && from === to && text[head] === "]") doc.moveTo(head + 1);
        else if (e.text === "[" && from === to) {
          doc.insertText("[]");
          doc.moveTo(head + 1);
        } else doc.insertText(e.text);
      }
    }
    e.stop();
    reveal();
  };

  // ---- Drawing ------------------------------------------------------------------------

  const draw = (g: DrawContext) => {
    if (!realMetrics) {
      realMetrics = true;
      rawMeasure = (t, size, bold, font) => g.measureText(t, size, bold, fontOf(font));
      cache.clear();
      queueMicrotask(() => setMetrics(1));
    }
    const L = layout();
    const [from, to] = doc.selection();

    // Blocks: code (one rounded box per run of lines), quotes and horizontal rules.
    for (let i = 0; i < L.lines.length; i++) {
      const line = L.lines[i]!;
      const first = L.rows[line.rows[0]]!;
      if (line.block === "code" || line.block === "frontmatter") {
        let j = i;
        while (j + 1 < L.lines.length && L.lines[j + 1]!.block === line.block) j++;
        const last = L.rows[L.lines[j]!.rows[1]]!;
        g.rect(0, first.y, L.width, last.y + last.height - first.y, colors.codeBg, 6);
        i = j;
      } else if (line.block === "quote") {
        const last = L.rows[line.rows[1]]!;
        g.rect(0, first.y + 2, 3, last.y + last.height - first.y - 4, theme.accent.base, 1.5);
      } else if (line.block === "hr") {
        const end = first.segments.reduce((m, s) => Math.max(m, s.x + s.width), 0);
        const y = Math.round(first.y + first.height / 2);
        g.rect(end + 12, y, Math.max(0, L.width - end - 12), 1, colors.border);
      }
    }

    // Selection.
    if (from !== to) {
      for (let r = rowAt(L, from); r < L.rows.length; r++) {
        const row = L.rows[r]!;
        if (row.start > to) break;
        const a = Math.max(from, row.start);
        const x0 = xInRow(row, a);
        const x1 = to > row.end || (to === row.end && !row.last) ? xInRow(row, row.end) + (row.last ? 6 : 0) : xInRow(row, to);
        if (x1 > x0) g.rect(x0, row.y, x1 - x0, row.height, theme.selection);
      }
    }

    for (const row of L.rows) {
      for (const s of row.segments) {
        const h = measure("Ag", s.style.size, s.style.bold, s.style).height;
        const y = row.y + Math.round((row.height - h) / 2);
        const visible = s.display.trimEnd();
        if (s.style.bg && visible) {
          const w = s.xs[visible.length] ?? s.width;
          g.rect(s.x - 2, y - 1, w + 4, h + 2, s.style.bg === "code" ? colors.codeBg : colors.highlight, 3);
        }
        if (!visible) continue;
        g.text(s.display, s.x, y, roleColor(s.style.role), s.style.size, s.style.bold, fontOf(s.style));
        if (s.style.role === "strike") g.rect(s.x, y + h / 2, s.xs[visible.length] ?? s.width, 1, theme.text.secondary);
      }
    }
  };

  return (
    <Scroll
      grow={1}
      background={() => colors.page}
      ref={(el) => (scroller = el)}
      onResize={(s) => (setViewWidth(s.width), setViewHeight(s.height))}
    >
      <Column align="center" padding={[24, 0, 0, 0]}>
        <Column width={width}>{props.header}</Column>
        <Box
          ref={(el) => (box = el)}
          focusable
          tabStop
          width={width}
          height={() => layout().height + Math.round(viewHeight() * 0.4)}
          cursor={() => (hoverLink() ? "pointer" : "text")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (dragging = false)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          <Canvas grow={1} draw={draw} />
          <Box
            position="absolute"
            left={() => Math.round(caret().x)}
            top={() => caret().y + 3}
            width={2}
            height={() => caret().height - 6}
            background={() => (focused() && blink() ? theme.accent.base : "#00000000")}
          />
        </Box>
      </Column>
    </Scroll>
  );
}
