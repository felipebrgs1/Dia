// What the screen shows (panels, dialogs), apart from the vault data in workspace.ts.

import { createSignal } from "@nodebuilderjs/core";
import type { EditorApi } from "./editor/Editor.js";

export type LeftTab = "files" | "search" | "tags";
export type RightTab = "backlinks" | "outgoing" | "outline";

export function createUi() {
  const [leftTab, setLeftTab] = createSignal<LeftTab>("files");
  const [leftOpen, setLeftOpen] = createSignal(true);
  const [rightTab, setRightTab] = createSignal<RightTab>("backlinks");
  const [rightOpen, setRightOpen] = createSignal(true);
  const [view, setView] = createSignal<"editor" | "graph">("editor");
  const [switcher, setSwitcher] = createSignal(false);
  const [renaming, setRenaming] = createSignal<string | null>(null);
  const [deleting, setDeleting] = createSignal<string | null>(null);
  const [newFolder, setNewFolder] = createSignal(false);
  const [query, setQuery] = createSignal("");
  let editor: EditorApi | undefined;

  return {
    leftTab, setLeftTab, leftOpen, setLeftOpen,
    rightTab, setRightTab, rightOpen, setRightOpen,
    view, setView,
    switcher, setSwitcher,
    renaming, setRenaming,
    deleting, setDeleting,
    newFolder, setNewFolder,
    query, setQuery,
    setEditor: (api: EditorApi) => (editor = api),
    get editor() {
      return editor;
    },
  };
}

export type Ui = ReturnType<typeof createUi>;
