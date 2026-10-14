// What the screen shows (panels, dialogs), apart from the vault data in workspace.ts.

import { createSignal } from "@nodebuilderjs/core";
import { parseIso, today } from "./dates.js";
import type { EditorApi } from "./editor/Editor.js";

export type LeftTab = "files" | "search" | "tags";
export type RightTab = "backlinks" | "outgoing" | "outline";
export type View = "home" | "calendar" | "editor" | "graph";
export type CalendarMode = "month" | "week";

export function createUi() {
  const [leftTab, setLeftTab] = createSignal<LeftTab>("files");
  const [leftOpen, setLeftOpen] = createSignal(true);
  const [rightTab, setRightTab] = createSignal<RightTab>("backlinks");
  const [rightOpen, setRightOpen] = createSignal(true);
  const [view, setView] = createSignal<View>("home");
  // The calendar's month (0..11) and selected day, shared by the home screen and the calendar.
  const now = new Date();
  const [month, setMonth] = createSignal({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = createSignal(today());
  const [calendarMode, setCalendarMode] = createSignal<CalendarMode>("week");
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
    month, setMonth,
    calendarMode, setCalendarMode,
    selectedDay,
    /** Selects a day and shows its month. */
    setSelectedDay(iso: string) {
      const d = parseIso(iso)!;
      setSelectedDay(iso);
      setMonth({ year: d.getFullYear(), month: d.getMonth() });
    },
    goToday() {
      const d = new Date();
      setSelectedDay(today());
      setMonth({ year: d.getFullYear(), month: d.getMonth() });
    },
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
