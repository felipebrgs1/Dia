// "Hoje": the start screen. Greeting, today's note, open tasks from every note, the month and
// the notes touched last.

import { Box, Button, Card, type Child, Column, For, Icon, Row, Scroll, Show, Text, createMemo, theme } from "@nodebuilderjs/core";
import { greeting, longDate, noteLabel, shortDate, today } from "../dates.js";
import { calendarDays, clock, fileText, listTodo, notebookPen } from "../icons.js";
import { formatTime } from "../vault/events.js";
import { colors } from "../theme.js";
import type { Ui } from "../ui.js";
import { folderOf, plainText } from "../vault/markdown.js";
import type { VaultTask, Workspace } from "../workspace.js";
import { MonthGrid, MonthHeader, dayIndex } from "./Calendar.js";
import { TaskRow } from "./Tasks.js";

function Section(props: { icon: string; title: string; extra?: () => string; children?: Child }) {
  return (
    <Card gap={10} padding={18} background={() => colors.card} borderColor={() => colors.border} shadow={{ color: "#5a46140d", blur: 12, y: 2 }}>
      <Row gap={8} align="center">
        <Icon svg={props.icon} size={16} color={() => theme.accent.base} />
        <Text bold grow={1}>{props.title}</Text>
        <Show when={() => props.extra?.()}>
          <Text fontSize={12} color={() => theme.text.secondary}>{() => props.extra!()}</Text>
        </Show>
      </Row>
      {props.children}
    </Card>
  );
}

export function Home(props: { ws: Workspace; ui: Ui }) {
  const { ws, ui } = props;
  const days = dayIndex(ws);
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
    <Scroll grow={1} background={() => colors.page}>
      <Column align="center" padding={[36, 24, 32, 24]}>
        <Column width="100%" maxWidth={1040} gap={24}>
          <Row align="end" gap={16}>
            <Column grow={1} gap={4}>
              <Text fontSize={13} bold letterSpacing={1} color={() => theme.accent.pressed}>
                {longDate(day).toUpperCase()}
              </Text>
              <Text fontSize={34} fontWeight={800}>{`${greeting()}!`}</Text>
              <Text color={() => theme.text.secondary}>
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
                    fallback={<Text color={() => theme.text.secondary}>Tudo feito. Escreva "- [ ] " numa nota para criar uma tarefa.</Text>}
                  >
                    {(t) => <TaskRow ws={ws} task={t} showNote onOpen={() => openTask(t)} />}
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
                        hoverStyle={{ background: () => colors.hover }}
                        onClick={() => (ui.setView("editor"), ws.open(path))}
                      >
                        <Icon svg={fileText} size={16} color={() => theme.text.secondary} />
                        <Text grow={1} maxLines={1}>{noteLabel(path)}</Text>
                        <Text fontSize={12} maxLines={1} color={() => theme.text.secondary}>{folderOf(path)}</Text>
                      </Row>
                    )}
                  </For>
                </Column>
              </Section>
            </Column>

            <Column width={330} gap={20}>
              <Card gap={10} padding={18} background={() => colors.card} borderColor={() => colors.border} shadow={{ color: "#5a46140d", blur: 12, y: 2 }}>
                <MonthHeader ui={ui} size={17} />
                <MonthGrid compact month={ui.month} days={days} selected={ui.selectedDay} onSelect={ui.setSelectedDay} onOpen={openDay} />
                <Box height={1} background={() => colors.border} />
                <Row gap={8} align="center">
                  <Text grow={1} fontSize={13} color={() => theme.text.secondary}>
                    {() => {
                      const info = days().get(ui.selectedDay());
                      const n = info?.tasks.filter((t) => !t.done).length ?? 0;
                      const day = ui.selectedDay() === today() ? "Hoje" : shortDate(ui.selectedDay());
                      return `${day} · ${n ? `${n} ${n === 1 ? "tarefa aberta" : "tarefas abertas"}` : "sem tarefas"}`;
                    }}
                  </Text>
                  <Button label="Abrir" variant="flat" onClick={() => openDay(ui.selectedDay())} />
                </Row>
              </Card>
              <Section icon={calendarDays} title="Agenda de hoje">
                <Column gap={6}>
                  <For
                    each={() => days().get(day)?.events ?? []}
                    fallback={<Text fontSize={13} color={() => theme.text.secondary}>Nada na agenda. No Calendário (Semana), arraste num horário para criar um evento.</Text>}
                  >
                    {(e) => {
                      const past = () => e.end <= new Date().getHours() * 60 + new Date().getMinutes();
                      return (
                        <Row
                          gap={10}
                          padding={[6, 8]}
                          radius={6}
                          cursor="pointer"
                          background={() => colors.event}
                          opacity={() => (past() ? 0.55 : 1)}
                          onClick={() => (ui.setView("editor"), ws.open(e.path, { offset: e.offset }))}
                        >
                          <Box width={3} radius={2} background={() => colors.eventBar} />
                          <Column grow={1} gap={1}>
                            <Text bold maxLines={1}>{plainText(e.title)}</Text>
                            <Text fontSize={12} color={() => theme.text.secondary}>{`${formatTime(e.start)} – ${formatTime(e.end)}`}</Text>
                          </Column>
                        </Row>
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
