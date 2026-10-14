// Kanban board of every task in the vault: "A fazer" ([ ]), "Fazendo" ([/]) and "Feito" ([x]).
// Dragging a card to another column rewrites the mark in the task's line; the card shows the
// note it comes from and its due date, and a click opens the note at the task.

import {
  Box,
  Card,
  Column,
  type ElementRef,
  For,
  Icon,
  Overlay,
  Row,
  Scroll,
  Show,
  Text,
  TextField,
  createMemo,
  createSignal,
  theme,
  untrack,
} from "@nodebuilderjs/core";
import { noteLabel, shortDate, today } from "../dates.js";
import { fileText, search as searchIcon } from "../icons.js";
import { colors } from "../theme.js";
import type { Ui } from "../ui.js";
import type { TaskStatus } from "../vault/markdown.js";
import type { VaultTask, Workspace } from "../workspace.js";

const COLUMNS: { status: TaskStatus; title: string; dot: () => string }[] = [
  { status: "todo", title: "A fazer", dot: () => theme.text.secondary },
  { status: "doing", title: "Fazendo", dot: () => theme.accent.base },
  { status: "done", title: "Feito", dot: () => "#3f9142" },
];
/** "Feito" can grow forever: it shows the most recent part of it. */
const DONE_LIMIT = 30;

const key = (t: VaultTask) => `${t.path}:${t.offset}`;

interface Drag {
  task: VaultTask;
  /** Pointer in window coordinates and where the card was grabbed. */
  x: number;
  y: number;
  dx: number;
  dy: number;
  moved: boolean;
  over: TaskStatus | null;
}

function TaskCard(props: { task: VaultTask; dimmed?: () => boolean; floating?: boolean }) {
  const t = props.task;
  const overdue = t.status !== "done" && !!t.due && t.due < today();
  return (
    <Card
      padding={[10, 12]}
      gap={8}
      radius={8}
      background={() => colors.card}
      borderColor={() => (props.floating ? theme.accent.base : colors.border)}
      shadow={props.floating ? { color: "#5a461440", blur: 18, y: 6 } : { color: "#5a46140f", blur: 4, y: 1 }}
      opacity={() => (props.dimmed?.() ? 0.35 : 1)}
      hoverStyle={props.floating ? undefined : { borderColor: () => theme.accent.base }}
    >
      <Text maxLines={4} color={() => (t.status === "done" ? theme.text.secondary : theme.text.primary)}>{t.text || "(sem texto)"}</Text>
      <Row gap={6} align="center">
        <Icon svg={fileText} size={13} color={() => theme.text.secondary} />
        <Text grow={1} fontSize={12} maxLines={1} color={() => theme.text.secondary}>{noteLabel(t.path)}</Text>
        <Show when={() => t.due}>
          <Row padding={[1, 7]} radius={9} background={() => (overdue ? "#e01b2422" : colors.tagBg)}>
            <Text fontSize={11} color={() => (overdue ? theme.danger.base : colors.link)}>{() => shortDate(t.due!)}</Text>
          </Row>
        </Show>
      </Row>
    </Card>
  );
}

