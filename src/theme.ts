// Dia's colors: warm paper and amber, light first, with a warm dark mode. Components use them
// by name (`background="sidebar"`, `color="text.secondary"`), resolved when painting so they
// follow setTheme(); code that needs the value (Canvas drawing) reads `colors.sidebar`.
//
// Every color is oklch for Display P3: the palette's saturation relative to the P3 gamut, so
// accents look more vivid on wide-gamut screens. Without a P3 surface, color.ts maps each one
// back into sRGB (no clipping); there they look exactly like the original hex palette.

import {
  type Theme,
  createEffect,
  createThemeTokens,
  darkTheme,
  defineTextVariants,
  lightTheme,
  outputColorSpace,
  setTheme,
  theme,
  untrack,
} from "@nodebuilderjs/core";
import { display, forScreen } from "./color.js";
import type { Role } from "./editor/layout.js";

const light = forScreen({
  /** The page: notes, home, calendar. */
  page: "oklch(99.37% 0.0113 93.57)",
  sidebar: "oklch(96.15% 0.0269 89.79)",
  titlebar: "oklch(93.81% 0.039 89.14)",
  card: "oklch(98.62% 0.0176 84.58)",
  border: "oklch(40.52% 0.0821 86.32 / 0.122)",
  hover: "oklch(54.19% 0.1201 86.08 / 0.078)",
  active: "oklch(83.41% 0.1626 85.43 / 0.251)",
  faint: "oklch(73.94% 0.05 90.29)",
  codeBg: "oklch(94.98% 0.0305 89.21)",
  highlight: "oklch(89.49% 0.179 92.18 / 0.6)",
  link: "oklch(55.65% 0.1392 65.15)",
  tag: "link",
  tagBg: "oklch(83.41% 0.1626 85.43 / 0.2)",
  code: "oklch(51.98% 0.1436 45.86)",
  today: "oklch(76.29% 0.1783 77.31)",
  todayText: "oklch(24.18% 0.0573 83.05)",
  weekend: "oklch(95.28% 0.0305 89.21)",
  event: "oklch(89.04% 0.1259 89.2)",
  eventBar: "oklch(72.85% 0.1729 79.09)",
  eventDone: "oklch(92.6% 0.0392 89.14)",
  todayColumn: "oklch(96.81% 0.0497 90.24)",
  now: "oklch(59.99% 0.2148 37.88)",
  graphNode: "oklch(71.94% 0.0652 88.32)",
  graphEdge: "oklch(40.52% 0.0821 86.32 / 0.149)",
  /** Status dot of the "Feito" board column. */
  done: "oklch(58.68% 0.1814 144.18)",
  overdueBg: "oklch(57.86% 0.2527 26.62 / 0.133)",
  /** Shadows, from the softest (resting cards) to the strongest (a card being dragged). */
  shadowSoft: "oklch(40.52% 0.0821 86.32 / 0.051)",
  shadowCard: "oklch(40.52% 0.0821 86.32 / 0.059)",
  shadow: "oklch(40.52% 0.0821 86.32 / 0.122)",
  shadowHover: "oklch(40.52% 0.0821 86.32 / 0.18)",
  shadowLifted: "oklch(40.52% 0.0821 86.32 / 0.251)",
  /** Shadows of floating panels: context menu and quick switcher. */
  shadowMenu: "oklch(0% 0 0 / 0.314)",
  shadowModal: "oklch(0% 0 0 / 0.376)",
});

const dark: typeof light = forScreen({
  page: "oklch(22.77% 0.0139 84.55)",
  sidebar: "oklch(24.98% 0.0162 81.64)",
  titlebar: "oklch(20.92% 0.0136 91.78)",
  card: "oklch(26.2% 0.0179 84.53)",
  border: "oklch(96.61% 0.049 88.2 / 0.102)",
  hover: "oklch(96.61% 0.049 88.2 / 0.059)",
  active: "oklch(81.09% 0.1765 82.06 / 0.2)",
  faint: "oklch(55.85% 0.0401 86.44)",
  codeBg: "oklch(27.85% 0.0177 84.54)",
  highlight: "oklch(81.09% 0.1765 82.06 / 0.349)",
  link: "oklch(83.41% 0.1626 85.43)",
  tag: "link",
  tagBg: "oklch(81.09% 0.1765 82.06 / 0.149)",
  code: "oklch(77.64% 0.1333 60.14)",
  today: "oklch(81.09% 0.1765 82.06)",
  todayText: "oklch(22.77% 0.0139 84.55)",
  weekend: "oklch(24.44% 0.0156 87.57)",
  event: "oklch(40.3% 0.0806 84.53)",
  eventBar: "oklch(81.09% 0.1765 82.06)",
  eventDone: "oklch(28.72% 0.0218 84.49)",
  todayColumn: "oklch(25.38% 0.0259 87.98)",
  now: "oklch(72.66% 0.2227 41.2)",
  graphNode: "oklch(62.19% 0.0388 88.41)",
  graphEdge: "oklch(96.61% 0.049 88.2 / 0.149)",
  done: "oklch(73.47% 0.1895 144.98)",
  overdueBg: "oklch(69.09% 0.2526 23.91 / 0.149)",
  shadowSoft: "oklch(0% 0 0 / 0.149)",
  shadowCard: "oklch(0% 0 0 / 0.18)",
  shadow: "oklch(0% 0 0 / 0.278)",
  shadowHover: "oklch(0% 0 0 / 0.4)",
  shadowLifted: "oklch(0% 0 0 / 0.502)",
  shadowMenu: "oklch(0% 0 0 / 0.502)",
  shadowModal: "oklch(0% 0 0 / 0.6)",
});

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

