import { describe, expect, test } from "bun:test";
import { toSrgb } from "../src/color.js";

describe("toSrgb", () => {
  test("maps the P3 palette back to its sRGB originals", () => {
    expect(toSrgb("oklch(99.37% 0.0113 93.57)")).toBe("#fffdf6"); // page, nearly neutral
    expect(toSrgb("oklch(76.29% 0.1783 77.31)")).toBe("#e8a317"); // today, saturated
    expect(toSrgb("oklch(58.68% 0.1814 144.18)")).toBe("#3f9142"); // done, green
    expect(toSrgb("oklch(40.52% 0.0821 86.32 / 0.122)")).toBe("#5a46141f"); // with alpha
    expect(toSrgb("oklch(0% 0 0 / 0.6)")).toBe("#00000099");
  });

  test("leaves other colors and token names alone", () => {
    expect(toSrgb("#3b82f6")).toBe("#3b82f6");
    expect(toSrgb("link")).toBe("link");
    expect(toSrgb("transparent")).toBe("transparent");
  });
});
