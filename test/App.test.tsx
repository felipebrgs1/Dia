import { afterEach, expect, test } from "bun:test";
import { setTheme } from "@nodebuilderjs/core";
import { click, findAll, findByLabel, findByText, interact, mount } from "@nodebuilderjs/core/testing";
import { App } from "../src/App.js";
import { today, weekOf } from "../src/dates.js";
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
  expect(findByText(root, /^5 notas · 3 links/)).toBeDefined();
});

test("week view: events show in the grid, click edits, drag on empty space creates", async () => {
  const { root, ui, relayout, vault } = setup();
  click(findByText(root, "Calendário")!);
  relayout();
  expect(findAll(root, (n) => n.label === 'Text "Reunião de equipe"').length).toBeGreaterThan(0); // tomorrow

  // Clicking an event opens its editor; renaming rewrites the line. (The grid opens scrolled
  // near the current time, so bring the 09:00 event into view first.)
  const ev = findByText(root, "Planejar o dia")!;
  ev.scrollIntoView();
  relayout();
  ui.press(ev);
  ui.release(ev);
  relayout();
  expect(findByText(root, "Editar evento")).toBeDefined();
  await Promise.resolve(); // the dialog focuses its field in a microtask
  ui.type(" cedo");
  ui.key("Return");
  relayout();
  await saved();
  expect(vault.read(`Diário/${today()}.md`)).toContain("- 09:00 - 10:00 Planejar o dia cedo");

  // Drag down an empty stretch of a day with no events: a new event there.
  const columns = findAll(root, (n) => n.label === "Box" && n.style.height === 24 * 48 && n.style.cursor === "default");
  expect(columns.length).toBe(7);
  const index = (new Date().getDay() + 3) % 7; // neither today nor tomorrow
  const col = columns[index]!;
  let scroll = col.parent!;
  while (scroll.label !== "Scroll") scroll = scroll.parent!;
  const y0 = scroll.y + 60; // inside the visible part of the grid
  const startMin = Math.floor(((y0 - col.y) / 48) * 60 / 15) * 15;
  ui.down(col.x + 10, y0);
  ui.move(col.x + 10, y0 + 48);
  ui.up(col.x + 10, y0 + 48);
  relayout();
  expect(findByText(root, "Novo evento")).toBeDefined();
  await Promise.resolve();
  ui.type("Cinema");
  ui.key("Return");
  relayout();
  await saved();
  const date = weekOf(today())[index]!;
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  expect(vault.read(`Diário/${date}.md`)).toContain(`- ${fmt(startMin)} - `);
  expect(vault.read(`Diário/${date}.md`)).toContain(" Cinema");
});

test("week view: dragging an event moves it to another day and time", async () => {
  const { root, ui, relayout, vault } = setup();
  click(findByText(root, "Calendário")!);
  relayout();
  const columns = findAll(root, (n) => n.label === "Box" && n.style.height === 24 * 48 && n.style.cursor === "default");
  const todayIndex = new Date().getDay();
  if (todayIndex === 6) return; // Saturday: "the next day" is in another week
  const lunch = findByText(root, "Almoço")!;
  lunch.scrollIntoView();
  relayout();
  // One column to the right and one hour down: tomorrow, 13:30 – 14:30.
  ui.drag(lunch, columns[todayIndex + 1]!.x - columns[todayIndex]!.x, 48);
  relayout();
  await saved();
  const tomorrow = weekOf(today())[todayIndex + 1]!;
  expect(vault.read(`Diário/${today()}.md`)).not.toContain("Almoço");
  expect(vault.read(`Diário/${tomorrow}.md`)).toContain("- 13:30 - 14:30 Almoço");
});
