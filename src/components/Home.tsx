// "Hoje": the start screen. Greeting, today's note, open tasks from every note, the month and
// the notes touched last.

import { Box, Button, Card, type Child, Column, For, Icon, Row, Scroll, Show, Text, createMemo } from "@nodebuilderjs/core";
import { greeting, longDate, noteLabel, shortDate, today } from "../dates.js";
import { calendarDays, clock, fileText, listTodo, notebookPen } from "../icons.js";
import { useCalendars, useUi, useWorkspace } from "../context.js";
import { folderOf, plainText } from "../vault/markdown.js";
import type { VaultTask } from "../workspace.js";
import { MonthGrid, MonthHeader, dayIndex } from "./Calendar.js";
import { AgendaRow, agendaOf } from "./Calendars.js";
import { TaskRow } from "./Tasks.js";

/** A card of the home screen, on the warm card color with a soft shadow. */
function HomeCard(props: { children?: Child }) {
  return (
    <Card gap={10} padding={18} background="card" borderColor="border" shadow={{ color: "shadowSoft", blur: 12, y: 2 }}>
      {props.children}
    </Card>
  );
}

function Section(props: { icon: string; title: string; extra?: () => string; children?: Child }) {
  return (
    <HomeCard>
      <Row gap={8} align="center">
        <Icon svg={props.icon} size={16} color="accent.base" />
        <Text bold grow={1}>{props.title}</Text>
        <Show when={() => props.extra?.()}>
          <Text variant="caption">{() => props.extra!()}</Text>
        </Show>
      </Row>
      {props.children}
    </HomeCard>
  );
}

export function Home() {
  const ws = useWorkspace();
  const ui = useUi();
  const cals = useCalendars();
  const days = dayIndex(ws, cals);
  const day = today();

  // Open tasks: overdue and due first (by date), then the rest in note order.
  const open = createMemo(() =>
    ws
      .tasks()
      .filter((t) => !t.done && (t.text || t.due))
      .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")),
  );
  const todayNote = () => ws.hasNote(ws.dailyPath(day));
  const openTask = (t: VaultTask) => {
    ui.setView("editor");
    ws.open(t.path, { offset: t.offset });
  };
  const openDay = (iso: string) => {
    ui.setView("editor");
    ws.openDaily(iso);
  };

  return (
    <Scroll grow={1} background="page">
      <Column align="center" padding={[36, 24, 32, 24]}>
        <Column width="100%" maxWidth={1040} gap={24}>
          <Row align="end" gap={16}>
            <Column grow={1} gap={4}>
              <Text fontSize={13} bold letterSpacing={1} color="accent.pressed">
                {longDate(day).toUpperCase()}
              </Text>
              <Text fontSize={34} fontWeight={800}>{`${greeting()}!`}</Text>
              <Text variant="muted">
                {() => {
                  const n = open().length;
                  return n ? `Você tem ${n} ${n === 1 ? "tarefa aberta" : "tarefas abertas"}.` : "Nenhuma tarefa aberta. Bom descanso.";
                }}
              </Text>
            </Column>
            <Button variant="primary" onClick={() => openDay(day)}>
              <Row gap={8} align="center">
                <Icon svg={notebookPen} size={16} />
                <Text bold>{() => (todayNote() ? "Abrir nota de hoje" : "Começar nota de hoje")}</Text>
              </Row>
            </Button>
          </Row>

          <Row gap={20} align="start">
            <Column grow={1} width={0} gap={20}>
              <Section icon={listTodo} title="Tarefas abertas" extra={() => (open().length > 10 ? `10 de ${open().length}` : "")}>
                <Column gap={2}>
                  <For
                    each={() => open().slice(0, 10)}
                    fallback={<Text variant="muted">Tudo feito. Escreva "- [ ] " numa nota para criar uma tarefa.</Text>}
                  >
                    {(t) => <TaskRow task={t} showNote onOpen={() => openTask(t)} />}
                  </For>
                </Column>
              </Section>
              <Section icon={clock} title="Notas recentes">
                <Column gap={2}>
                  <For each={() => ws.recent(6)}>
                    {(path) => (
                      <Row
                        gap={10}
                        align="center"
                        padding={[6, 8]}
                        radius={6}
                        cursor="pointer"
                        hoverStyle={{ background: "hover" }}
                        onClick={() => (ui.setView("editor"), ws.open(path))}
                      >
                        <Icon svg={fileText} size={16} color="text.secondary" />
                        <Text grow={1} maxLines={1}>{noteLabel(path)}</Text>
                        <Text variant="caption" maxLines={1}>{folderOf(path)}</Text>
                      </Row>
                    )}
                  </For>
                </Column>
              </Section>
            </Column>

            <Column width={330} gap={20}>
              <HomeCard>
                <MonthHeader size={17} />
                <MonthGrid compact month={ui.month} days={days} selected={ui.selectedDay} onSelect={ui.setSelectedDay} onOpen={openDay} colorOf={(id) => cals.source(id)?.color} />
                <Box height={1} background="border" />
                <Row gap={8} align="center">
                  <Text variant="muted" grow={1} fontSize={13}>
                    {() => {
                      const info = days().get(ui.selectedDay());
                      const n = info?.tasks.filter((t) => !t.done).length ?? 0;
                      const day = ui.selectedDay() === today() ? "Hoje" : shortDate(ui.selectedDay());
                      return `${day} · ${n ? `${n} ${n === 1 ? "tarefa aberta" : "tarefas abertas"}` : "sem tarefas"}`;
                    }}
                  </Text>
                  <Button label="Abrir" variant="flat" onClick={() => openDay(ui.selectedDay())} />
                </Row>
              </HomeCard>
              <Section icon={calendarDays} title="Agenda de hoje">
                <Column gap={6}>
                  <For
                    each={() => agendaOf(days().get(day)?.events ?? [], days().get(day)?.external ?? [])}
                    fallback={<Text variant="muted" fontSize={13}>Nada na agenda. No Calendário (Semana), arraste num horário para criar um evento.</Text>}
                  >
                    {(item) => {
                      const past = () => !item.allDay && item.end <= new Date().getHours() * 60 + new Date().getMinutes();
                      return item.kind === "note" ? (
                        <AgendaRow
                          title={plainText(item.ev.title)}
                          start={item.start}
                          end={item.end}
                          faded={past}
                          onClick={() => (ui.setView("editor"), ws.open(item.ev.path, { offset: item.ev.offset }))}
                        />
                      ) : (
                        <AgendaRow
                          title={item.ev.title}
                          start={item.start}
                          end={item.end}
                          allDay={item.allDay}
                          color={cals.source(item.ev.calendarId)?.color}
                          faded={past}
                          onClick={() => ui.setExternalDetail(item.ev)}
                        />
                      );
                    }}
                  </For>
                </Column>
              </Section>
            </Column>
          </Row>
        </Column>
      </Column>
    </Scroll>
  );
}
