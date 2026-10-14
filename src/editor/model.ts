// The text being edited, the selection and undo, with no drawing: the Editor widget
// translates keys and clicks into these operations, and the tests call them directly.
// Offsets are indices into the string (UTF-16), always kept on code point boundaries.

import { batch, createSignal, untrack } from "@nodebuilderjs/core";

interface Snapshot {
  text: string;
  anchor: number;
  head: number;
}

type EditKind = "type" | "delete" | "other";

const LIST = /^(\s*)([-*+]|(\d+)([.)]))( \[[ xX]\])? /;
const WORD = /[\p{L}\p{N}_]/u;
const INDENT = "    ";

export function createDocument(initial = "") {
  const [text, setText] = createSignal(initial);
  const [anchor, setAnchor] = createSignal(0);
  const [head, setHead] = createSignal(0);
  let undoStack: Snapshot[] = [];
  let redoStack: Snapshot[] = [];
  let lastKind: EditKind = "other";
  let lastTime = 0;

  const t = () => untrack(text);
  const snapshot = (): Snapshot => ({ text: t(), anchor: untrack(anchor), head: untrack(head) });
  const restore = (s: Snapshot) => batch(() => (setText(s.text), setAnchor(s.anchor), setHead(s.head)));

  const selection = (): [number, number] => {
    const a = anchor();
    const h = head();
    return a < h ? [a, h] : [h, a];
  };
  const hasSelection = () => anchor() !== head();

  /** One code point to the left/right of `at`. */
  const prev = (at: number) => {
    const s = t();
    if (at <= 0) return 0;
    const c = s.charCodeAt(at - 1);
    return c >= 0xdc00 && c <= 0xdfff && at >= 2 ? at - 2 : at - 1;
  };
  const next = (at: number) => {
    const s = t();
    if (at >= s.length) return s.length;
    const c = s.charCodeAt(at);
    return c >= 0xd800 && c <= 0xdbff && at + 1 < s.length ? at + 2 : at + 1;
  };
  const lineStart = (at: number) => t().lastIndexOf("\n", at - 1) + 1;
  const lineEnd = (at: number) => {
    const i = t().indexOf("\n", at);
    return i < 0 ? t().length : i;
  };

  /** The one edit primitive: replaces [from, to) and puts the caret at `caret`. */
  const replace = (from: number, to: number, insert: string, caret = from + insert.length, kind: EditKind = "other") => {
    const now = Date.now();
    // Consecutive typing (or deleting) within a second is undone in one step.
    if (kind === "other" || kind !== lastKind || now - lastTime > 1000) undoStack.push(snapshot());
    if (undoStack.length > 500) undoStack.shift();
    redoStack = [];
    lastKind = kind;
    lastTime = now;
    const s = t();
    batch(() => {
      setText(s.slice(0, from) + insert + s.slice(to));
      setAnchor(caret);
      setHead(caret);
    });
  };

  const moveTo = (offset: number, extend = false) =>
    batch(() => {
      const o = Math.max(0, Math.min(t().length, offset));
      setHead(o);
      if (!extend) setAnchor(o);
      lastKind = "other";
    });

  const insertText = (str: string) => {
    const [from, to] = untrack(selection);
    replace(from, to, str, undefined, from === to && !str.includes("\n") ? "type" : "other");
  };

  const wordStart = (at: number) => {
    const s = t();
    let i = at;
    while (i > 0 && !WORD.test(s[i - 1]!)) i = prev(i);
    while (i > 0 && WORD.test(s[i - 1]!)) i = prev(i);
    return i;
  };
  const wordEnd = (at: number) => {
    const s = t();
    let i = at;
    while (i < s.length && !WORD.test(s[i]!)) i = next(i);
    while (i < s.length && WORD.test(s[i]!)) i = next(i);
    return i;
  };

  /** Lines touched by the selection: [start of the first line, end of the last]. */
  const selectedLines = (): [number, number] => {
    const [from, to] = untrack(selection);
    return [lineStart(from), lineEnd(to)];
  };

  return {
    text,
    anchor,
    head,
    selection,
    hasSelection,
    selectedText: () => {
      const [from, to] = selection();
      return text().slice(from, to);
    },
    lineStart,
    lineEnd,
    prev,
    next,
    wordStart,
    wordEnd,

    /** New content (another note opened): clears the history. */
    reset(value: string, caret = 0) {
      undoStack = [];
      redoStack = [];
      lastKind = "other";
      restore({ text: value, anchor: caret, head: caret });
    },
    moveTo,
    select(from: number, to: number) {
      batch(() => (setAnchor(from), setHead(to)));
      lastKind = "other";
    },
    selectAll: () => batch(() => (setAnchor(0), setHead(t().length))),
    insertText,

    backspace(word = false) {
      const [from, to] = untrack(selection);
      if (from !== to) return replace(from, to, "", from, "delete");
      if (from === 0) return;
      // Backspace right after an empty list marker removes the marker, not one character.
      const ls = lineStart(from);
      const m = LIST.exec(t().slice(ls, from));
      if (!word && m && ls + m[0].length === from) return replace(ls, from, m[1]!, ls + m[1]!.length);
      const start = word ? wordStart(from) : prev(from);
      replace(start, from, "", start, "delete");
    },
    deleteForward(word = false) {
      const [from, to] = untrack(selection);
      if (from !== to) return replace(from, to, "", from, "delete");
      replace(from, word ? wordEnd(from) : next(from), "", from, "delete");
    },

    /** Enter: continues lists ("- ", "1. ", "- [ ] ") and ends them on an empty item. */
    newline() {
      const [from, to] = untrack(selection);
      const ls = lineStart(from);
      const line = t().slice(ls, lineEnd(from));
      const m = LIST.exec(line);
      if (!m || from - ls < m[0].length) return replace(from, to, "\n");
      if (line.trim() === m[0].trim() && to === lineEnd(from)) return replace(ls, to, "");
      const marker = m[3] !== undefined ? `${Number(m[3]) + 1}${m[4]}` : m[2]!;
      replace(from, to, `\n${m[1]}${marker}${m[5] ? " [ ]" : ""} `);
    },

    indent() {
      const [from, to] = untrack(selection);
      if (from === to && !LIST.test(t().slice(lineStart(from), lineEnd(from)))) return replace(from, to, INDENT);
      const [ls, le] = selectedLines();
      const lines = t().slice(ls, le).split("\n");
      const out = lines.map((l) => INDENT + l).join("\n");
      batch(() => {
        replace(ls, le, out);
        setAnchor(from + INDENT.length);
        setHead(to + INDENT.length * lines.length);
      });
    },
    outdent() {
      const [from, to] = untrack(selection);
      const [ls, le] = selectedLines();
      const lines = t().slice(ls, le).split("\n");
      const removed = lines.map((l) => (l.startsWith("\t") ? 1 : l.length - l.replace(/^ {1,4}/, "").length));
      if (removed.every((r) => r === 0)) return;
      const out = lines.map((l, i) => l.slice(removed[i])).join("\n");
      const total = removed.reduce((a, b) => a + b, 0);
      batch(() => {
        replace(ls, le, out);
        setAnchor(Math.max(ls, from - removed[0]!));
        setHead(Math.max(ls, to - total));
      });
    },

    /** Ctrl+B / Ctrl+I: wraps the selection (or removes the wrapping it already has). */
    wrap(mark: string) {
      const [from, to] = untrack(selection);
      const s = t();
      const n = mark.length;
      if (s.slice(from - n, from) === mark && s.slice(to, to + n) === mark) {
        replace(from - n, to + n, s.slice(from, to));
        batch(() => (setAnchor(from - n), setHead(to - n)));
        return;
      }
      replace(from, to, mark + s.slice(from, to) + mark);
      batch(() => (setAnchor(from + n), setHead(to + n)));
    },

    /** Switches "- [ ]" and "- [x]" on the line containing `at`. Returns false if it is not a task. */
    toggleTask(at: number) {
      const ls = lineStart(at);
      const m = LIST.exec(t().slice(ls, lineEnd(at)));
      if (!m?.[5]) return false;
      const box = ls + m[0].length - 3; // the character inside the brackets
      const caret = untrack(head);
      replace(box, box + 1, m[5].trim() === "[ ]" ? "x" : " ", caret);
      return true;
    },

    undo() {
      const s = undoStack.pop();
      if (!s) return;
      redoStack.push(snapshot());
      restore(s);
      lastKind = "other";
    },
    redo() {
      const s = redoStack.pop();
      if (!s) return;
      undoStack.push(snapshot());
      restore(s);
      lastKind = "other";
    },
  };
}

export type EditorDocument = ReturnType<typeof createDocument>;
