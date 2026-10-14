// System tray: the Dia sun, with a red dot when an event starts within SOON minutes and an
// orange one while an event is happening; the tooltip names it and the menu lists what is
// left of today's agenda. Closing the window hides it there (an option in the menu).

import { createMemo, createSignal, createTray, onCleanup, windowControls, windowState } from "@nodebuilderjs/core";
import type { Calendars } from "./calendars/store.js";
import { readConfig, updateConfig } from "./config.js";
import { today } from "./dates.js";
import type { Ui } from "./ui.js";
import { formatTime } from "./vault/events.js";
import { plainText } from "./vault/markdown.js";
import type { Vault } from "./vault/vault.js";
import type { Workspace } from "./workspace.js";

/** Minutes before an event when the dot turns on. */
export const SOON = 15;

export interface AgendaEntry {
  title: string;
  start: number;
  end: number;
  open: () => void;
}

export type Badge = "soon" | "now" | null;

/** What the tray shows at `now` (minutes since midnight) for today's timed events. */
export function trayState(entries: AgendaEntry[], now: number) {
  const left = entries.filter((e) => e.end > now).sort((a, b) => a.start - b.start);
  const current = left.find((e) => e.start <= now);
  const next = left.find((e) => e.start > now);
  const soon = !!next && next.start - now <= SOON;
  const badge: Badge = soon ? "soon" : current ? "now" : null;
  let tooltip = "Dia — nada mais na agenda hoje";
  if (soon) tooltip = `Dia — ${next.title} às ${formatTime(next.start)} (em ${next.start - now} min)`;
  else if (current) tooltip = `Dia — agora: ${current.title} (até ${formatTime(current.end)})`;
  else if (next) tooltip = `Dia — próximo: ${next.title} às ${formatTime(next.start)}`;
  return { badge, tooltip, left };
}

const BADGE_COLORS: Record<Exclude<Badge, null>, string> = { soon: "#e5372e", now: "#f08a24" };

/** The app icon (src/assets/dia.svg) with an optional dot at the top right. */
export function trayIconSvg(badge: Badge) {
  const dot = badge ? `<circle cx="196" cy="60" r="58" fill="${BADGE_COLORS[badge]}" stroke="#ffffff" stroke-width="14"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="60" fill="#e8a317"/>
  <g stroke="#2b1d00" stroke-width="16" stroke-linecap="round" fill="none">
    <path d="M128 40v22M128 194v22M40 128h22M194 128h22M65.8 65.8l15.5 15.5M174.7 174.7l15.5 15.5M65.8 190.2l15.5-15.5M174.7 81.3l15.5-15.5"/>
  </g>
  <circle cx="128" cy="128" r="40" fill="#2b1d00"/>${dot}
</svg>`;
}

const minutesNow = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export function createDiaTray(props: { vault: Vault; ws: Workspace; ui: Ui; cals: Calendars; newNote: () => void; openToday: () => void }) {
  const { vault, ws, ui, cals } = props;
  const [now, setNow] = createSignal(minutesNow());
  const [day, setDay] = createSignal(today());
  const timer = setInterval(() => (setNow(minutesNow()), setDay(today())), 20_000);
  onCleanup(() => clearInterval(timer));

  const [closeToTray, setCloseToTray] = createSignal(readConfig(vault).closeToTray !== false);
  let quitting = false;

  const show = () => windowControls.show();
  const showDay = () => {
    show();
    ui.setSelectedDay(day());
    ui.setView("calendar");
  };

  // Today's timed events: from the daily note and from the subscribed calendars.
  const entries = createMemo((): AgendaEntry[] => {
    const d = day();
    return [
      ...ws
        .events()
        .filter((e) => e.date === d)
        .map((e) => ({
          title: plainText(e.title),
          start: e.start,
          end: e.end,
          open: () => (show(), ui.setView("editor"), ws.open(e.path, { offset: e.offset })),
        })),
      ...cals
        .events()
        .filter((e) => e.date === d && !e.allDay)
        .map((e) => ({ title: e.title, start: e.start, end: e.end, open: () => (showDay(), ui.setExternalDetail(e)) })),
    ];
  });
  const state = createMemo(() => trayState(entries(), now()));

  const tray = createTray({
    icon: () => trayIconSvg(state().badge),
    tooltip: () => state().tooltip,
    title: "Dia",
    onClick: () => (windowState.visible() ? windowControls.hide() : show()),
    menu: () => [
      { label: "Abrir Dia", onClick: show },
      "separator",
      { label: "Agenda de hoje", enabled: false },
      ...(state().left.length
        ? state()
            .left.slice(0, 5)
            .map((e) => ({ label: `${e.start <= now() ? "Agora" : formatTime(e.start)}  ${e.title}`, onClick: e.open }))
        : [{ label: "Nada mais hoje", enabled: false }]),
      "separator",
      { label: "Nota de hoje", onClick: () => (show(), props.openToday()) },
      { label: "Nova nota", onClick: () => (show(), props.newNote()) },
      "separator",
      {
        label: "Fechar para a bandeja",
        checked: closeToTray(),
        onClick: () => {
          const on = !closeToTray();
          setCloseToTray(on);
          updateConfig(vault, { closeToTray: on });
        },
      },
      { label: "Sair do Dia", onClick: () => ((quitting = true), windowControls.close()) },
    ],
  });

  return {
    tray,
    state,
    /** For `<Window onClose>`: false keeps the app running in the tray. */
    onClose(): boolean | void {
      if (quitting || !closeToTray() || !tray.available()) return;
      windowControls.hide();
      return false;
    },
  };
}
