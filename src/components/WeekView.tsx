// Week view: an hour grid for 7 days with the events of the daily notes.
//   - drag on empty space: creates an event (a click makes a 1 hour one)
//   - drag an event: moves it, also to another day; drag its bottom edge: changes the end
//   - click an event: edit its title and times, delete it or open its note
// Every change rewrites the event's line in the daily note (see vault/events.ts).

import {
  Box,
  Button,
  Column,
  Dialog,
  type ElementRef,
  For,
  Index,
  Row,
  Scroll,
  Select,
  Show,
  Text,
  TextField,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  theme,
  untrack,
} from "@nodebuilderjs/core";
import { WEEKDAYS_SHORT, longDate, parseIso, today, weekOf } from "../dates.js";
import { colors } from "../theme.js";
import type { Ui } from "../ui.js";
import { DEFAULT_LENGTH, formatTime, placeEvents } from "../vault/events.js";
import { plainText } from "../vault/markdown.js";
import type { VaultEvent, Workspace } from "../workspace.js";
import type { ExternalEvent } from "../calendars/ics.js";
import type { Calendars } from "../calendars/store.js";
import type { DayInfo } from "./Calendar.js";
import { tint } from "./Calendars.js";

export const HOUR = 48;
const SNAP = 15;
const GUTTER = 56;
const DAY = 24 * 60;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const TIME_OPTIONS = Array.from({ length: DAY / SNAP + 1 }, (_, i) => ({ value: i * SNAP, label: formatTime(i * SNAP) }));

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (minutes: number) => Math.round(minutes / SNAP) * SNAP;
const minutesNow = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const sameEvent = (a: VaultEvent | undefined, b: VaultEvent) => !!a && a.path === b.path && a.offset === b.offset;

type Drag =
  | { kind: "create"; date: string; anchor: number; start: number; end: number; moved: boolean }
  | { kind: "move" | "resize"; ev: VaultEvent; date: string; start: number; end: number; x0: number; y0: number; moved: boolean };

interface Editing {
  ev?: VaultEvent;
  date: string;
}

