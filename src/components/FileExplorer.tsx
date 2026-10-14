// The vault's folders and notes as a tree, with a context menu (right click).

import { Card, Column, For, Icon, Overlay, Row, Scroll, Show, Text, createEffect, createMemo, createSignal, theme, untrack } from "@nodebuilderjs/core";
import { chevronDown, chevronRight, filePlus, pencil, trash2 as trash } from "../icons.js";
import { colors } from "../theme.js";
import type { Ui } from "../ui.js";
import { noteName } from "../vault/markdown.js";
import type { Workspace } from "../workspace.js";
import { Item } from "./Item.js";

interface TreeNode {
  name: string;
  path: string;
  folder: boolean;
  children: TreeNode[];
}

function buildTree(files: string[], folders: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", folder: true, children: [] };
  const byPath = new Map<string, TreeNode>([["", root]]);
  const folderNode = (path: string): TreeNode => {
    const found = byPath.get(path);
    if (found) return found;
    const slash = path.lastIndexOf("/");
    const node: TreeNode = { name: path.slice(slash + 1), path, folder: true, children: [] };
    folderNode(slash < 0 ? "" : path.slice(0, slash)).children.push(node);
    byPath.set(path, node);
    return node;
  };
  for (const f of folders) folderNode(f);
  for (const f of files) {
    const slash = f.lastIndexOf("/");
    folderNode(slash < 0 ? "" : f.slice(0, slash)).children.push({ name: noteName(f), path: f, folder: false, children: [] });
  }
  // Folders first, then notes, each alphabetically (as Obsidian does).
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (a.folder !== b.folder ? (a.folder ? -1 : 1) : a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

export function FileExplorer(props: { ws: Workspace; ui: Ui }) {
  const { ws, ui } = props;
  const tree = createMemo(() => buildTree(ws.files(), ws.folders()));
  const [expanded, setExpanded] = createSignal(new Set<string>());
  const [menu, setMenu] = createSignal<{ node: TreeNode; x: number; y: number } | null>(null);
  const toggle = (path: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  // The folders around the open note open by themselves.
  createEffect(() => {
    const path = ws.active();
    if (!path) return;
    const parents: string[] = [];
    for (let i = path.indexOf("/"); i >= 0; i = path.indexOf("/", i + 1)) parents.push(path.slice(0, i));
    if (parents.some((f) => !untrack(expanded).has(f))) setExpanded((s) => new Set([...s, ...parents]));
  });

  const TreeRows = (p: { nodes: () => TreeNode[]; depth: number }) => (
    <For each={p.nodes}>
      {(node) =>
        node.folder ? (
          <Column>
            <Item indent={p.depth * 14} onClick={() => toggle(node.path)} onContextMenu={(e) => setMenu({ node, x: e.x, y: e.y })}>
              <Icon svg={() => (expanded().has(node.path) ? chevronDown : chevronRight)} size={14} />
              <Text maxLines={1} grow={1}>{node.name}</Text>
            </Item>
            <Show when={() => expanded().has(node.path)}>
              <TreeRows nodes={() => node.children} depth={p.depth + 1} />
            </Show>
          </Column>
        ) : (
          <Item
            indent={p.depth * 14 + 20}
            active={() => ws.active() === node.path}
            onClick={() => {
              ui.setView("editor");
              ws.open(node.path);
            }}
            onContextMenu={(e) => setMenu({ node, x: e.x, y: e.y })}
          >
            <Text maxLines={1} grow={1}>{node.name}</Text>
          </Item>
        )
      }
    </For>
  );

  const MenuItem = (p: { label: string; icon: string; danger?: boolean; onClick: () => void }) => (
    <Item
      onClick={() => {
        setMenu(null);
        p.onClick();
      }}
    >
      <Icon svg={p.icon} size={16} color={() => (p.danger ? theme.danger.base : theme.text.secondary)} />
      <Text color={() => (p.danger ? theme.danger.base : theme.text.primary)}>{p.label}</Text>
    </Item>
  );

  return (
    <Column grow={1}>
      <Scroll grow={1} padding={[4, 8, 8, 8]} gap={1}>
        <TreeRows nodes={tree} depth={0} />
      </Scroll>
      <Show when={menu}>
        {(m) => (
          <Overlay at={{ x: m().x, y: m().y }} onDismiss={() => setMenu(null)}>
            <Card padding={4} gap={0} width={190} background={() => colors.sidebar} shadow={{ color: "#00000050", blur: 16, y: 4 }}>
              <Show
                when={() => m().node.folder}
                fallback={
                  <Column>
                    <MenuItem label="Renomear" icon={pencil} onClick={() => ui.setRenaming(m().node.path)} />
                    <MenuItem label="Excluir" icon={trash} danger onClick={() => ui.setDeleting(m().node.path)} />
                  </Column>
                }
              >
                <MenuItem label="Nova nota aqui" icon={filePlus} onClick={() => (ui.setView("editor"), ws.create("Sem título", m().node.path))} />
              </Show>
            </Card>
          </Overlay>
        )}
      </Show>
    </Column>
  );
}