export function BoardView(props: { ws: Workspace; ui: Ui }) {
  const { ws, ui } = props;
  const [filter, setFilter] = createSignal("");
  const [draft, setDraft] = createSignal("");
  const [drag, setDrag] = createSignal<Drag | null>(null);
  const columnRefs = new Map<TaskStatus, ElementRef>();
  // Each card's box, so the dragged copy keeps its width.
  const cards = new Map<string, ElementRef>();

  // Due date first (overdue on top), then by note and position in it.
  const byStatus = createMemo(() => {
    const q = filter().trim().toLowerCase();
    const out: Record<TaskStatus, VaultTask[]> = { todo: [], doing: [], done: [] };
    for (const t of ws.tasks()) {
      if (!t.text && !t.due) continue;
      if (q && !t.text.toLowerCase().includes(q) && !noteLabel(t.path).toLowerCase().includes(q)) continue;
      out[t.status].push(t);
    }
    const order = (a: VaultTask, b: VaultTask) =>
      (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.path.localeCompare(b.path) || a.offset - b.offset;
    out.todo.sort(order);
    out.doing.sort(order);
    // Done: the notes touched last first, since there is no completion date.
    const recent = ws.recent(Number.MAX_SAFE_INTEGER);
    out.done.sort((a, b) => recent.indexOf(a.path) - recent.indexOf(b.path) || a.offset - b.offset);
    return out;
  });

  const columnAt = (x: number, y: number): TaskStatus | null => {
    for (const [status, el] of columnRefs) if (x >= el.x && x < el.x + el.width && y >= el.y && y < el.y + el.height) return status;
    return null;
  };

  const open = (t: VaultTask) => {
    ui.setView("editor");
    ws.open(t.path, { offset: t.offset });
  };

  /** Pointer released anywhere on the board. */
  const finish = () => {
    const d = untrack(drag);
    if (!d) return;
    setDrag(null);
    if (!d.moved) return open(d.task);
    if (d.over && d.over !== d.task.status) ws.setTaskStatus(d.task.path, d.task.offset, d.over);
  };

  const add = () => {
    const text = draft().trim();
    if (!text) return;
    ws.addTask(text);
    setDraft("");
  };

  return (
    <Column grow={1} background={() => colors.page} onPointerUp={finish}>
      <Row align="center" gap={12} padding={[16, 24, 12, 24]}>
        <Column grow={1} gap={2}>
          <Text fontSize={22} bold>Quadro</Text>
          <Text fontSize={12} color={() => theme.text.secondary}>
            Tarefas de todas as notas. Arraste um cartão para mudar o status; clique para abrir a nota.
          </Text>
        </Column>
        <Row width={260} gap={6} align="center">
          <Icon svg={searchIcon} size={15} color={() => theme.text.secondary} />
          <TextField grow={1} value={filter} onInput={setFilter} placeholder="Filtrar tarefas" />
        </Row>
      </Row>
      <Row grow={1} gap={14} padding={[0, 24, 20, 24]} align="stretch">
        <For each={() => COLUMNS}>
          {(col) => {
            const tasks = () => byStatus()[col.status];
            const shown = () => (col.status === "done" ? tasks().slice(0, DONE_LIMIT) : tasks());
            const target = () => {
              const d = drag();
              return !!d && d.moved && d.over === col.status && d.task.status !== col.status;
            };
            return (
              <Column
                ref={(el) => columnRefs.set(col.status, el)}
                grow={1}
                width={0}
                gap={10}
                padding={12}
                radius={12}
                background={() => (target() ? colors.active : colors.sidebar)}
                borderWidth={1.5}
                borderColor={() => (target() ? theme.accent.base : "#00000000")}
              >
                <Row gap={8} align="center" padding={[2, 4]}>
                  <Box width={8} height={8} radius={4} background={col.dot} />
                  <Text bold grow={1}>{col.title}</Text>
                  <Row padding={[1, 8]} radius={10} background={() => colors.hover}>
                    <Text fontSize={12} color={() => theme.text.secondary}>{() => String(tasks().length)}</Text>
                  </Row>
                </Row>
                <Show when={col.status === "todo"}>
                  <TextField value={draft} onInput={setDraft} onSubmit={add} placeholder="+ Nova tarefa (vai para a nota de hoje)" />
                </Show>
                <Scroll grow={1} gap={8} padding={[0, 2, 4, 0]}>
                  <For
                    each={shown}
                    fallback={
                      <Text fontSize={13} padding={[8, 4]} color={() => theme.text.secondary}>
                        {col.status === "doing" ? "Arraste uma tarefa para cá ao começar." : "Nada aqui."}
                      </Text>
                    }
                  >
                    {(t) => (
                      <Box
                        cursor="pointer"
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          setDrag({ task: t, x: e.x, y: e.y, dx: e.localX, dy: e.localY, moved: false, over: t.status });
                        }}
                        onPointerMove={(e) => {
                          const d = drag();
                          if (!d || key(d.task) !== key(t)) return;
                          if (e.button !== 0) return finish();
                          if (!d.moved && Math.abs(e.x - d.x) + Math.abs(e.y - d.y) < 5) return;
                          setDrag({ ...d, x: e.x, y: e.y, moved: true, over: columnAt(e.x, e.y) });
                        }}
                        ref={(el) => cards.set(key(t), el)}
                      >
                        <TaskCard task={t} dimmed={() => !!drag()?.moved && key(drag()!.task) === key(t)} />
                      </Box>
                    )}
                  </For>
                  <Show when={() => col.status === "done" && tasks().length > DONE_LIMIT}>
                    <Text fontSize={12} padding={[4, 4]} color={() => theme.text.secondary}>
                      {() => `+${tasks().length - DONE_LIMIT} tarefas feitas mais antigas`}
                    </Text>
                  </Show>
                </Scroll>
              </Column>
            );
          }}
        </For>
      </Row>

      {/* The card under the pointer while dragging. Declared here so the release bubbles to the board. */}
      <Show when={() => (drag()?.moved ? drag() : null)}>
        {(d) => (
          <Overlay>
            <Box
              position="absolute"
              left={() => d().x - d().dx}
              top={() => d().y - d().dy}
              width={() => cards.get(key(d().task))?.width ?? 260}
              opacity={0.95}
            >
              <TaskCard task={d().task} floating />
            </Box>
          </Overlay>
        )}
      </Show>
    </Column>
  );
}
