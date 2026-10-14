// Timed events inside daily notes, in the Day Planner format: a list item that starts with a
// time, optionally an end time, then the title.
//
//   - 09:00 - 10:30 Planejar a semana
//   - [ ] 14:00 Ligar para o banco        (no end: lasts DEFAULT_LENGTH)
//   * 18:15–19:00 Academia
//
// Times are minutes since midnight. Every edit rewrites only the line it touches.

export interface DayEvent {
  /** Offset of the line start in the note. */
  offset: number;
  start: number;
  end: number;
  title: string;
  /** For `- [ ]`/`- [x]` lines; undefined for plain bullets. */
  done?: boolean;
}

export const DEFAULT_LENGTH = 30;
const FENCE = /^\s*(```|~~~)/;
const EVENT = /^(\s*[-*+] (?:\[([ xX])\] )?)(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?\s+(.*)$/;

export function formatTime(minutes: number) {
  const m = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function lineAt(text: string, offset: number) {
  const end = text.indexOf("\n", offset);
  return { line: text.slice(offset, end < 0 ? text.length : end), end: end < 0 ? text.length : end };
}

export function parseEvents(text: string): DayEvent[] {
  const out: DayEvent[] = [];
  let inFence = false;
  let offset = 0;
  for (const line of text.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    else if (!inFence) {
      const m = EVENT.exec(line);
      const h = m ? Number(m[3]) : 99;
      if (m && h < 24 && Number(m[4]) < 60) {
        const start = h * 60 + Number(m[4]);
        let end = m[5] !== undefined ? Number(m[5]) * 60 + Number(m[6]) : start + DEFAULT_LENGTH;
        if (end <= start) end = Math.min(24 * 60, start + DEFAULT_LENGTH);
        out.push({ offset, start, end, title: m[7]!.trim(), done: m[2] === undefined ? undefined : m[2] !== " " });
      }
    }
    offset += line.length + 1;
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

function replaceLine(text: string, offset: number, next: (line: string, m: RegExpExecArray) => string) {
  const { line, end } = lineAt(text, offset);
  const m = EVENT.exec(line);
  if (!m) return text;
  return text.slice(0, offset) + next(line, m) + text.slice(end);
}

export function setEventTime(text: string, offset: number, start: number, end: number) {
  return replaceLine(text, offset, (_, m) => `${m[1]}${formatTime(start)} - ${formatTime(end)} ${m[7]}`);
}

export function setEventTitle(text: string, offset: number, title: string) {
  return replaceLine(text, offset, (line, m) => line.slice(0, line.length - m[7]!.length) + title.trim());
}

/** The event's line, as it would be written in another note. */
export function eventLine(text: string, offset: number) {
  return lineAt(text, offset).line.trimStart();
}

export function removeLine(text: string, offset: number) {
  const { end } = lineAt(text, offset);
  return text.slice(0, offset) + text.slice(Math.min(text.length, end + 1));
}

/**
 * Adds an event line to a daily note, in time order inside its "## Agenda" section (created
 * after the title if missing). `line` is a whole line (`- 09:00 - 10:00 Título`).
 */
export function insertEvent(text: string, line: string) {
  const start = parseEvents(line)[0]?.start ?? 0;
  const lines = text.split("\n");
  const agenda = lines.findIndex((l) => /^#{1,6}\s+agenda\s*$/i.test(l));
  if (agenda < 0) {
    const title = lines.findIndex((l) => /^#\s/.test(l));
    const rest = lines.slice(title + 1);
    while (rest[0] === "") rest.shift();
    const head = title < 0 ? [] : [...lines.slice(0, title + 1), ""];
    return [...head, "## Agenda", line, ...(rest.length ? ["", ...rest] : [""])].join("\n");
  }
  // Before the first event of the section that starts later; else after its last event.
  let end = lines.findIndex((l, i) => i > agenda && /^#{1,6}\s/.test(l));
  if (end < 0) end = lines.length;
  let at = agenda + 1;
  for (let i = agenda + 1; i < end; i++) {
    const ev = parseEvents(lines[i]!)[0];
    if (!ev) continue;
    if (ev.start > start) {
      at = i;
      break;
    }
    at = i + 1;
  }
  lines.splice(at, 0, line);
  return lines.join("\n");
}

export interface Placed<T> {
  item: T;
  /** Column inside its group of overlapping events, and how many columns the group has. */
  lane: number;
  lanes: number;
}

/** Side-by-side columns for overlapping events (like any calendar app). */
export function placeEvents<T extends { start: number; end: number }>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const p of group) p.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (item.start >= groupEnd) close();
    let lane = laneEnds.findIndex((e) => e <= item.start);
    if (lane < 0) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = item.end;
    groupEnd = Math.max(groupEnd, item.end);
    const p = { item, lane, lanes: 1 };
    group.push(p);
    out.push(p);
  }
  close();
  return out;
}
