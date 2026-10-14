// Local dates as "YYYY-MM-DD" strings (what daily notes and due dates use) and pt-BR names.

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isoDate(d) === iso ? d : null;
}

export const today = () => isoDate(new Date());

export function addDays(iso: string, days: number) {
  const d = parseIso(iso)!;
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** The 42 days (6 weeks, Sunday first) shown for a month. `month` is 0..11. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => isoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** "terça-feira, 14 de outubro" */
export function longDate(iso: string) {
  const d = parseIso(iso)!;
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** "14 out" */
export function shortDate(iso: string) {
  const d = parseIso(iso)!;
  return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`;
}

/** The day of a daily note ("Diário/2026-10-14.md" → "2026-10-14"), or null. */
export function dailyDateOf(path: string) {
  const m = /(?:^|\/)(\d{4}-\d{2}-\d{2})\.md$/.exec(path);
  return m && parseIso(m[1]!) ? m[1]! : null;
}

/** The 7 days (Sunday first) of the week containing `iso`. */
export function weekOf(iso: string) {
  const d = parseIso(iso)!;
  return Array.from({ length: 7 }, (_, i) => isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + i)));
}

/** How a note is named in lists: daily notes by their day ("Hoje", "Ontem", "14 out"). */
export function noteLabel(path: string) {
  const m = /(?:^|\/)(\d{4}-\d{2}-\d{2})\.md$/.exec(path);
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
  if (!m || !parseIso(m[1]!)) return name;
  const t = today();
  return m[1] === t ? "Hoje" : m[1] === addDays(t, -1) ? "Ontem" : m[1] === addDays(t, 1) ? "Amanhã" : shortDate(m[1]!);
}

export function greeting(hour = new Date().getHours()) {
  return hour < 5 ? "Boa noite" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}
