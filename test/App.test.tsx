import { afterEach, expect, test } from "bun:test";
import { setTheme } from "@nodebuilderjs/core";
import { findAll, findByText, interact, mount } from "@nodebuilderjs/core/testing";
import { App } from "../src/App.js";
import { memoryVault } from "../src/vault/vault.js";
import { WELCOME } from "../src/vault/welcome.js";

// Tests run without a window, over a vault kept in memory.

afterEach(() => setTheme("light"));

function setup() {
  const vault = memoryVault({ ...WELCOME });
  const app = mount(() => <App vault={vault} />, { width: 1280, height: 800 });
  const ui = interact(app.root);
  const editor = () => findAll(app.root, (n) => n.label === "Box" && n.focusable)[0]!;
  return { ...app, ui, vault, editor };
}

test("opens the welcome note and lists the vault", () => {
  const { root } = setup();
  expect(findByText(root, "Bem-vindo")).toBeDefined();
  expect(findByText(root, "Links internos")).toBeDefined();
  expect(findByText(root, "Ideias")).toBeDefined();
  expect(findByText(root, /^Backlinks \(\d+\)$/)).toBeDefined();
});

test("typing in the editor saves the note, Ctrl+Z undoes it", async () => {
  const { ui, vault, editor } = setup();
  const saved = () => new Promise((r) => setTimeout(r, 450));
  ui.press(editor());
  ui.release(editor());
  ui.key("End", { ctrl: true });
  ui.type("mais palavras");
  await saved();
  expect(vault.read("Bem-vindo.md").endsWith("#inicio\nmais palavras")).toBe(true);
  ui.key("z", { ctrl: true });
  await saved();
  expect(vault.read("Bem-vindo.md")).toBe(WELCOME["Bem-vindo.md"]!);
});

test("Ctrl+O opens the quick switcher and Enter opens the note", async () => {
  const { root, ui, relayout, editor } = setup();
  ui.press(editor());
  ui.release(editor());
  ui.key("o", { ctrl: true });
  relayout();
  await Promise.resolve();
  ui.type("grafo");
  ui.key("Return");
  relayout();
  expect(findByText(root, /Encontre ou crie/)).toBeUndefined();
  // The breadcrumb shows the open note.
  expect(findAll(root, (n) => n.label === 'Text "Visão de grafo"').length).toBeGreaterThan(0);
});

test("Ctrl+G shows the graph of notes and links", () => {
  const { root, ui, relayout, editor } = setup();
  ui.press(editor());
  ui.release(editor());
  ui.key("g", { ctrl: true });
  relayout();
  // Links count once per pair of notes, whatever the direction.
  expect(findByText(root, /^4 notas · 4 links/)).toBeDefined();
});
