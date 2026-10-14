// External calendars (read-only iCal links): the list lives in `.dia/config.json`, each feed's
// last download in `.dia/cache/<id>.ics`, so the app opens with the last known events even
// offline. Feeds are downloaded at start and every REFRESH_MS.

import { batch, createMemo, createSignal, onCleanup, untrack } from "@nodebuilderjs/core";
import { readConfig, updateConfig } from "../config.js";
import type { Vault } from "../vault/vault.js";
import { type ExternalEvent, parseIcs, toDayEvents } from "./ics.js";

export interface CalendarSource {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
}

export interface CalendarStatus {
  state: "idle" | "loading" | "ok" | "error";
  /** When the feed was last downloaded (ms), from this session or the cache. */
  syncedAt?: number;
  error?: string;
  events: number;
}

export type Fetcher = (url: string) => Promise<string>;

export const CALENDAR_COLORS = ["#3b82f6", "#16a34a", "#db2777", "#9333ea", "#ea580c", "#0d9488"];
const REFRESH_MS = 15 * 60_000;
const DAY_MS = 86_400_000;

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Dia" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

/** `webcal://` links (what "Add to calendar" buttons give) are plain https. */
export function normalizeUrl(url: string) {
  return url.trim().replace(/^webcals?:\/\//i, "https://");
}

export function createCalendars(vault: Vault, options: { fetcher?: Fetcher; autoRefresh?: boolean } = {}) {
  const fetcher = options.fetcher ?? defaultFetcher;
  const [sources, setSources] = createSignal<CalendarSource[]>((readConfig(vault).calendars as CalendarSource[]) ?? []);
  const [feeds, setFeeds] = createSignal(new Map<string, string>()); // id → .ics text
  const [status, setStatus] = createSignal(new Map<string, CalendarStatus>());

  const save = (list: CalendarSource[]) => {
    updateConfig(vault, { calendars: list });
    setSources(list);
  };
  const setOne = (id: string, s: Partial<CalendarStatus>) =>
    setStatus((m) => new Map(m).set(id, { state: "idle", events: 0, ...m.get(id), ...s }));

  // The last downloads, before the network answers.
  for (const s of untrack(sources)) {
    const cached = vault.readMeta(`cache/${s.id}.ics`);
    const at = Number(vault.readMeta(`cache/${s.id}.time`) ?? 0) || undefined;
    if (cached) setFeeds((m) => new Map(m).set(s.id, cached));
    setOne(s.id, { state: cached ? "ok" : "idle", syncedAt: at });
  }

  // Occurrences from 3 months back to a year ahead, split by day; parsed only when a feed changes.
  const parsed = createMemo(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 90 * DAY_MS);
    const to = new Date(now.getTime() + 365 * DAY_MS);
    const out = new Map<string, ExternalEvent[]>();
    for (const [id, ics] of feeds()) {
      try {
        out.set(id, toDayEvents(parseIcs(ics, from, to), id));
      } catch (e) {
        out.set(id, []);
        queueMicrotask(() => setOne(id, { state: "error", error: `Arquivo inválido: ${(e as Error).message}` }));
      }
    }
    return out;
  });

  const refresh = async (id?: string) => {
    const list = untrack(sources).filter((s) => s.enabled && (!id || s.id === id));
    await Promise.all(
      list.map(async (s) => {
        setOne(s.id, { state: "loading", error: undefined });
        try {
          const ics = await fetcher(normalizeUrl(s.url));
          if (!/BEGIN:VCALENDAR/i.test(ics)) throw new Error("o link não devolveu um calendário (.ics)");
          const at = Date.now();
          vault.writeMeta(`cache/${s.id}.ics`, ics);
          vault.writeMeta(`cache/${s.id}.time`, String(at));
          batch(() => {
            setFeeds((m) => new Map(m).set(s.id, ics));
            setOne(s.id, { state: "ok", syncedAt: at });
          });
        } catch (e) {
          setOne(s.id, { state: "error", error: (e as Error).message });
        }
      }),
    );
  };

  if (options.autoRefresh !== false) {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    onCleanup(() => clearInterval(timer));
  }

  return {
    sources,
    /** Status per calendar, with how many event pieces it has. */
    status: (id: string): CalendarStatus => {
      const s = status().get(id) ?? { state: "idle", events: 0 };
      return { ...s, events: parsed().get(id)?.length ?? 0 };
    },
    /** Events of the enabled calendars, by day. */
    events: createMemo(() => {
      const on = new Set(sources().filter((s) => s.enabled).map((s) => s.id));
      return [...parsed()].filter(([id]) => on.has(id)).flatMap(([, list]) => list);
    }),
    source: (id: string) => sources().find((s) => s.id === id),
    refresh,

    add(name: string, url: string, color?: string) {
      const list = untrack(sources);
      const id = `cal${Date.now().toString(36)}`;
      const source: CalendarSource = {
        id,
        name: name.trim() || "Calendário",
        url: url.trim(),
        color: color ?? CALENDAR_COLORS[list.length % CALENDAR_COLORS.length]!,
        enabled: true,
      };
      save([...list, source]);
      void refresh(id);
      return id;
    },
    update(id: string, patch: Partial<Omit<CalendarSource, "id">>) {
      save(untrack(sources).map((s) => (s.id === id ? { ...s, ...patch } : s)));
      if (patch.url || patch.enabled) void refresh(id);
    },
    remove(id: string) {
      save(untrack(sources).filter((s) => s.id !== id));
      setFeeds((m) => {
        const next = new Map(m);
        next.delete(id);
        return next;
      });
    },
  };
}

export type Calendars = ReturnType<typeof createCalendars>;
