// Ctrl+O: type part of a name, arrows to choose, Enter opens (or creates the note).

import { Card, Column, For, Overlay, Row, Scroll, Show, Text, TextField, createMemo, createSignal, theme } from "@nodebuilderjs/core";
import type { ElementRef } from "@nodebuilderjs/core";
import type { Ui } from "../ui.js";
import { folderOf, noteName } from "../vault/markdown.js";
import { type Workspace, fuzzyScore } from "../workspace.js";
import { colors } from "../theme.js";

export function QuickSwitcher(props: { ws: Workspace; ui: Ui }) {
  const { ws, ui } = props;
  const [query, setQuery] = createSignal("");
  const [selected, setSelected] = createSignal(0);
  const rows: ElementRef[] = [];

  const results = createMemo(() => {
    const q = query().trim();
    const scored: { path: string; score: number }[] = [];
    for (const path of ws.files()) {
      const score = fuzzyScore(q, noteName(path)) ?? (q ? fuzzyScore(q, path) : null);
      if (score !== null) scored.push({ path, score });
    }
    return scored.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path)).slice(0, 30);
  });

  const close = () => {
    ui.setSwitcher(false);
    queueMicrotask(() => ui.editor?.focus());
  };
  const choose = (i: number) => {
    const hit = results()[i];
    ui.setView("editor");
    if (hit) ws.open(hit.path);
    else if (query().trim()) ws.create(query().trim());
    close();
  };
  const move = (by: number) => {
    const n = results().length;
    if (!n) return;
    const i = (selected() + by + n) % n;
    setSelected(i);
    rows[i]?.scrollIntoView();
  };

  return (
    <Overlay modal background={() => theme.backdrop} align="center" padding={[90, 16, 16, 16]} onDismiss={close}>
      <Card width={560} padding={8} gap={6} background={() => colors.sidebar} shadow={{ color: "#00000060", blur: 30, y: 10 }}>
        <Column
          onKeyDown={(e) => {
            if (e.key === "Down" || (e.ctrl && e.key === "n")) move(1);
            else if (e.key === "Up" || (e.ctrl && e.key === "p")) move(-1);
            else if (e.key === "Escape") close();
            else return;
            e.stop();
          }}
        >
          <TextField
            ref={(el) => el.focus()}
            value={query}
            onInput={(v) => (setQuery(v), setSelected(0))}
            onSubmit={() => choose(selected())}
            placeholder="Encontre ou crie uma nota..."
          />
        </Column>
        <Scroll gap={1} maxHeight={380}>
          <For each={results}>
            {(r, i) => (
              <Row
                ref={(el) => (rows[i()] = el)}
                padding={[6, 10]}
                radius={4}
                gap={8}
                align="center"
                cursor="pointer"
                background={() => (selected() === i() ? colors.active : "#00000000")}
                onPointerEnter={() => setSelected(i())}
                onClick={() => choose(i())}
              >
                <Text maxLines={1} grow={1}>{noteName(r.path)}</Text>
                <Text maxLines={1} fontSize={12} color={() => theme.text.secondary}>{folderOf(r.path)}</Text>
              </Row>
            )}
          </For>
          <Show when={() => !results().length && query().trim()}>
            <Row padding={[6, 10]}>
              <Text color={() => theme.text.secondary}>{() => `Enter para criar "${query().trim()}"`}</Text>
            </Row>
          </Show>
        </Scroll>
        <Row gap={16} padding={[2, 10]}>
          <Text fontSize={12} color={() => theme.text.secondary}>↑↓ navegar</Text>
          <Text fontSize={12} color={() => theme.text.secondary}>↵ abrir</Text>
          <Text fontSize={12} color={() => theme.text.secondary}>esc fechar</Text>
        </Row>
      </Card>
    </Overlay>
  );
}
