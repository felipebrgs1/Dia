// Month calendar: each day links to its daily note and shows the tasks due that day.
// <MonthGrid compact> is the small one on the home screen.

import { Box, Button, Column, For, Grid, Icon, Row, Scroll, Show, Text, createMemo } from "@nodebuilderjs/core";
import { MONTHS, WEEKDAYS_SHORT, addDays, dailyDateOf, longDate, monthGrid, parseIso, today, weekOf } from "../dates.js";
import { chevronLeft, chevronRight, notebookPen } from "../icons.js";
import { useCalendars, useUi, useWorkspace } from "../context.js";
import { formatTime } from "../vault/events.js";
import { plainText } from "../vault/markdown.js";
import type { VaultEvent, VaultTask, Workspace } from "../workspace.js";
import { WeekView } from "./WeekView.js";
import type { ExternalEvent } from "../calendars/ics.js";
import type { Calendars } from "../calendars/store.js";
import { AgendaRow, agendaOf, tint } from "./Calendars.js";
import { settings2 } from "../icons.js";
import { IconButton } from "./Item.js";
import { TaskRow } from "./Tasks.js";

export interface DayInfo {
  hasNote: boolean;
  /** First line of text of the daily note (not a heading, not a task). */
  preview: string;
  /** Tasks inside the daily note plus tasks from any note due that day (not timed events). */
  tasks: VaultTask[];
  /** Timed events of the daily note, by start time. */
  events: VaultEvent[];
  /** Events of the subscribed calendars (read-only). */
  external: ExternalEvent[];
}

