import { afterEach, expect, test } from "bun:test";
import { setTheme } from "@nodebuilderjs/core";
import { click, findAll, findByLabel, findByText, interact, mount } from "@nodebuilderjs/core/testing";
import { App } from "../src/App.js";
import { today } from "../src/dates.js";
import { memoryVault } from "../src/vault/vault.js";
import { welcomeNotes } from "../src/vault/welcome.js";

// Tests run without a window, over a vault kept in memory.

afterEach(() => setTheme("light"));

const saved = () => new Promise((r) => setTimeout(r, 450));

function setup(props: { note?: string } = {}) {
  const notes = welcomeNotes();
  const vault = memoryVault(notes);
  const app = mount(() => <App vault={vault} {...props} />, { width: 1320, height: 840 });
  const ui = interact(app.root);
  const editor = () => findAll(app.root, (n) => n.label === "Box" && n.focusable)[0]!;
  return { ...app, ui, vault, notes, editor };
}

test("starts on the home screen with greeting, open tasks and the sidebar", () => {
  const { root } = setup();
  expect(findByText(root, /^(Bom dia|Boa tarde|Boa noite)!$/)).toBeDefined();
  expect(findByText(root, "Tarefas abertas")).toBeDefined();
  expect(findByText(root, "Revisar as ideias")).toBeDefined();
  expect(findByText(root, "Notas recentes")).toBeDefined();
  expect(findByText(root, "Bem-vindo ao Dia")).toBeDefined(); // in the file tree
});

test("checking a task on the home screen writes it into its note", async () => {
  const { root, vault, relayout } = setup();
  click(findByLabel(root, "Revisar as ideias")!);
  relayout();
  await saved();
  expect(vault.read("Projetos/Dia.md")).toContain("- [x] Revisar as ideias");
});

test("typing in the editor saves the note, Ctrl+Z undoes it", async () => {
  const { ui, vault, notes, editor } = setup({ note: "Bem-vindo ao Dia.md" });
  ui.press(editor());
  ui.release(editor());
  ui.key("End", { ctrl: true });
  ui.type("mais palavras");
  await saved();
  expect(vault.read("Bem-vindo ao Dia.md").endsWith("#inicio\nmais palavras")).toBe(true);
  ui.key("z", { ctrl: true });
  await saved();
  expect(vault.read("Bem-vindo ao Dia.md")).toBe(notes["Bem-vindo ao Dia.md"]!);
});

test("Ctrl+K opens the quick switcher and Enter opens the note", () => {
  const { root, ui, relayout } = setup();
  ui.key("k", { ctrl: true });
  relayout();
  ui.type("links");
  ui.key("Return");
  relayout();
  expect(findByText(root, /Encontre ou crie/)).toBeUndefined();
  expect(findAll(root, (n) => n.label === 'Text "Links e tarefas"').length).toBeGreaterThan(1);
});

test("the calendar shows today's daily note and Ctrl+D opens it", () => {
  const { root, ui, relayout } = setup();
  click(findByText(root, "Calendário")!);
  relayout();
  expect(findByText(root, "HOJE")).toBeDefined();
  expect(findByText(root, "Abrir nota do dia")).toBeDefined();
  expect(findByText(root, "Criar a primeira nota")).toBeDefined(); // a task of today's note
  ui.key("d", { ctrl: true });
  relayout();
  expect(findByText(root, today())).toBeDefined(); // the note title
});

test("Ctrl+G shows the graph of notes and links", () => {
  const { root, ui, relayout } = setup();
  ui.key("g", { ctrl: true });
  relayout();
  // Links count once per pair of notes, whatever the direction.
  expect(findByText(root, /^4 notas · 2 links/)).toBeDefined();
});
