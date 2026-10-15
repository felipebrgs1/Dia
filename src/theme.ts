// Dia's colors: warm paper and amber, light first, with a warm dark mode. Components use them
// by name (`background="sidebar"`, `color="text.secondary"`), resolved when painting so they
// follow setTheme(); code that needs the value (Canvas drawing) reads `colors.sidebar`.

import { createThemeTokens, darkTheme, defineTextVariants, lightTheme, setTheme, theme } from "@nodebuilderjs/core";
import type { Role } from "./editor/layout.js";

// Accents (link, today, event bar, now) are oklch: past sRGB on Display P3 screens, clipped to
// sRGB elsewhere. They were #a3620a, #e8a317, #d99a06 and #d9480f (dark: #f2c14e, #f2b632,
// #f2b632, #ff7a45), with chroma pushed 60% of the way to the P3 edge.
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
  link: "oklch(55.7% 0.134 65.2)",
  tag: "link",
  tagBg: "#f2c14e33",
  code: "#a24d1f",
  today: "oklch(76.3% 0.172 77.3)",
  todayText: "#2b1d00",
  weekend: "#f6efdd",
  event: "#f6d88a",
  eventBar: "oklch(72.9% 0.164 79.1)",
  eventDone: "#efe6cf",
  todayColumn: "#fff4d6",
  now: "oklch(60% 0.209 37.9)",
  graphNode: "#b3a37c",
  graphEdge: "#5a461426",
  /** Status dot of the "Feito" board column. */
  done: "#3f9142",
  overdueBg: "#e01b2422",
  /** Shadows, from the softest (resting cards) to the strongest (a card being dragged). */
  shadowSoft: "#5a46140d",
  shadowCard: "#5a46140f",
  shadow: "#5a46141f",
  shadowHover: "#5a46142e",
  shadowLifted: "#5a461440",
  /** Shadows of floating panels: context menu and quick switcher. */
  shadowMenu: "#00000050",
  shadowModal: "#00000060",
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
  link: "oklch(83.4% 0.175 85.4)",
  tag: "link",
  tagBg: "#f2b63226",
  code: "#e8a66f",
  today: "oklch(81.1% 0.177 82.1)",
  todayText: "#1f1c16",
  weekend: "#232019",
  event: "#5a4515",
  eventBar: "oklch(81.1% 0.177 82.1)",
  eventDone: "#2f2a20",
  todayColumn: "#272216",
  now: "oklch(72.7% 0.204 41.2)",
  graphNode: "#8f8670",
  graphEdge: "#fff3d626",
  done: "#6cc070",
  overdueBg: "#ff5c5c26",
  shadowSoft: "#00000026",
  shadowCard: "#0000002e",
  shadow: "#00000047",
  shadowHover: "#00000066",
  shadowLifted: "#00000080",
  shadowMenu: "#00000080",
  shadowModal: "#00000099",
};

export const colors = createThemeTokens({ light, dark });

// `<Text variant="muted">` (secondary, same size) and `"caption"` (12 px) come with nodebuilder;
// `"small"` is for hints and labels inside chips.
defineTextVariants({ small: { fontSize: 11, color: "text.secondary" } });

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