/** What every day of the vault has: daily notes and due tasks. */
export function dayIndex(ws: Workspace, cals?: Calendars) {
  return createMemo(() => {
    const days = new Map<string, DayInfo>();
    const day = (iso: string) => {
      let d = days.get(iso);
      if (!d) days.set(iso, (d = { hasNote: false, preview: "", tasks: [], events: [], external: [] }));
      return d;
    };
    for (const path of ws.files()) {
      const m = /(?:^|\/)(\d{4}-\d{2}-\d{2})\.md$/.exec(path);
      if (!m || !parseIso(m[1]!)) continue;
      const d = day(m[1]!);
      d.hasNote = true;
      const line = ws.read(path).split("\n").find((l) => l.trim() && !/^\s*(#|[-*+] |---)/.test(l));
      d.preview = line?.trim() ?? "";
    }
    for (const e of cals?.events() ?? []) day(e.date).external.push(e);
    for (const d of days.values()) d.external.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
    const timed = new Set<string>();
    for (const e of ws.events()) {
      day(e.date).events.push(e);
      timed.add(`${e.path}:${e.offset}`);
    }
    for (const t of ws.tasks()) {
      if (timed.has(`${t.path}:${t.offset}`)) continue; // a task with a time shows as an event
      const iso = t.due ?? dailyDateOf(t.path);
      if (iso && (t.text || t.due)) day(iso).tasks.push(t);
    }
    return days;
  });
}

export function MonthGrid(props: {
  month: () => { year: number; month: number };
  days: () => Map<string, DayInfo>;
  selected: () => string;
  onSelect: (iso: string) => void;
  onOpen: (iso: string) => void;
  compact?: boolean;
  /** Color of an external calendar, for its events. */
  colorOf?: (calendarId: string) => string | undefined;
}) {
  const cells = createMemo(() => monthGrid(props.month().year, props.month().month));
  const compact = !!props.compact;
  return (
    <Column gap={compact ? 2 : 0}>
      <Grid columns={7} gap={compact ? 2 : 0}>
        <For each={() => WEEKDAYS_SHORT}>
          {(w) => (
            <Text variant="caption" fontSize={compact ? 11 : 12} textAlign="center" padding={[4, 0]}>
              {compact ? w.slice(0, 1).toUpperCase() : w}
            </Text>
          )}
        </For>
      </Grid>
      <Grid columns={7} gap={compact ? 2 : 0}>
        <For each={cells}>
          {(iso) => {
            const d = parseIso(iso)!;
            const inMonth = () => d.getMonth() === props.month().month;
            const info = () => props.days().get(iso);
            const open = () => info()?.tasks.filter((t) => !t.done).length ?? 0;
            // External events, then note events, then tasks: what fits in a month cell.
            const cellItems = () => {
              const i = info();
              if (!i) return [];
              return [
                ...i.external.map((e) => ({
                  kind: "event" as const,
                  title: e.title,
                  time: e.allDay ? undefined : formatTime(e.start),
                  color: props.colorOf?.(e.calendarId),
                  done: false,
                })),
                ...i.events.map((e) => ({ kind: "event" as const, title: plainText(e.title), time: formatTime(e.start), color: undefined, done: !!e.done })),
                ...i.tasks.map((t) => ({ kind: "task" as const, title: t.text || "(sem texto)", time: undefined, color: undefined, done: t.done })),
              ];
            };
            const isToday = () => iso === today();
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            const number = (
              <Box
                width={compact ? 26 : 28}
                height={compact ? 26 : 28}
                radius={14}
                align="center"
                justify="center"
                background={() => (isToday() ? "today" : "transparent")}
              >
                <Text
                  fontSize={compact ? 12 : 13}
                  bold={isToday()}
                  color={() => (isToday() ? "todayText" : inMonth() ? "text.primary" : "faint")}
                >
                  {String(d.getDate())}
                </Text>
              </Box>
            );
            if (compact)
              return (
                <Column
                  align="center"
                  padding={[2, 0, 4, 0]}
                  gap={2}
                  radius={8}
                  cursor="pointer"
                  background={() => (props.selected() === iso ? "active" : "transparent")}
                  hoverStyle={{ background: "hover" }}
                  onClick={(e) => (e.clicks >= 2 ? props.onOpen(iso) : props.onSelect(iso))}
                >
                  {number}
                  <Box width={4} height={4} radius={2} background={() => (info()?.events.length || info()?.external.length || open() ? "accent.base" : info()?.hasNote ? "faint" : "transparent")} />
                </Column>
              );
            return (
              <Column
                minHeight={104}
                padding={6}
                gap={4}
                cursor="pointer"
                borderWidth={0.5}
                borderColor="border"
                background={() => (props.selected() === iso ? "active" : weekend ? "weekend" : "page")}
                hoverStyle={{ background: "hover" }}
                opacity={() => (inMonth() ? 1 : 0.55)}
                onClick={(e) => (e.clicks >= 2 ? props.onOpen(iso) : props.onSelect(iso))}
              >
                <Row align="center" gap={4}>
                  {number}
                  <Box grow={1} />
                  <Show when={() => info()?.hasNote}>
                    <Icon svg={notebookPen} size={13} color="text.secondary" />
                  </Show>
                </Row>
                <Show when={() => info()?.preview}>
                  <Text variant="caption" maxLines={2}>{() => info()!.preview}</Text>
                </Show>
                <For each={() => cellItems().slice(0, 3)}>
                  {(item) => (
                    <Row
                      gap={4}
                      align="center"
                      padding={[1, 4]}
                      radius={4}
                      fontSize={11}
                      background={() => (item.kind === "task" ? "transparent" : item.color ? tint(item.color) : "event")}
                    >
                      <Show when={item.kind === "task"}>
                        <Box width={6} height={6} radius={3} background={() => (item.done ? "faint" : "accent.base")} />
                      </Show>
                      <Show when={item.time}>
                        <Text bold>{item.time!}</Text>
                      </Show>
                      <Text maxLines={1} grow={1} color={() => (item.done ? "faint" : "text.primary")}>
                        {item.title}
                      </Text>
                    </Row>
                  )}
                </For>
                <Show when={() => cellItems().length > 3}>
                  <Text variant="small">{() => `+${cellItems().length - 3} itens`}</Text>
                </Show>
              </Column>
            );
          }}
        </For>
      </Grid>
    </Column>
  );
}

export function MonthHeader(props: { size?: number }) {
  const ui = useUi();
  const shift = (by: number) =>
    ui.setMonth((m) => {
      const d = new Date(m.year, m.month + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  return (
    <Row align="center" gap={4}>
      <Text fontSize={props.size ?? 22} bold grow={1}>
        {() => `${MONTHS[ui.month().month]!.replace(/^./, (c) => c.toUpperCase())} ${ui.month().year}`}
      </Text>
      <IconButton icon={chevronLeft} tip="Mês anterior" onClick={() => shift(-1)} />
      <Button label="Hoje" variant="flat" onClick={() => ui.goToday()} />
      <IconButton icon={chevronRight} tip="Próximo mês" onClick={() => shift(1)} />
    </Row>
  );
}

export function CalendarView() {
  const ws = useWorkspace();
  const ui = useUi();
  const cals = useCalendars();
  const days = dayIndex(ws, cals);
  const colorOf = (id: string) => cals.source(id)?.color;
  const selectedInfo = () => days().get(ui.selectedDay());
  const agenda = () => agendaOf(selectedInfo()?.events ?? [], selectedInfo()?.external ?? []);
  const openAt = (path: string, offset: number) => {
    ui.setView("editor");
    ws.open(path, { offset });
  };
  const openDay = (iso: string) => {
    ui.setView("editor");
    ws.openDaily(iso);
  };
  const week = () => ui.calendarMode() === "week";
  const shift = (by: number) => {
    if (week()) return ui.setSelectedDay(addDays(ui.selectedDay(), by * 7));
    const m = ui.month();
    const d = new Date(m.year, m.month + by, 1);
    ui.setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };
  const title = () => {
    const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
    if (!week()) return `${cap(MONTHS[ui.month().month]!)} ${ui.month().year}`;
    const [a, b] = [weekOf(ui.selectedDay())[0]!, weekOf(ui.selectedDay())[6]!].map((x) => parseIso(x)!);
    return a!.getMonth() === b!.getMonth()
      ? `${a!.getDate()} – ${b!.getDate()} de ${MONTHS[b!.getMonth()]} ${b!.getFullYear()}`
      : `${a!.getDate()} ${MONTHS[a!.getMonth()]!.slice(0, 3)} – ${b!.getDate()} ${MONTHS[b!.getMonth()]!.slice(0, 3)} ${b!.getFullYear()}`;
  };
  const ModeButton = (p: { mode: "month" | "week"; label: string }) => (
    <Row
      padding={[5, 12]}
      radius={6}
      cursor="pointer"
      background={() => (ui.calendarMode() === p.mode ? "page" : "transparent")}
      shadow={() => (ui.calendarMode() === p.mode ? { color: "shadow", blur: 4, y: 1 } : { color: "transparent", blur: 0, y: 0 })}
      onClick={() => ui.setCalendarMode(p.mode)}
    >
      <Text fontSize={13} bold={() => ui.calendarMode() === p.mode}>{p.label}</Text>
    </Row>
  );

  return (
    <Row grow={1} background="page">
      <Column grow={1} width={0}>
        <Row align="center" gap={8} padding={[16, 20, 12, 24]}>
          <Text fontSize={22} bold grow={1}>{title}</Text>
          <Row padding={3} radius={8} background="sidebar">
            <ModeButton mode="week" label="Semana" />
            <ModeButton mode="month" label="Mês" />
          </Row>
          <Box width={8} />
          <IconButton icon={chevronLeft} tip="Anterior" onClick={() => shift(-1)} />
          <Button label="Hoje" variant="flat" onClick={() => ui.goToday()} />
          <IconButton icon={chevronRight} tip="Próximo" onClick={() => shift(1)} />
          <IconButton icon={settings2} tip="Calendários externos (Google, Outlook…)" onClick={() => ui.setCalendarsOpen(true)} />
        </Row>
        <Show
          when={week}
          fallback={
            <Scroll grow={1} padding={[0, 24, 24, 24]} gap={12}>
              <Column radius={10} clip borderWidth={1} borderColor="border">
                <MonthGrid month={ui.month} days={days} selected={ui.selectedDay} onSelect={ui.setSelectedDay} onOpen={openDay} colorOf={colorOf} />
              </Column>
              <Text variant="caption">
                Clique num dia para ver detalhes; dois cliques abrem a nota do dia. Tarefas com 📅 AAAA-MM-DD aparecem no dia do prazo.
              </Text>
            </Scroll>
          }
        >
          <Box height={1} background="border" />
          <WeekView days={days} />
        </Show>
      </Column>
      <Box width={1} background="border" />
      <Column width={300} padding={20} gap={12} background="sidebar">
        <Text variant="caption" bold letterSpacing={1}>
          {() => (ui.selectedDay() === today() ? "HOJE" : "DIA SELECIONADO")}
        </Text>
        <Text fontSize={20} bold>{() => longDate(ui.selectedDay()).replace(/^./, (c) => c.toUpperCase())}</Text>
        <Button
          variant="primary"
          label={() => (selectedInfo()?.hasNote ? "Abrir nota do dia" : "Criar nota do dia")}
          onClick={() => openDay(ui.selectedDay())}
        />
        <Scroll grow={1} gap={6}>
          <Text bold fontSize={13}>{() => `Agenda (${agenda().length})`}</Text>
          <For
            each={agenda}
            fallback={<Text variant="muted" fontSize={13}>Sem eventos. Na Semana, arraste num horário vazio para criar.</Text>}
          >
            {(item) =>
              item.kind === "note" ? (
                <AgendaRow title={plainText(item.ev.title)} start={item.start} end={item.end} onClick={() => openAt(item.ev.path, item.ev.offset)} />
              ) : (
                <AgendaRow
                  title={item.ev.title}
                  start={item.start}
                  end={item.end}
                  allDay={item.allDay}
                  color={colorOf(item.ev.calendarId)}
                  onClick={() => ui.setExternalDetail(item.ev)}
                />
              )
            }
          </For>
          <Box height={6} />
          <Text bold fontSize={13}>{() => `Tarefas (${selectedInfo()?.tasks.length ?? 0})`}</Text>
          <For each={() => selectedInfo()?.tasks ?? []} fallback={<Text variant="muted" fontSize={13}>Nada para este dia.</Text>}>
            {(t) => <TaskRow task={t} showNote onOpen={() => openAt(t.path, t.offset)} />}
          </For>
        </Scroll>
      </Column>
    </Row>
  );
}
