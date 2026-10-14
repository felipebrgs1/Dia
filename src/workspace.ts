// App state: the vault's notes, the open note, navigation history, links and search.
// Each <App /> creates one (the tests too, over a memory vault) and passes it down.

import { batch, createMemo, createSignal, untrack } from "@nodebuilderjs/core";
import {
  type Heading,
  type Task,
  type TaskStatus,
  type WikiLink,
  folderOf,
  insertTask,
  noteName,
  parseHeadings,
  parseLinks,
  parseTags,
  parseTasks,
  renameLinks,
  resolveLink,
  setTaskStatusAt,
  toggleTaskAt,
} from "./vault/markdown.js";
import { DAILY_FOLDER, dailyTemplate } from "./vault/welcome.js";
import { type DayEvent, eventLine, formatTime, insertEvent, parseEvents, removeLine, setEventTime, setEventTitle } from "./vault/events.js";
import { dailyDateOf, today as isoToday } from "./dates.js";
import type { Vault } from "./vault/vault.js";

export interface SearchHit {
  path: string;
  /** Matches inside the note (empty when only the name matched). */
  matches: { offset: number; line: string; column: number }[];
}

export interface Backlink {
  path: string;
  offset: number;
  line: string;
}

interface Parsed {
  text: string;
  links: WikiLink[];
  headings: Heading[];
  tags: string[];
  tasks: Task[];
  events: DayEvent[];
}

/** An event with the day and note it lives in. */
export type VaultEvent = DayEvent & { path: string; date: string };

export type VaultTask = Task & { path: string };

const SAVE_DELAY = 400;

