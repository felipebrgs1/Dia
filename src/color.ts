// Dia's colors are written in oklch for Display P3. When the window gets no P3 surface (X11,
// compositors without color management), nodebuilder would clip them to sRGB, which flattens
// the saturated ones and shifts their hue. `forScreen()` maps them instead: same lightness and
// hue, chroma scaled by how far sRGB reaches compared to P3 at that lightness and hue, so each
// color keeps its saturation relative to the gamut (the palette's sRGB originals, exactly).

import { outputColorSpace } from "@nodebuilderjs/core";

type Rgb = [number, number, number];

function oklchToLinearSrgb(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const toP3 = ([r, g, b]: Rgb): Rgb => [0.8224621 * r + 0.177538 * g, 0.0331941 * r + 0.9668058 * g, 0.0170827 * r + 0.0723974 * g + 0.9105199 * b];
const inside = (rgb: Rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

/** The largest chroma at lightness `l` and hue `h` that stays inside sRGB (or P3). */
function maxChroma(l: number, h: number, p3: boolean) {
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const rgb = oklchToLinearSrgb(l, mid, h);
    if (inside(p3 ? toP3(rgb) : rgb)) lo = mid;
    else hi = mid;
  }
  return lo;
}

const encode = (v: number) => {
  const c = Math.min(1, Math.max(0, v));
  return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
};
const hex = (n: number) => n.toString(16).padStart(2, "0");

const cache = new Map<string, string>();

/** `oklch(L% C h / a)` mapped into sRGB as hex; anything else is returned as is. */
export function toSrgb(css: string): string {
  const hit = cache.get(css);
  if (hit) return hit;
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/.exec(css);
  if (!m) return css;
  const l = Number(m[1]) / 100;
  const h = Number(m[3]);
  const p3 = maxChroma(l, h, true);
  const c = p3 > 1e-6 ? (Number(m[2]) * maxChroma(l, h, false)) / p3 : 0;
  const rgb = oklchToLinearSrgb(l, c, h).map(encode);
  const alpha = m[4] === undefined ? "" : hex(Math.round(Number(m[4]) * 255));
  const out = `#${rgb.map(hex).join("")}${alpha}`;
  cache.set(css, out);
  return out;
}

/** `css` for the window's color space: as written on Display P3, mapped into sRGB otherwise. */
export function display(css: string): string {
  return outputColorSpace() === "display-p3" ? css : toSrgb(css);
}

/** The same colors, each read through `display()` (getters, so they follow the color space). */
export function forScreen<T extends Record<string, string>>(colors: T): T {
  const out = {} as T;
  for (const key of Object.keys(colors)) Object.defineProperty(out, key, { enumerable: true, get: () => display(colors[key]!) });
  return out;
}
