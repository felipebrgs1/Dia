// Month calendar: each day links to its daily note and shows the tasks due that day.
// <MonthGrid compact> is the small one on the home screen.

import { Box, Button, Column, For, Grid, Icon, Row, Scroll, Show, Text, createMemo, createSignal, theme } from "@nodebuilderjs/core";
import { MONTHS, WEEKDAYS_SHORT, addDays, dailyDateOf, longDate, monthGrid, parseIso, today, weekOf } from "../dates.js";
import { chevronLeft, chevronRight, notebookPen } from "../icons.js";
import { colors } from "../theme.js";
import type { Ui } from "../ui.js";
import { formatTime } from "../vault/events.js";
import { plainText } from "../vault/markdown.js";
import type { VaultEvent, VaultTask, Workspace } from "../workspace.js";
import { WeekView } from "./WeekView.js";
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
}

/** What every day of the vault has: daily notes and due tasks. */
export function dayIndex(ws: Workspace) {
  return createMemo(() => {
    const days = new Map<string, DayInfo>();
    const day = (iso: string) => {
      let d = days.get(iso);
      if (!d) days.set(iso, (d = { hasNote: false, preview: "", tasks: [], events: [] }));
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
}) {
  const cells = createMemo(() => monthGrid(props.month().year, props.month().month));
  const compact = !!props.compact;
  return (
    <Column gap={compact ? 2 : 0}>
      <Grid columns={7} gap={compact ? 2 : 0}>
        <For each={() => WEEKDAYS_SHORT}>
          {(w) => (
            <Text fontSize={compact ? 11 : 12} textAlign="center" padding={[4, 0]} color={() => theme.text.secondary}>
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
            const isToday = () => iso === today();
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            const number = (
              <Box
                width={compact ? 26 : 28}
                height={compact ? 26 : 28}
                radius={14}
                align="center"
                justify="center"
                background={() => (isToday() ? colors.today : "#00000000")}
              >
                <Text
                  fontSize={compact ? 12 : 13}
                  bold={isToday()}
                  color={() => (isToday() ? colors.todayText : inMonth() ? theme.text.primary : colors.faint)}
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
                  background={() => (props.selected() === iso ? colors.active : "#00000000")}
                  hoverStyle={{ background: () => colors.hover }}
                  onClick={(e) => (e.clicks >= 2 ? props.onOpen(iso) : props.onSelect(iso))}
                >
                  {number}
                  <Box width={4} height={4} radius={2} background={() => (info()?.events.length || open() ? theme.accent.base : info()?.hasNote ? colors.faint : "#00000000")} />
                </Column>
              );
            return (
              <Column
                minHeight={104}
                padding={6}
                gap={4}
                cursor="pointer"
                borderWidth={0.5}
                borderColor={() => colors.border}
                background={() => (props.selected() === iso ? colors.active : weekend ? colors.weekend : colors.page)}
                hoverStyle={{ background: () => colors.hover }}
                opacity={() => (inMonth() ? 1 : 0.55)}
                onClick={(e) => (e.clicks >= 2 ? props.onOpen(iso) : props.onSelect(iso))}
              >
                <Row align="center" gap={4}>
                  {number}
                  <Box grow={1} />
                  <Show when={() => info()?.hasNote}>
                    <Icon svg={notebookPen} size={13} color={() => theme.text.secondary} />
                  </Show>
                </Row>
                <Show when={() => info()?.preview}>
                  <Text fontSize={12} maxLines={2} color={() => theme.text.secondary}>{() => info()!.preview}</Text>
                </Show>
                <For each={() => (info()?.events ?? []).slice(0, 3)}>
                  {(e) => (
                    <Row gap={4} align="center" padding={[1, 4]} radius={4} background={() => colors.event}>
                      <Text fontSize={11} bold color={() => theme.text.primary}>{formatTime(e.start)}</Text>
                      <Text fontSize={11} maxLines={1} grow={1} color={() => theme.text.primary}>{plainText(e.title)}</Text>
                    </Row>
                  )}
                </For>
                <For each={() => (info()?.tasks ?? []).slice(0, Math.max(0, 3 - (info()?.events.length ?? 0)))}>
                  {(t) => (
                    <Row gap={4} align="center">
                      <Box width={6} height={6} radius={3} background={() => (t.done ? colors.faint : theme.accent.base)} />
                      <Text fontSize={11} maxLines={1} grow={1} color={() => (t.done ? colors.faint : theme.text.primary)}>
                        {t.text || "(sem texto)"}
                      </Text>
                    </Row>
                  )}
                </For>
                <Show when={() => (info()?.tasks.length ?? 0) + (info()?.events.length ?? 0) > 3}>
                  <Text fontSize={11} color={() => theme.text.secondary}>
                    {() => `+${info()!.tasks.length + info()!.events.length - 3} itens`}
                  </Text>
                </Show>
              </Column>
            );
          }}
        </For>
      </Grid>
    </Column>
  );
}

export function MonthHeader(props: { ui: Ui; size?: number }) {
  const { ui } = props;
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

export function CalendarView(props: { ws: Workspace; ui: Ui }) {
  const { ws, ui } = props;
  const days = dayIndex(ws);
  const selectedInfo = () => days().get(ui.selectedDay());
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
      background={() => (ui.calendarMode() === p.mode ? colors.page : "#00000000")}
      shadow={() => (ui.calendarMode() === p.mode ? { color: "#5a46141f", blur: 4, y: 1 } : { color: "#00000000", blur: 0, y: 0 })}
      onClick={() => ui.setCalendarMode(p.mode)}
    >
      <Text fontSize={13} bold={() => ui.calendarMode() === p.mode}>{p.label}</Text>
    </Row>
  );

  return (
    <Row grow={1} background={() => colors.page}>
      <Column grow={1} width={0}>
        <Row align="center" gap={8} padding={[16, 20, 12, 24]}>
          <Text fontSize={22} bold grow={1}>{title}</Text>
          <Row padding={3} radius={8} background={() => colors.sidebar}>
            <ModeButton mode="week" label="Semana" />
            <ModeButton mode="month" label="Mês" />
          </Row>
          <Box width={8} />
          <IconButton icon={chevronLeft} tip="Anterior" onClick={() => shift(-1)} />
          <Button label="Hoje" variant="flat" onClick={() => ui.goToday()} />
          <IconButton icon={chevronRight} tip="Próximo" onClick={() => shift(1)} />
        </Row>
        <Show
          when={week}
          fallback={
            <Scroll grow={1} padding={[0, 24, 24, 24]} gap={12}>
              <Column radius={10} clip borderWidth={1} borderColor={() => colors.border}>
                <MonthGrid month={ui.month} days={days} selected={ui.selectedDay} onSelect={ui.setSelectedDay} onOpen={openDay} />
              </Column>
              <Text fontSize={12} color={() => theme.text.secondary}>
                Clique num dia para ver detalhes; dois cliques abrem a nota do dia. Tarefas com 📅 AAAA-MM-DD aparecem no dia do prazo.
              </Text>
            </Scroll>
          }
        >
          <Box height={1} background={() => colors.border} />
          <WeekView ws={ws} ui={ui} days={days} />
        </Show>
      </Column>
      <Box width={1} background={() => colors.border} />
      <Column width={300} padding={20} gap={12} background={() => colors.sidebar}>
        <Text fontSize={12} bold letterSpacing={1} color={() => theme.text.secondary}>
          {() => (ui.selectedDay() === today() ? "HOJE" : "DIA SELECIONADO")}
        </Text>
        <Text fontSize={20} bold>{() => longDate(ui.selectedDay()).replace(/^./, (c) => c.toUpperCase())}</Text>
        <Button
          variant="primary"
          label={() => (selectedInfo()?.hasNote ? "Abrir nota do dia" : "Criar nota do dia")}
          onClick={() => openDay(ui.selectedDay())}
        />
        <Scroll grow={1} gap={6}>
          <Text bold fontSize={13}>{() => `Agenda (${selectedInfo()?.events.length ?? 0})`}</Text>
          <For
            each={() => selectedInfo()?.events ?? []}
            fallback={<Text fontSize={13} color={() => theme.text.secondary}>Sem eventos. Na Semana, arraste num horário vazio para criar.</Text>}
          >
            {(e) => (
              <Row
                gap={10}
                padding={[6, 8]}
                radius={6}
                cursor="pointer"
                background={() => colors.event}
                hoverStyle={{ opacity: 0.85 }}
                onClick={() => openAt(e.path, e.offset)}
              >
                <Text fontSize={12} bold>{`${formatTime(e.start)}\n${formatTime(e.end)}`}</Text>
                <Text grow={1} maxLines={2}>{plainText(e.title)}</Text>
              </Row>
            )}
          </For>
          <Box height={6} />
          <Text bold fontSize={13}>{() => `Tarefas (${selectedInfo()?.tasks.length ?? 0})`}</Text>
          <For each={() => selectedInfo()?.tasks ?? []} fallback={<Text fontSize={13} color={() => theme.text.secondary}>Nada para este dia.</Text>}>
            {(t) => <TaskRow ws={ws} task={t} showNote onOpen={() => openAt(t.path, t.offset)} />}
          </For>
        </Scroll>
      </Column>
    </Row>
  );
}
