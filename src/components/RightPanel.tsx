// Right sidebar: backlinks, outgoing links and the outline of the open note.

import { Column, For, Icon, Match, Row, Scroll, Switch, Text, createMemo, theme } from "@nodebuilderjs/core";
import { fileText, link as linkIcon, listTree } from "../icons.js";
import type { Ui } from "../ui.js";
import { noteName } from "../vault/markdown.js";
import type { Workspace } from "../workspace.js";
import { IconButton, Item } from "./Item.js";

function Empty(props: { text: string }) {
  return <Text color={() => theme.text.secondary} fontSize={13} padding={8}>{props.text}</Text>;
}

export function RightPanel(props: { ws: Workspace; ui: Ui }) {
  const { ws, ui } = props;
  const backlinks = createMemo(() => {
    const path = ws.active();
    return path ? ws.backlinks(path) : [];
  });
  const outgoing = createMemo(() => {
    const path = ws.active();
    if (!path) return [];
    const seen = new Set<string>();
    return ws.outgoing(path).filter(({ link }) => !seen.has(link.target.toLowerCase()) && !!seen.add(link.target.toLowerCase()));
  });
  const headings = createMemo(() => {
    const path = ws.active();
    return path ? ws.headings(path) : [];
  });
  const go = (path: string, offset?: number) => {
    ui.setView("editor");
    ws.open(path, { offset });
  };

  return (
    <Column grow={1}>
      <Row padding={[6, 8]} gap={2} justify="center">
        <IconButton icon={linkIcon} tip="Backlinks" active={() => ui.rightTab() === "backlinks"} onClick={() => ui.setRightTab("backlinks")} />
        <IconButton icon={fileText} tip="Links de saída" active={() => ui.rightTab() === "outgoing"} onClick={() => ui.setRightTab("outgoing")} />
        <IconButton icon={listTree} tip="Sumário" active={() => ui.rightTab() === "outline"} onClick={() => ui.setRightTab("outline")} />
      </Row>
      <Scroll grow={1} padding={[0, 8, 8, 8]} gap={2}>
        <Switch>
          <Match when={() => ui.rightTab() === "backlinks"}>
            <Text bold fontSize={13} padding={[4, 8]}>{() => `Backlinks (${backlinks().length})`}</Text>
            <For each={backlinks} fallback={<Empty text="Nenhuma nota aponta para esta." />}>
              {(b) => (
                <Item onClick={() => go(b.path, b.offset)}>
                  <Column gap={2} grow={1}>
                    <Text bold maxLines={1} color={() => theme.text.primary}>{noteName(b.path)}</Text>
                    <Text fontSize={12} maxLines={2}>{b.line}</Text>
                  </Column>
                </Item>
              )}
            </For>
          </Match>
          <Match when={() => ui.rightTab() === "outgoing"}>
            <Text bold fontSize={13} padding={[4, 8]}>{() => `Links de saída (${outgoing().length})`}</Text>
            <For each={outgoing} fallback={<Empty text="Esta nota não tem links." />}>
              {({ link, to }) => (
                <Item onClick={() => (ui.setView("editor"), ws.openLink(link.target))}>
                  <Icon svg={fileText} size={14} />
                  <Text maxLines={1} grow={1} color={() => (to ? theme.text.primary : theme.text.secondary)}>
                    {to ? noteName(to) : `${link.target} (não criada)`}
                  </Text>
                </Item>
              )}
            </For>
          </Match>
          <Match when={() => ui.rightTab() === "outline"}>
            <Text bold fontSize={13} padding={[4, 8]}>Sumário</Text>
            <For each={headings} fallback={<Empty text="Sem títulos nesta nota." />}>
              {(h) => (
                <Item indent={(h.level - 1) * 12} onClick={() => ws.active() && go(ws.active()!, h.offset)}>
                  <Text maxLines={1} grow={1}>{h.text}</Text>
                </Item>
              )}
            </For>
          </Match>
        </Switch>
      </Scroll>
    </Column>
  );
}
