// External calendars: the settings dialog (add an iCal link, color, on/off, refresh, remove),
// the details of an external event, and the agenda row shared by the home screen and the
// calendar's day panel.

import { Box, Button, Column, Dialog, For, Icon, Row, Show, Text, TextField, Toggle, colorScheme, createSignal, theme } from "@nodebuilderjs/core";
import type { ExternalEvent } from "../calendars/ics.js";
import { CALENDAR_COLORS, type Calendars } from "../calendars/store.js";
import { longDate } from "../dates.js";
import { mapPin, refreshCw, trash2 } from "../icons.js";
import { colors } from "../theme.js";
import type { Ui } from "../ui.js";
import { formatTime } from "../vault/events.js";
import type { VaultEvent, Workspace } from "../workspace.js";
import { IconButton } from "./Item.js";

/** Translucent version of a calendar color, for event backgrounds. */
export const tint = (color: string) => `${color}${colorScheme() === "dark" ? "4d" : "3d"}`;

function ago(ms?: number) {
  if (!ms) return "nunca atualizado";
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "atualizado agora";
  if (min < 60) return `atualizado há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `atualizado há ${h} h` : `atualizado em ${new Date(ms).toLocaleDateString("pt-BR")}`;
}

function Swatches(props: { value: () => string; onChange: (c: string) => void }) {
  return (
    <Row gap={6}>
      <For each={() => CALENDAR_COLORS}>
        {(c) => (
          <Box
            width={20}
            height={20}
            radius={10}
            cursor="pointer"
            background={c}
            borderWidth={() => (props.value() === c ? 2 : 0)}
            borderColor={() => theme.text.primary}
            onClick={() => props.onChange(c)}
          />
        )}
      </For>
    </Row>
  );
}

export function CalendarsDialog(props: { cals: Calendars; ui: Ui }) {
  const { cals, ui } = props;
  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [color, setColor] = createSignal(CALENDAR_COLORS[0]!);
  const [error, setError] = createSignal("");
  const add = () => {
    if (!/^(https?|webcals?):\/\//i.test(url().trim())) return setError("Cole o link completo (começa com https:// ou webcal://).");
    cals.add(name() || "Calendário", url(), color());
    setName("");
    setUrl("");
    setError("");
    setColor(CALENDAR_COLORS[cals.sources().length % CALENDAR_COLORS.length]!);
  };

  return (
    <Dialog
      open={ui.calendarsOpen}
      onClose={() => ui.setCalendarsOpen(false)}
      title="Calendários externos"
      width={560}
      actions={<Button label="Fechar" variant="primary" onClick={() => ui.setCalendarsOpen(false)} />}
    >
      <Text fontSize={13} color={() => theme.text.secondary}>
        Só leitura: os eventos aparecem no Dia, mas nada é enviado de volta. Atualiza a cada 15 minutos.
      </Text>
      <Column gap={6}>
        <For each={cals.sources} fallback={<Text fontSize={13} color={() => colors.faint}>Nenhum calendário ainda.</Text>}>
          {(s) => {
            const st = () => cals.status(s.id);
            return (
              <Row gap={10} align="center" padding={[8, 10]} radius={8} background={() => colors.sidebar}>
                <Box width={12} height={12} radius={6} background={s.color} />
                <Column grow={1} width={0} gap={2}>
                  <Text bold maxLines={1}>{s.name}</Text>
                  <Text fontSize={12} maxLines={1} color={() => (st().state === "error" ? theme.danger.base : theme.text.secondary)}>
                    {() => {
                      const v = st();
                      if (v.state === "loading") return "Atualizando…";
                      if (v.state === "error") return `Erro: ${v.error}`;
                      return `${v.events} eventos · ${ago(v.syncedAt)}`;
                    }}
                  </Text>
                </Column>
                <Toggle ariaLabel={`Mostrar ${s.name}`} checked={() => s.enabled} onChange={(on) => cals.update(s.id, { enabled: on })} />
                <IconButton icon={refreshCw} tip="Atualizar agora" onClick={() => void cals.refresh(s.id)} size={15} />
                <IconButton icon={trash2} tip="Remover" onClick={() => cals.remove(s.id)} size={15} />
              </Row>
            );
          }}
        </For>
      </Column>
      <Box height={1} background={() => colors.border} />
      <Text bold>Adicionar calendário</Text>
      <TextField value={name} onInput={setName} placeholder="Nome (ex.: Trabalho)" />
      <TextField value={url} onInput={(v) => (setUrl(v), setError(""))} onSubmit={add} placeholder="Link iCal (.ics)" />
      <Row gap={12} align="center">
        <Swatches value={color} onChange={setColor} />
        <Box grow={1} />
        <Button label="Adicionar" variant="primary" disabled={() => !url().trim()} onClick={add} />
      </Row>
      <Show when={error}>
        <Text fontSize={12} color={() => theme.danger.base}>{error}</Text>
      </Show>
      <Text fontSize={12} color={() => theme.text.secondary}>
        Google Agenda: Configurações → escolha o calendário → "Integrar agenda" → "Endereço secreto no formato iCal".
        Outlook: Configurações → Calendário → Calendários compartilhados → Publicar → link ICS.
      </Text>
    </Dialog>
  );
}

export function ExternalEventDialog(props: { cals: Calendars; ws: Workspace; ui: Ui }) {
  const { cals, ws, ui } = props;
  const ev = ui.externalDetail;
  const when = () => {
    const e = ev();
    if (!e) return "";
    const day = longDate(e.date).replace(/^./, (c) => c.toUpperCase());
    if (e.allDay) return `${day} · dia inteiro`;
    const sameDay = e.from.toDateString() === new Date(e.to.getTime() - 1).toDateString();
    const t = (d: Date) => formatTime(d.getHours() * 60 + d.getMinutes());
    return sameDay ? `${day} · ${t(e.from)} – ${t(e.to)}` : `${day} · ${t(e.from)} até ${e.to.toLocaleDateString("pt-BR")} ${t(e.to)}`;
  };
  return (
    <Dialog
      open={() => ev() !== null}
      onClose={() => ui.setExternalDetail(null)}
      title={() => ev()?.title ?? ""}
      actions={
        <>
          <Show when={() => !ev()?.allDay}>
            <Button
              label="Copiar para a nota do dia"
              variant="flat"
              onClick={() => {
                const e = ev()!;
                ws.addEvent(e.date, e.start, e.end, e.title);
                ui.setExternalDetail(null);
              }}
            />
          </Show>
          <Button label="Fechar" variant="primary" onClick={() => ui.setExternalDetail(null)} />
        </>
      }
    >
      <Row gap={8} align="center">
        <Box width={10} height={10} radius={5} background={() => cals.source(ev()?.calendarId ?? "")?.color ?? colors.faint} />
        <Text fontSize={13} color={() => theme.text.secondary}>{() => cals.source(ev()?.calendarId ?? "")?.name ?? ""}</Text>
      </Row>
      <Text>{when}</Text>
      <Show when={() => ev()?.location}>
        <Row gap={6} align="center">
          <Icon svg={mapPin} size={14} color={() => theme.text.secondary} />
          <Text fontSize={13} grow={1} selectable>{() => ev()?.location ?? ""}</Text>
        </Row>
      </Show>
      <Show when={() => ev()?.description}>
        <Text fontSize={13} maxLines={8} selectable color={() => theme.text.secondary}>{() => ev()?.description ?? ""}</Text>
      </Show>
    </Dialog>
  );
}

/** One line of a day's agenda: a note event or an external one. */
export function AgendaRow(props: {
  title: string;
  start: number;
  end: number;
  allDay?: boolean;
  color?: string;
  faded?: () => boolean;
  onClick: () => void;
}) {
  return (
    <Row
      gap={10}
      padding={[6, 8]}
      radius={6}
      cursor="pointer"
      background={() => (props.color ? tint(props.color) : colors.event)}
      opacity={() => (props.faded?.() ? 0.55 : 1)}
      hoverStyle={{ opacity: 0.85 }}
      onClick={props.onClick}
    >
      <Box width={3} radius={2} background={() => props.color ?? colors.eventBar} />
      <Column grow={1} gap={1}>
        <Text bold maxLines={2}>{props.title}</Text>
        <Text fontSize={12} color={() => theme.text.secondary}>
          {props.allDay ? "Dia inteiro" : `${formatTime(props.start)} – ${formatTime(props.end)}`}
        </Text>
      </Column>
    </Row>
  );
}

/** A day's items, note events and external ones, in time order (all-day first). */
export type AgendaItem = { start: number; end: number; allDay: boolean } & (
  | { kind: "note"; ev: VaultEvent }
  | { kind: "external"; ev: ExternalEvent }
);

export function agendaOf(notes: VaultEvent[], external: ExternalEvent[]): AgendaItem[] {
  const items: AgendaItem[] = [
    ...notes.map((ev) => ({ kind: "note" as const, ev, start: ev.start, end: ev.end, allDay: false })),
    ...external.map((ev) => ({ kind: "external" as const, ev, start: ev.start, end: ev.end, allDay: ev.allDay })),
  ];
  return items.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
}