export function createWorkspace(vault: Vault, options: { saveDelay?: number } = {}) {
  const [files, setFiles] = createSignal<string[]>([]);
  const [folders, setFolders] = createSignal<string[]>([]);
  const [active, setActive] = createSignal<string | null>(null);
  // Bumped when any note's text changes: the link index and search follow it.
  const [version, bump] = createSignal(0, { equals: false });
  // Where the editor should put the caret after opening (a search hit, a heading).
  const [jump, setJump] = createSignal<{ path: string; offset: number } | null>(null, { equals: false });
  const [back, setBack] = createSignal<string[]>([]);
  const [forward, setForward] = createSignal<string[]>([]);

  const texts = new Map<string, string>();
  // When each note was last written or opened, for "recent notes".
  const touched = new Map<string, number>();
  const parsed = new Map<string, Parsed>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const delay = options.saveDelay ?? SAVE_DELAY;

  const refresh = () => {
    const { files: f, folders: d } = vault.list();
    for (const p of f) {
      if (texts.has(p)) continue;
      texts.set(p, vault.read(p));
      touched.set(p, vault.mtime(p));
    }
    for (const p of [...texts.keys()]) if (!f.includes(p)) texts.delete(p);
    batch(() => {
      setFiles(f);
      setFolders(d);
      bump(0);
    });
  };
  refresh();

  const parse = (path: string): Parsed => {
    const text = texts.get(path) ?? "";
    const cached = parsed.get(path);
    if (cached?.text === text) return cached;
    const p = { text, links: parseLinks(text), headings: parseHeadings(text), tags: parseTags(text), tasks: parseTasks(text), events: parseEvents(text) };
    parsed.set(path, p);
    return p;
  };

  const flush = (path?: string) => {
    for (const [p, timer] of [...timers]) {
      if (path && p !== path) continue;
      clearTimeout(timer);
      timers.delete(p);
      if (texts.has(p)) vault.write(p, texts.get(p)!);
    }
  };

  const uniquePath = (folder: string, name: string) => {
    const at = (n: string) => (folder ? `${folder}/${n}.md` : `${n}.md`);
    let candidate = at(name);
    for (let i = 1; texts.has(candidate) || vault.exists(candidate); i++) candidate = at(`${name} ${i}`);
    return candidate;
  };

  const open = (path: string, opts: { offset?: number; history?: boolean } = {}) => {
    if (!texts.has(path)) return;
    const current = untrack(active);
    batch(() => {
      if (current && current !== path && opts.history !== false) {
        setBack((b) => [...b.slice(-49), current]);
        setForward([]);
      }
      setActive(path);
      touched.set(path, Date.now());
      bump(0);
      if (opts.offset !== undefined) setJump({ path, offset: opts.offset });
    });
  };

  const create = (name = "Sem título", folder = "", text = "") => {
    const path = uniquePath(folder, name.trim() || "Sem título");
    vault.write(path, text);
    texts.set(path, text);
    touched.set(path, Date.now());
    refresh();
    open(path);
    return path;
  };

  /** Outgoing links of every note, resolved; recomputed only for notes that changed. */
  const linkIndex = createMemo(() => {
    version();
    const paths = files();
    const out = new Map<string, { link: WikiLink; to: string | undefined }[]>();
    for (const p of paths) out.set(p, parse(p).links.map((link) => ({ link, to: resolveLink(link.target, paths) })));
    return out;
  });

  /** The daily note of a day, created from the template if missing. */
  const ensureDaily = (iso: string) => {
    const path = `${DAILY_FOLDER}/${iso}.md`;
    if (!texts.has(path)) {
      const text = dailyTemplate(iso);
      vault.write(path, text);
      texts.set(path, text);
      touched.set(path, Date.now());
      refresh();
    }
    return path;
  };

  const lineAround = (text: string, offset: number) => {
    const s = text.lastIndexOf("\n", offset - 1) + 1;
    const e = text.indexOf("\n", offset);
    return text.slice(s, e < 0 ? text.length : e).trim();
  };

  const ws = {
    vault,
    files,
    folders,
    active,
    jump,
    version,
    canGoBack: () => back().length > 0,
    canGoForward: () => forward().length > 0,

    read: (path: string) => texts.get(path) ?? "",
    /** The editor writes here on every edit; the disk gets it shortly after. */
    write(path: string, text: string) {
      if (texts.get(path) === text) return;
      texts.set(path, text);
      touched.set(path, Date.now());
      bump(0);
      clearTimeout(timers.get(path));
      timers.set(path, setTimeout(() => flush(path), delay));
    },
    flush,
    refresh,
    open,
    create,

    goBack() {
      const b = untrack(back);
      const target = b[b.length - 1];
      if (!target) return;
      batch(() => {
        setBack(b.slice(0, -1));
        const current = untrack(active);
        if (current) setForward((f) => [...f, current]);
        open(target, { history: false });
      });
    },
    goForward() {
      const f = untrack(forward);
      const target = f[f.length - 1];
      if (!target) return;
      batch(() => {
        setForward(f.slice(0, -1));
        const current = untrack(active);
        if (current) setBack((b) => [...b, current]);
        open(target, { history: false });
      });
    },

    /** Follows a `[[link]]`: opens the note or, as Obsidian does, creates it. */
    openLink(target: string) {
      const found = resolveLink(target, untrack(files));
      if (found) return open(found);
      const slash = target.lastIndexOf("/");
      create(slash < 0 ? target : target.slice(slash + 1), slash < 0 ? "" : target.slice(0, slash));
    },

    createFolder(name: string, parent = "") {
      const path = parent ? `${parent}/${name}` : name;
      vault.mkdir(path);
      refresh();
      return path;
    },

    /** Renames a note and rewrites the links that pointed to it. Returns the new path, or null if taken. */
    rename(path: string, newName: string) {
      const name = newName.trim().replace(/\.md$/, "").replace(/[\\/:]/g, "-");
      if (!name) return null;
      const folder = folderOf(path);
      const target = folder ? `${folder}/${name}.md` : `${name}.md`;
      if (target === path) return path;
      if (texts.has(target) || vault.exists(target)) return null;
      flush(path);
      const oldName = noteName(path);
      vault.rename(path, target);
      texts.set(target, texts.get(path) ?? "");
      texts.delete(path);
      for (const [p, text] of texts) {
        const next = renameLinks(text, oldName, name);
        if (next !== text) {
          texts.set(p, next);
          vault.write(p, next);
        }
      }
      const swap = (list: string[]) => list.map((p) => (p === path ? target : p));
      batch(() => {
        setBack(swap);
        setForward(swap);
        if (untrack(active) === path) setActive(target);
        refresh();
      });
      return target;
    },

    remove(path: string) {
      clearTimeout(timers.get(path));
      timers.delete(path);
      vault.trash(path);
      texts.delete(path);
      batch(() => {
        setBack((b) => b.filter((p) => p !== path));
        setForward((f) => f.filter((p) => p !== path));
        refresh();
        if (untrack(active) === path) setActive(untrack(files)[0] ?? null);
      });
    },

    headings: (path: string) => (version(), parse(path).headings),
    tags: () => {
      version();
      const count = new Map<string, number>();
      for (const p of files()) for (const t of parse(p).tags) count.set(t, (count.get(t) ?? 0) + 1);
      return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    },

    outgoing(path: string) {
      return linkIndex().get(path) ?? [];
    },
    backlinks(path: string): Backlink[] {
      const out: Backlink[] = [];
      for (const [from, links] of linkIndex()) {
        if (from === path) continue;
        for (const { link, to } of links) if (to === path) out.push({ path: from, offset: link.start, line: lineAround(texts.get(from) ?? "", link.start) });
      }
      return out;
    },
    /** Every resolved link, for the graph. */
    edges() {
      const out: [string, string][] = [];
      for (const [from, links] of linkIndex()) for (const { to } of links) if (to && to !== from) out.push([from, to]);
      return out;
    },

    /** Every task in the vault, note by note. */
    tasks(): VaultTask[] {
      version();
      return files().flatMap((path) => parse(path).tasks.map((t) => ({ ...t, path })));
    },
    /** Checks or unchecks the task whose line starts at `offset`. */
    toggleTask(path: string, offset: number) {
      ws.write(path, toggleTaskAt(texts.get(path) ?? "", offset));
    },
    setTaskStatus(path: string, offset: number, status: TaskStatus) {
      ws.write(path, setTaskStatusAt(texts.get(path) ?? "", offset, status));
    },
    /** A new task in the "Tarefas" section of a day's note (today by default). */
    addTask(text: string, status: TaskStatus = "todo", date = isoToday()) {
      const path = ensureDaily(date);
      const mark = status === "doing" ? "/" : status === "done" ? "x" : " ";
      ws.write(path, insertTask(texts.get(path)!, `- [${mark}] ${text.trim()}`));
      return path;
    },
    /** Notes by last change or visit, newest first. */
    recent(limit = 8) {
      version();
      return [...files()].sort((a, b) => (touched.get(b) ?? 0) - (touched.get(a) ?? 0)).slice(0, limit);
    },

    /** Timed events of every daily note. */
    events(): VaultEvent[] {
      version();
      return files().flatMap((path) => {
        const date = dailyDateOf(path);
        return date ? parse(path).events.map((e) => ({ ...e, path, date })) : [];
      });
    },
    /** Adds an event to a day's note (created if needed). */
    addEvent(date: string, start: number, end: number, title: string) {
      const path = ensureDaily(date);
      ws.write(path, insertEvent(texts.get(path)!, `- ${formatTime(start)} - ${formatTime(end)} ${title.trim() || "Novo evento"}`));
    },
    /** New time and/or day; a new day moves the line to that day's note. */
    moveEvent(ev: VaultEvent, date: string, start: number, end: number) {
      const text = texts.get(ev.path) ?? "";
      if (date === ev.date) return ws.write(ev.path, setEventTime(text, ev.offset, start, end));
      const line = eventLine(setEventTime(text, ev.offset, start, end), ev.offset);
      batch(() => {
        ws.write(ev.path, removeLine(text, ev.offset));
        const target = ensureDaily(date);
        ws.write(target, insertEvent(texts.get(target)!, line));
      });
    },
    renameEvent(ev: VaultEvent, title: string) {
      ws.write(ev.path, setEventTitle(texts.get(ev.path) ?? "", ev.offset, title));
    },
    deleteEvent(ev: VaultEvent) {
      ws.write(ev.path, removeLine(texts.get(ev.path) ?? "", ev.offset));
    },

    dailyPath: (iso: string) => `${DAILY_FOLDER}/${iso}.md`,
    hasNote: (path: string) => (version(), texts.has(path)),
    /** Opens the daily note of a day ("YYYY-MM-DD"), creating it from the template. */
    openDaily(iso: string) {
      const path = ensureDaily(iso);
      // The caret goes to the empty first task, ready to type.
      const text = texts.get(path)!;
      const empty = text.indexOf("- [ ] \n");
      open(path, { offset: empty >= 0 ? empty + 6 : text.length });
      return path;
    },

    search(query: string, limit = 50): SearchHit[] {
      version();
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const hits: SearchHit[] = [];
      for (const path of files()) {
        const text = texts.get(path) ?? "";
        const lower = text.toLowerCase();
        const matches: SearchHit["matches"] = [];
        for (let i = lower.indexOf(q); i >= 0 && matches.length < 5; i = lower.indexOf(q, i + q.length)) {
          const ls = text.lastIndexOf("\n", i - 1) + 1;
          const le = text.indexOf("\n", i);
          matches.push({ offset: i, line: text.slice(ls, le < 0 ? text.length : le), column: i - ls });
        }
        if (matches.length || path.toLowerCase().includes(q)) hits.push({ path, matches });
        if (hits.length >= limit) break;
      }
      return hits;
    },
  };
  return ws;
}

export type Workspace = ReturnType<typeof createWorkspace>;

/** Fuzzy match for the quick switcher: every character of `query` in order. Lower is better. */
export function fuzzyScore(query: string, candidate: string): number | null {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (!q) return 0;
  const direct = c.indexOf(q);
  if (direct >= 0) return direct;
  let score = 100;
  let at = 0;
  for (const ch of q) {
    const i = c.indexOf(ch, at);
    if (i < 0) return null;
    score += i - at;
    at = i + 1;
  }
  return score;
}