export function WeekView(props: { ws: Workspace; ui: Ui; cals: Calendars; days: () => Map<string, DayInfo> }) {
  const { ws, ui, cals } = props;
  const colorOf = (e: ExternalEvent) => cals.source(e.calendarId)?.color ?? "#888888";
  const week = createMemo(() => weekOf(ui.selectedDay()));
  const byDay = createMemo(() => {
    const out = new Map<string, VaultEvent[]>();
    for (const e of ws.events()) out.set(e.date, [...(out.get(e.date) ?? []), e]);
    return out;
  });

  const [now, setNow] = createSignal(minutesNow());
  const timer = setInterval(() => setNow(minutesNow()), 30_000);
  onCleanup(() => clearInterval(timer));

  const [colWidth, setColWidth] = createSignal(100);
  const columns: ElementRef[] = [];
  let scroller: ElementRef | undefined;
  onMount(() => scroller?.scrollTo((Math.max(6 * 60, Math.min(now() - 90, 16 * 60)) / 60) * HOUR));

  /** The day under a window x (for moving an event sideways). */
  const dayAtX = (x: number) => {
    const days = week();
    for (let i = 0; i < 7; i++) {
      const c = columns[i];
      if (c && x >= c.x && x < c.x + c.width) return days[i]!;
    }
    return null;
  };

  // ---- Dragging --------------------------------------------------------------------------
  const [drag, setDrag] = createSignal<Drag | null>(null);
  const [editing, setEditing] = createSignal<Editing | null>(null);
  const [title, setTitle] = createSignal("");
  const [start, setStart] = createSignal(9 * 60);
  const [end, setEnd] = createSignal(10 * 60);

  const openEditor = (e: Editing, s: number, en: number, t: string) => {
    setTitle(t);
    setStart(s);
    setEnd(en);
    setEditing(e);
  };

  /** Pointer released anywhere in the grid: commits the drag (or treats it as a click). */
  const finish = () => {
    const d = untrack(drag);
    if (!d) return;
    setDrag(null);
    if (d.kind === "create") {
      const s = d.start;
      const e = d.moved ? d.end : Math.min(DAY, s + 60);
      openEditor({ date: d.date }, s, e, "");
    } else if (!d.moved) {
      openEditor({ ev: d.ev, date: d.ev.date }, d.ev.start, d.ev.end, d.ev.title);
    } else if (d.date !== d.ev.date || d.start !== d.ev.start || d.end !== d.ev.end) {
      ws.moveEvent(d.ev, d.date, d.start, d.end);
      ui.setSelectedDay(d.date);
    }
  };

  const save = () => {
    const e = editing();
    if (!e) return;
    const s = start();
    const en = Math.max(end(), s + SNAP);
    if (!e.ev) ws.addEvent(e.date, s, en, title());
    else {
      if (title().trim() && title().trim() !== e.ev.title) ws.renameEvent(e.ev, title());
      if (s !== e.ev.start || en !== e.ev.end) ws.moveEvent({ ...e.ev }, e.ev.date, s, en);
    }
    setEditing(null);
  };

  // ---- Pieces ----------------------------------------------------------------------------
  const block = (p: { start: number; end: number }) => ({ top: (p.start / 60) * HOUR + 1, height: Math.max(18, ((p.end - p.start) / 60) * HOUR - 3) });

  const EventBlock = (p: { ev: VaultEvent; lane: number; lanes: number }) => {
    const ev = p.ev;
    const box = block(ev);
    const dragged = () => {
      const d = drag();
      return d && d.kind !== "create" && sameEvent(d.ev, ev) && d.moved;
    };
    return (
      <Column
        position="absolute"
        left={() => (colWidth() / p.lanes) * p.lane + 2}
        width={() => colWidth() / p.lanes - 5}
        top={box.top}
        height={box.height}
        padding={[3, 6, 3, 9]}
        gap={1}
        radius={6}
        clip
        cursor="pointer"
        background={() => (ev.done ? colors.eventDone : colors.event)}
        opacity={() => (dragged() ? 0.35 : 1)}
        hoverStyle={{ shadow: { color: "#5a46142e", blur: 8, y: 2 } }}
        onPointerDown={(e) => {
          e.stop(); // not a "create" on the column underneath
          if (e.button !== 0) return;
          const resize = e.localY > box.height - 7;
          setDrag({ kind: resize ? "resize" : "move", ev, date: ev.date, start: ev.start, end: ev.end, x0: e.x, y0: e.y, moved: false });
        }}
        onPointerMove={(e) => {
          const d = drag();
          if (!d || d.kind === "create" || !sameEvent(d.ev, ev)) return;
          if (e.button !== 0) return finish();
          if (!d.moved && Math.abs(e.y - d.y0) + Math.abs(e.x - d.x0) < 4) return;
          const delta = snap(((e.y - d.y0) / HOUR) * 60);
          if (d.kind === "move") {
            const len = ev.end - ev.start;
            const s = clamp(ev.start + delta, 0, DAY - len);
            setDrag({ ...d, date: dayAtX(e.x) ?? d.date, start: s, end: s + len, moved: true });
          } else setDrag({ ...d, end: clamp(ev.end + delta, ev.start + SNAP, DAY), moved: true });
        }}
      >
        {/* Absolute children sit inside the padding: pull them back to the edges. */}
        <Box position="absolute" left={-9} top={-3} width={3} height={box.height} background={() => colors.eventBar} />
        <Text fontSize={12} bold maxLines={box.height > 40 ? 2 : 1} color={() => (ev.done ? theme.text.secondary : theme.text.primary)}>
          {plainText(ev.title) || "(sem título)"}
        </Text>
        <Show when={box.height > 30}>
          <Text fontSize={11} maxLines={1} color={() => theme.text.secondary}>{`${formatTime(ev.start)} – ${formatTime(ev.end)}`}</Text>
        </Show>
        <Box position="absolute" left={-9} bottom={-3} width={() => colWidth()} height={7} cursor="s-resize" />
      </Column>
    );
  };

  /** An event of a subscribed calendar: read-only, in its calendar's color; a click shows it. */
  const ExternalBlock = (p: { ev: ExternalEvent; lane: number; lanes: number }) => {
    const ev = p.ev;
    const box = block(ev);
    return (
      <Column
        position="absolute"
        left={() => (colWidth() / p.lanes) * p.lane + 2}
        width={() => colWidth() / p.lanes - 5}
        top={box.top}
        height={box.height}
        padding={[3, 6, 3, 9]}
        gap={1}
        radius={6}
        clip
        cursor="pointer"
        background={() => tint(colorOf(ev))}
        hoverStyle={{ shadow: { color: "#5a46142e", blur: 8, y: 2 } }}
        onPointerDown={(e) => e.stop()}
        onClick={() => ui.setExternalDetail(ev)}
      >
        <Box position="absolute" left={-9} top={-3} width={3} height={box.height} background={() => colorOf(ev)} />
        <Text fontSize={12} bold maxLines={box.height > 40 ? 2 : 1}>{ev.title}</Text>
        <Show when={box.height > 30}>
          <Text fontSize={11} maxLines={1} color={() => theme.text.secondary}>
            {`${formatTime(ev.start)} – ${formatTime(ev.end)}${ev.location ? ` · ${ev.location}` : ""}`}
          </Text>
        </Show>
      </Column>
    );
  };

  /** The block that follows the pointer while creating or moving. */
  const Ghost = (p: { date: () => string }) => (
    <Show when={() => {
      const d = drag();
      return d && d.date === p.date() && (d.kind === "create" || d.moved) ? d : null;
    }}>
      {(d) => (
        <Column
          position="absolute"
          left={2}
          width={() => colWidth() - 5}
          top={() => block(d()).top}
          height={() => block(d()).height}
          padding={[3, 6, 3, 9]}
          radius={6}
          borderWidth={1.5}
          borderColor={() => colors.eventBar}
          background={() => colors.active}
        >
          <Text fontSize={11} bold>{() => `${formatTime(d().start)} – ${formatTime(d().end)}`}</Text>
          <Show when={() => d().kind !== "create"}>
            <Text fontSize={11} maxLines={1}>{() => {
              const v = d();
              return v.kind === "create" ? "" : plainText(v.ev.title);
            }}</Text>
          </Show>
        </Column>
      )}
    </Show>
  );

  const DayColumn = (p: { date: () => string; index: number }) => {
    const weekend = () => {
      const d = parseIso(p.date())!.getDay();
      return d === 0 || d === 6;
    };
    // Note events and timed external events share the lanes, so overlaps sit side by side.
    const placed = createMemo(() => {
      const notes = (byDay().get(p.date()) ?? []).map((ev) => ({ kind: "note" as const, ev, start: ev.start, end: ev.end }));
      const external = (props.days().get(p.date())?.external ?? [])
        .filter((ev) => !ev.allDay)
        .map((ev) => ({ kind: "external" as const, ev, start: ev.start, end: ev.end }));
      return placeEvents([...notes, ...external]).map((x) => ({ item: x.item, lane: x.lane, lanes: x.lanes }));
    });
    return (
      <Box
        ref={(el) => (columns[p.index] = el)}
        grow={1}
        width={0}
        height={24 * HOUR}
        cursor="default"
        background={() => (p.date() === today() ? colors.todayColumn : weekend() ? colors.weekend : colors.page)}
        onResize={(s) => p.index === 0 && setColWidth(s.width)}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const m = clamp(Math.floor(((e.localY / HOUR) * 60) / SNAP) * SNAP, 0, DAY - SNAP);
          setDrag({ kind: "create", date: p.date(), anchor: m, start: m, end: m + SNAP, moved: false });
        }}
        onPointerMove={(e) => {
          const d = drag();
          if (!d || d.kind !== "create") return;
          if (e.button !== 0) return finish();
          const m = clamp(snap((e.localY / HOUR) * 60), 0, DAY);
          if (!d.moved && Math.abs(m - d.anchor) < SNAP) return;
          setDrag({ ...d, start: Math.min(d.anchor, m), end: Math.max(d.anchor + SNAP, m), moved: true });
        }}
      >
        <Box position="absolute" left={0} top={0} width={1} height={24 * HOUR} background={() => colors.border} />
        <For each={() => HOURS}>
          {(h) => <Box position="absolute" left={0} right={0} top={h * HOUR} height={1} background={() => colors.border} />}
        </For>
        <For each={placed}>
          {(x) =>
            x.item.kind === "note" ? (
              <EventBlock ev={x.item.ev} lane={x.lane} lanes={x.lanes} />
            ) : (
              <ExternalBlock ev={x.item.ev} lane={x.lane} lanes={x.lanes} />
            )
          }
        </For>
        <Ghost date={p.date} />
        <Show when={() => p.date() === today()}>
          <Box position="absolute" left={0} right={0} top={() => (now() / 60) * HOUR - 1} height={2} background={() => colors.now} />
          <Box position="absolute" left={-4} top={() => (now() / 60) * HOUR - 4} width={8} height={8} radius={4} background={() => colors.now} />
        </Show>
      </Box>
    );
  };

  return (
    <Column grow={1} onPointerUp={finish}>
      {/* Day names, and the tasks due each day (all-day row). */}
      <Row padding={[0, 10, 0, 0]}>
        <Box width={GUTTER} />
        <Index each={week}>
          {(date, i) => {
            const d = () => parseIso(date())!;
            const isToday = () => date() === today();
            const selected = () => ui.selectedDay() === date();
            return (
              <Column
                grow={1}
                width={0}
                gap={4}
                padding={[8, 6, 6, 6]}
                cursor="pointer"
                background={() => (selected() ? colors.active : "#00000000")}
                hoverStyle={{ background: () => colors.hover }}
                onClick={(e) => (e.clicks >= 2 ? (ui.setView("editor"), ws.openDaily(date())) : ui.setSelectedDay(date()))}
              >
                <Row gap={6} align="center">
                  <Text fontSize={12} color={() => (isToday() ? colors.now : theme.text.secondary)}>{WEEKDAYS_SHORT[i]!}</Text>
                  <Box
                    width={26}
                    height={26}
                    radius={13}
                    align="center"
                    justify="center"
                    background={() => (isToday() ? colors.today : "#00000000")}
                  >
                    <Text fontSize={15} bold color={() => (isToday() ? colors.todayText : theme.text.primary)}>
                      {() => String(d().getDate())}
                    </Text>
                  </Box>
                </Row>
                <For each={() => (props.days().get(date())?.external ?? []).filter((e) => e.allDay).slice(0, 2)}>
                  {(e) => (
                    <Row
                      padding={[1, 6]}
                      radius={4}
                      cursor="pointer"
                      background={() => tint(colorOf(e))}
                      onClick={() => ui.setExternalDetail(e)}
                    >
                      <Text fontSize={11} maxLines={1}>{e.title}</Text>
                    </Row>
                  )}
                </For>
                <For each={() => (props.days().get(date())?.tasks ?? []).filter((t) => t.due === date()).slice(0, 2)}>
                  {(t) => (
                    <Row padding={[1, 6]} radius={4} background={() => colors.tagBg}>
                      <Text fontSize={11} maxLines={1} color={() => (t.done ? theme.text.secondary : colors.link)}>{t.text}</Text>
                    </Row>
                  )}
                </For>
              </Column>
            );
          }}
        </Index>
      </Row>
      <Box height={1} background={() => colors.border} />
      <Scroll grow={1} ref={(el) => (scroller = el)}>
        <Row padding={[8, 10, 8, 0]}>
          <Box width={GUTTER} height={24 * HOUR}>
            <For each={() => HOURS.slice(1)}>
              {(h) => (
                <Text position="absolute" right={8} top={h * HOUR - 8} fontSize={11} color={() => theme.text.secondary}>
                  {formatTime(h * 60)}
                </Text>
              )}
            </For>
          </Box>
          <Index each={week}>{(date, i) => <DayColumn date={date} index={i} />}</Index>
        </Row>
      </Scroll>

      <Dialog
        open={() => editing() !== null}
        onClose={() => setEditing(null)}
        title={() => (editing()?.ev ? "Editar evento" : "Novo evento")}
        actions={
          <>
            <Show when={() => editing()?.ev}>
              <Button
                label="Excluir"
                variant="danger"
                onClick={() => {
                  ws.deleteEvent(editing()!.ev!);
                  setEditing(null);
                }}
              />
              <Button
                label="Abrir nota"
                variant="flat"
                onClick={() => {
                  const ev = editing()!.ev!;
                  setEditing(null);
                  ui.setView("editor");
                  ws.open(ev.path, { offset: ev.offset });
                }}
              />
            </Show>
            <Box grow={1} />
            <Button label="Cancelar" variant="flat" onClick={() => setEditing(null)} />
            <Button label="Salvar" variant="primary" onClick={save} />
          </>
        }
      >
        <Text fontSize={13} color={() => theme.text.secondary}>{() => (editing() ? longDate(editing()!.date) : "")}</Text>
        <TextField value={title} onInput={setTitle} onSubmit={save} placeholder="Título do evento" />
        <Row gap={8} align="center">
          <Select width={110} value={start} onChange={(v) => (setStart(v), end() <= v && setEnd(Math.min(DAY, v + DEFAULT_LENGTH)))} options={TIME_OPTIONS.slice(0, -1)} />
          <Text color={() => theme.text.secondary}>até</Text>
          <Select width={110} value={end} onChange={setEnd} options={TIME_OPTIONS.filter((o) => o.value > start())} />
        </Row>
      </Dialog>
    </Column>
  );
}