/** Every oklch color of a theme for the window's color space (see color.ts). */
function onScreen<T>(value: T): T {
  if (typeof value === "string") return display(value) as T;
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, onScreen(v)])) as T;
}

let scheme: "light" | "dark" = "light";

/**
 * The window learns its color space (P3 or sRGB) when it opens, after the first theme was set:
 * rebuild the theme then. App tokens need nothing, they map their colors when read.
 */
export function followColorSpace() {
  createEffect(() => {
    outputColorSpace();
    untrack(() => applyTheme(scheme));
  });
}

export function applyTheme(next: "light" | "dark") {
  scheme = next;
  if (next === "light") {
    const amber = { base: "oklch(74.99% 0.176 79.91)", hover: "oklch(78.63% 0.178 82.15)", pressed: "oklch(68.33% 0.1628 77.51)", text: "oklch(24.18% 0.0573 83.05)" };
    setTheme(onScreen<Theme>({
      ...lightTheme,
      accent: amber,
      window: { ...lightTheme.window, background: light.page, border: "oklch(40.52% 0.0821 86.32 / 0.2)" },
      text: { primary: "oklch(26.98% 0.0292 90.68)", secondary: "oklch(54.77% 0.0434 88.07)", inverted: "oklch(99.37% 0.0113 93.57)" },
      control: { base: "oklch(40.52% 0.0821 86.32 / 0.078)", hover: "oklch(40.52% 0.0821 86.32 / 0.129)", pressed: "oklch(40.52% 0.0821 86.32 / 0.188)", text: "oklch(26.98% 0.0292 90.68)" },
      field: { background: "oklch(99.67% 0.0064 95.1)", border: "oklch(40.52% 0.0821 86.32 / 0.2)", focus: amber.base, placeholder: "oklch(71.92% 0.0499 91.79)" },
      card: { background: light.card, border: light.border },
      divider: light.border,
      selection: "oklch(83.41% 0.1626 85.43 / 0.349)",
      focusRing: "oklch(74.99% 0.176 79.91 / 0.502)",
      tooltip: { background: "oklch(26.98% 0.0292 90.68 / 0.922)", text: "oklch(99.37% 0.0113 93.57)" },
    }));
  } else {
    const amber = { base: "oklch(81.09% 0.1765 82.06)", hover: "oklch(83.51% 0.164 83.57)", pressed: "oklch(73.48% 0.1681 79.79)", text: "oklch(22.77% 0.0139 84.55)" };
    setTheme(onScreen<Theme>({
      ...darkTheme,
      accent: amber,
      window: { ...darkTheme.window, background: dark.page, border: "oklch(96.61% 0.049 88.2 / 0.122)" },
      text: { primary: "oklch(91.96% 0.0357 89.58)", secondary: "oklch(70.34% 0.0423 90.57)", inverted: "oklch(22.77% 0.0139 84.55)" },
      control: { base: "oklch(96.61% 0.049 88.2 / 0.078)", hover: "oklch(96.61% 0.049 88.2 / 0.122)", pressed: "oklch(96.61% 0.049 88.2 / 0.18)", text: "oklch(91.96% 0.0357 89.58)" },
      field: { background: "oklch(27.03% 0.0178 84.54)", border: "oklch(96.61% 0.049 88.2 / 0.141)", focus: amber.base, placeholder: "oklch(55.85% 0.0401 86.44)" },
      card: { background: dark.card, border: dark.border },
      divider: dark.border,
      selection: "oklch(81.09% 0.1765 82.06 / 0.251)",
      focusRing: "oklch(81.09% 0.1765 82.06 / 0.502)",
    }));
  }
}
