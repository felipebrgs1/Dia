// Obsidian-like colors on top of nodebuilder's theme. Read them inside functions
// (`background={() => colors.sidebar}`): each getter follows setTheme().

import { colorScheme, darkTheme, lightTheme, setTheme, theme } from "@nodebuilderjs/core";
import type { Role } from "./editor/layout.js";

const dark = {
  editor: "#1e1e1e",
  sidebar: "#262626",
  ribbon: "#202020",
  border: "#ffffff14",
  hover: "#ffffff0f",
  active: "#ffffff1c",
  faint: "#6c6c6c",
  codeBg: "#2a2a2a",
  highlight: "#7f6df24d",
  link: "#a88bfa",
  tag: "#a88bfa",
  tagBg: "#a88bfa26",
  graphNode: "#9a9a9a",
  graphEdge: "#ffffff26",
};

const light: typeof dark = {
  editor: "#ffffff",
  sidebar: "#f6f6f6",
  ribbon: "#eeeeee",
  border: "#00000014",
  hover: "#0000000a",
  active: "#00000014",
  faint: "#ababab",
  codeBg: "#f3f3f3",
  highlight: "#ffe56b80",
  link: "#705dcf",
  tag: "#705dcf",
  tagBg: "#705dcf1f",
  graphNode: "#8a8a8a",
  graphEdge: "#00000026",
};

export const colors = Object.fromEntries(
  Object.keys(dark).map((k) => [k, undefined]),
) as unknown as typeof dark;
for (const key of Object.keys(dark) as (keyof typeof dark)[]) {
  Object.defineProperty(colors, key, { get: () => (colorScheme() === "dark" ? dark : light)[key] });
}

/** Text color of a role from the editor layout. */
export function roleColor(role: Role): string {
  switch (role) {
    case "heading":
    case "text":
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
      return colorScheme() === "dark" ? "#e3a86f" : "#b5562c";
    case "highlight":
      return theme.text.primary;
  }
}

const purple = { base: "#7f6df2", hover: "#8f7ff5", pressed: "#6b58e0", text: "#ffffff" };

export function applyTheme(scheme: "light" | "dark") {
  if (scheme === "dark") {
    setTheme({
      ...darkTheme,
      accent: purple,
      window: { ...darkTheme.window, background: dark.editor },
      text: { primary: "#dadada", secondary: "#9e9e9e", inverted: "#1e1e1e" },
      field: { ...darkTheme.field, background: "#2a2a2a", focus: purple.base },
      card: { background: "#262626", border: "#ffffff14" },
      selection: "#7f6df259",
      focusRing: "#7f6df280",
    });
  } else {
    setTheme({
      ...lightTheme,
      accent: { base: "#705dcf", hover: "#7f6df2", pressed: "#5c49bd", text: "#ffffff" },
      window: { ...lightTheme.window, background: light.editor },
      field: { ...lightTheme.field, focus: "#705dcf" },
      selection: "#705dcf40",
      focusRing: "#705dcf80",
    });
  }
}
