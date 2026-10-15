// The app's state, shared through context instead of passed by hand: `useWorkspace()` (vault
// data), `useUi()` (what the screen shows) and `useCalendars()` (external calendars). Provided
// once in App.tsx; read them in the component body, not inside a handler.

import { createContext, useContext } from "@nodebuilderjs/core";
import type { Calendars } from "./calendars/store.js";
import type { Ui } from "./ui.js";
import type { Workspace } from "./workspace.js";

export interface AppState {
  ws: Workspace;
  ui: Ui;
  cals: Calendars;
}

const AppContext = createContext<AppState | null>(null);

export const AppProvider = AppContext.Provider;

function useApp(): AppState {
  const app = useContext(AppContext);
  if (!app) throw new Error("useWorkspace/useUi/useCalendars outside <AppProvider>");
  return app;
}

export const useWorkspace = () => useApp().ws;
export const useUi = () => useApp().ui;
export const useCalendars = () => useApp().cals;
