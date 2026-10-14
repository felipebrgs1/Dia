// Dia's colors: warm paper and amber, light first, with a warm dark mode. Read them inside
// functions (`background={() => colors.sidebar}`): each getter follows setTheme().

import { createThemeTokens, darkTheme, lightTheme, setTheme, theme } from "@nodebuilderjs/core";
import type { Role } from "./editor/layout.js";

const light = {
  /** The page: notes, home, calendar. */
  page: "#fffdf6",
  sidebar: "#f8f2e2",
  titlebar: "#f3ead3",
  card: "#fffaf0",
  border: "#5a46141f",
  hover: "#8a6a1414",
  active: "#f2c14e40",
  faint: "#b5aa8c",
  codeBg: "#f5eedc",
  highlight: "#ffd95c99",
  link: "#a3620a",
  tag: "#a3620a",
  tagBg: "#f2c14e33",
  code: "#a24d1f",
  today: "#e8a317",
  todayText: "#2b1d00",
  weekend: "#f6efdd",
  event: "#f6d88a",
  eventBar: "#d99a06",
  eventDone: "#efe6cf",
  todayColumn: "#fff4d6",
  now: "#d9480f",
  graphNode: "#b3a37c",
  graphEdge: "#5a461426",
};

const dark: typeof light = {
  page: "#1f1c16",
  sidebar: "#25211a",
  titlebar: "#1a1812",
  card: "#28241c",
  border: "#fff3d61a",
  hover: "#fff3d60f",
  active: "#f2b63233",
  faint: "#7d735d",
  codeBg: "#2c2820",
  highlight: "#f2b63259",
  link: "#f2c14e",
  tag: "#f2c14e",
  tagBg: "#f2b63226",
  code: "#e8a66f",
  today: "#f2b632",
  todayText: "#1f1c16",
  weekend: "#232019",
  event: "#5a4515",
  eventBar: "#f2b632",
  eventDone: "#2f2a20",
  todayColumn: "#272216",
  now: "#ff7a45",
  graphNode: "#8f8670",
  graphEdge: "#fff3d626",
};

export const colors = createThemeTokens({ light, dark });

/** Text color of a role from the editor layout. */
export function roleColor(role: Role): string {
  switch (role) {
    case "heading":
    case "text":
    case "highlight":
      return theme.text.primary;
    case "muted":
    case "strike":
      return theme.text.secondary;
    case "faint":
      return colors.faint;
    case "accent":
      return theme.accent.base;
    case "link":
      return colors.link;
    case "tag":
      return colors.tag;
    case "code":
      return colors.code;
  }
}

export function applyTheme(scheme: "light" | "dark") {
  if (scheme === "light") {
    const amber = { base: "#e0a10f", hover: "#eaae22", pressed: "#c98c06", text: "#2b1d00" };
    setTheme({
      ...lightTheme,
      accent: amber,
      window: { ...lightTheme.window, background: light.page, border: "#5a461433" },
      text: { primary: "#2b2618", secondary: "#7a7058", inverted: "#fffdf6" },
      control: { base: "#5a461414", hover: "#5a461421", pressed: "#5a461430", text: "#2b2618" },
      field: { background: "#fffefa", border: "#5a461433", focus: amber.base, placeholder: "#aea486" },
      card: { background: light.card, border: light.border },
      divider: light.border,
      selection: "#f2c14e59",
      focusRing: "#e0a10f80",
      tooltip: { background: "#2b2618eb", text: "#fffdf6" },
    });
  } else {
    const amber = { base: "#f2b632", hover: "#f5c04d", pressed: "#d99d1c", text: "#1f1c16" };
    setTheme({
      ...darkTheme,
      accent: amber,
      window: { ...darkTheme.window, background: dark.page, border: "#fff3d61f" },
      text: { primary: "#ece4cf", secondary: "#a89f86", inverted: "#1f1c16" },
      control: { base: "#fff3d614", hover: "#fff3d61f", pressed: "#fff3d62e", text: "#ece4cf" },
      field: { background: "#2a261e", border: "#fff3d624", focus: amber.base, placeholder: "#7d735d" },
      card: { background: dark.card, border: dark.border },
      divider: dark.border,
      selection: "#f2b63240",
      focusRing: "#f2b63280",
    });
  }
}
