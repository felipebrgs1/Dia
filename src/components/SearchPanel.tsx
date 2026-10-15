// Full-text search over the vault and the list of tags.

import { Column, For, Row, Scroll, Show, Text, TextField, createMemo } from "@nodebuilderjs/core";
import { useUi, useWorkspace } from "../context.js";
import { noteName } from "../vault/markdown.js";
import { Item } from "./Item.js";

/** A line of text cut around a match, so the match shows even in long lines. */
export function snippet(line: string, column: number, width = 60) {
  const start = Math.max(0, column - 20);
  const cut = line.slice(start, start + width).trim();
  return (start > 0 ? "…" : "") + cut + (start + width < line.length ? "…" : "");
}

export function SearchPanel() {
  const ws = useWorkspace();
  const ui = useUi();
  const hits = createMemo(() => ws.search(ui.query()));
  const total = () => hits().reduce((n, h) => n + Math.max(1, h.matches.length), 0);
  const openAt = (path: string, offset?: number) => {
    ui.setView("editor");
    ws.open(path, { offset });
  };
  return (
    <Column grow={1} gap={8} padding={[8, 8, 0, 8]}>
      <TextField ref={(el) => el.focus()} value={ui.query} onInput={ui.setQuery} placeholder="Buscar nas notas..." />
      <Show when={() => ui.query().trim()}>
        <Text variant="caption" padding={[0, 4]}>
          {() => (hits().length ? `${total()} resultado(s) em ${hits().length} nota(s)` : "Nada encontrado")}
        </Text>
      </Show>
      <Scroll grow={1} gap={6} padding={[0, 0, 8, 0]}>
        <For each={hits}>
          {(hit) => (
            <Column gap={1}>
              <Item onClick={() => openAt(hit.path)}>
                <Text bold maxLines={1} color="text.primary">{noteName(hit.path)}</Text>
              </Item>
              <For each={() => hit.matches}>
                {(m) => (
                  <Item indent={12} onClick={() => openAt(hit.path, m.offset)}>
                    <Text fontSize={13} maxLines={2} grow={1}>{snippet(m.line, m.column)}</Text>
                  </Item>
                )}
              </For>
            </Column>
          )}
        </For>
      </Scroll>
    </Column>
  );
}

export function TagsPanel() {
  const ws = useWorkspace();
  const ui = useUi();
  return (
    <Scroll grow={1} padding={8} gap={2}>
      <For each={ws.tags} fallback={<Text variant="muted" padding={8}>Nenhuma tag. Escreva #tag em uma nota.</Text>}>
        {([tag, count]) => (
          <Item
            onClick={() => {
              ui.setQuery(`#${tag}`);
              ui.setLeftTab("search");
            }}
          >
            <Row radius={4} padding={[1, 6]} background="tagBg">
              <Text color="tag">{`#${tag}`}</Text>
            </Row>
            <Text grow={1} />
            <Text fontSize={12}>{String(count)}</Text>
          </Item>
        )}
      </For>
    </Scroll>
  );
}
