// A task from any note: checkbox (writes to the note), text and where it lives.

import { Checkbox, Row, Show, Text, theme } from "@nodebuilderjs/core";
import { noteLabel, shortDate, today } from "../dates.js";
import { colors } from "../theme.js";
import type { VaultTask, Workspace } from "../workspace.js";

export function TaskRow(props: { ws: Workspace; task: VaultTask; showNote?: boolean; onOpen: () => void }) {
  const t = props.task;
  const overdue = !t.done && !!t.due && t.due < today();
  return (
    <Row gap={10} align="center" padding={[5, 8]} radius={6} hoverStyle={{ background: () => colors.hover }}>
      <Checkbox ariaLabel={t.text} checked={() => t.done} onChange={() => props.ws.toggleTask(t.path, t.offset)} />
      <Text
        grow={1}
        maxLines={2}
        cursor="pointer"
        color={() => (t.done ? theme.text.secondary : theme.text.primary)}
        onClick={props.onOpen}
      >
        {t.text || "(sem texto)"}
      </Text>
      <Show when={() => t.due}>
        <Row padding={[2, 8]} radius={10} background={() => (overdue ? "#e01b2422" : colors.tagBg)}>
          <Text fontSize={12} color={() => (overdue ? theme.danger.base : colors.link)}>{() => shortDate(t.due!)}</Text>
        </Row>
      </Show>
      <Show when={() => props.showNote}>
        <Text fontSize={12} maxLines={1} maxWidth={140} color={() => theme.text.secondary}>{noteLabel(t.path)}</Text>
      </Show>
    </Row>
  );
}
