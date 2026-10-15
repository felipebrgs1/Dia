// A task from any note: checkbox (writes to the note), text and where it lives.

import { Checkbox, Row, Show, Text } from "@nodebuilderjs/core";
import { useWorkspace } from "../context.js";
import { noteLabel, shortDate, today } from "../dates.js";
import type { VaultTask } from "../workspace.js";

export function TaskRow(props: { task: VaultTask; showNote?: boolean; onOpen: () => void }) {
  const ws = useWorkspace();
  const t = props.task;
  const overdue = !t.done && !!t.due && t.due < today();
  return (
    <Row gap={10} align="center" padding={[5, 8]} radius={6} hoverStyle={{ background: "hover" }}>
      <Checkbox ariaLabel={t.text} checked={() => t.done} onChange={() => ws.toggleTask(t.path, t.offset)} />
      <Text
        grow={1}
        maxLines={2}
        cursor="pointer"
        color={() => (t.done ? "text.secondary" : "text.primary")}
        onClick={props.onOpen}
      >
        {t.text || "(sem texto)"}
      </Text>
      <Show when={() => t.status === "doing"}>
        <Row padding={[2, 8]} radius={10} background="active">
          <Text variant="small" bold color="accent.pressed">fazendo</Text>
        </Row>
      </Show>
      <Show when={() => t.due}>
        <Row padding={[2, 8]} radius={10} background={() => (overdue ? "overdueBg" : "tagBg")}>
          <Text fontSize={12} color={() => (overdue ? "danger.base" : "link")}>{() => shortDate(t.due!)}</Text>
        </Row>
      </Show>
      <Show when={() => props.showNote}>
        <Text variant="caption" maxLines={1} maxWidth={140}>{noteLabel(t.path)}</Text>
      </Show>
    </Row>
  );
}
