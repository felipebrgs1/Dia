import { expect, test } from "bun:test";
import { caretRect, hitTest, layoutDocument } from "../src/editor/layout.js";
import { createDocument } from "../src/editor/model.js";
import { countWords, parseHeadings, parseLinks, parseTags, renameLinks, resolveLink } from "../src/vault/markdown.js";
import { memoryVault } from "../src/vault/vault.js";
import { createWorkspace, fuzzyScore } from "../src/workspace.js";

// 8 px per character, like the test text measurer.
const measure = (t: string, size: number) => ({ width: t.length * 8 * (size / 16), height: 20 });

test("wikilinks, headings and tags are parsed outside code blocks", () => {
  const text = "# Title\nSee [[Other note#Part|alias]] and [[x]].\n```\n[[not a link]] #nope\n```\n#tag here";
  expect(parseLinks(text).map((l) => [l.target, l.heading, l.alias])).toEqual([["Other note", "Part", "alias"], ["x", undefined, undefined]]);
  expect(parseHeadings(text)).toEqual([{ level: 1, text: "Title", offset: 0 }]);
  expect(parseTags(text)).toEqual(["tag"]);
  expect(countWords("Olá, mundo! São 3 palavras")).toBe(5);
});

test("links resolve by name or path, ignoring case", () => {
  const paths = ["A.md", "Ideias/Projetos.md", "Outra/Projetos longos.md"];
  expect(resolveLink("projetos", paths)).toBe("Ideias/Projetos.md");
  expect(resolveLink("Outra/Projetos longos", paths)).toBe("Outra/Projetos longos.md");
  expect(resolveLink("nada", paths)).toBeUndefined();
  expect(renameLinks("[[A]] [[a#h|x]] [[B]]", "A", "Z")).toBe("[[Z]] [[Z#h|x]] [[B]]");
});

test("typing, undo and smart lists in the document model", () => {
  const doc = createDocument();
  doc.reset("- item");
  doc.moveTo(6);
  doc.newline();
  expect(doc.text()).toBe("- item\n- ");
  doc.newline(); // Enter on an empty item ends the list
  expect(doc.text()).toBe("- item\n");
  doc.insertText("1. um");
  doc.newline();
  expect(doc.text()).toBe("- item\n1. um\n2. ");
  doc.undo();
  expect(doc.text()).toBe("- item\n1. um");

  doc.reset("- [ ] tarefa");
  expect(doc.toggleTask(3)).toBe(true);
  expect(doc.text()).toBe("- [x] tarefa");
  doc.moveTo(12);
  doc.newline();
  expect(doc.text()).toBe("- [x] tarefa\n- [ ] ");
  doc.backspace(); // right after the marker: removes it
  expect(doc.text()).toBe("- [x] tarefa\n");
});

test("selection, wrap and indent", () => {
  const doc = createDocument();
  doc.reset("palavra");
  doc.select(0, 7);
  doc.wrap("**");
  expect(doc.text()).toBe("**palavra**");
  expect(doc.selectedText()).toBe("palavra");
  doc.wrap("**");
  expect(doc.text()).toBe("palavra");

  doc.reset("- a\n- b");
  doc.select(0, 7);
  doc.indent();
  expect(doc.text()).toBe("    - a\n    - b");
  doc.outdent();
  expect(doc.text()).toBe("- a\n- b");
});

test("layout wraps long lines and maps points to offsets", () => {
  const text = "# Title\none two three four five six";
  const L = layoutDocument(text, 100, measure, 16);
  // "one two three four five six" at 8 px per char in 100 px: several rows.
  const bodyRows = L.rows.filter((r) => r.line === 1);
  expect(bodyRows.length).toBeGreaterThan(1);
  expect(bodyRows.every((r) => r.segments.every((s) => s.x + s.width - 8 <= 100))).toBe(true);
  // The heading is bigger.
  expect(L.rows[0]!.height).toBeGreaterThan(bodyRows[0]!.height);
  // Round trip: the caret position of an offset hits that same offset.
  for (const offset of [8, 12, 20, text.length]) {
    const c = caretRect(L, offset);
    expect(hitTest(L, c.x, c.y + c.height / 2)).toBe(offset);
  }
});

test("layout marks links and code blocks", () => {
  const L = layoutDocument("see [[Note]]\n```\ncode\n```", 400, measure, 16);
  const link = L.rows[0]!.segments.find((s) => s.style.role === "link");
  expect(link?.link).toBe("Note");
  expect(L.lines.map((l) => l.block)).toEqual(["none", "code", "code", "code"]);
});

test("workspace: create, links, backlinks, rename and search", () => {
  const vault = memoryVault({ "A.md": "Link to [[B]]", "B.md": "# B\nhello world" });
  const ws = createWorkspace(vault, { saveDelay: 0 });
  expect(ws.files()).toEqual(["A.md", "B.md"]);
  expect(ws.backlinks("B.md").map((b) => b.path)).toEqual(["A.md"]);

  ws.write("B.md", "# B\nhello there");
  ws.flush();
  expect(vault.read("B.md")).toBe("# B\nhello there");

  expect(ws.rename("B.md", "C")).toBe("C.md");
  expect(ws.read("A.md")).toBe("Link to [[C]]");
  expect(vault.read("A.md")).toBe("Link to [[C]]");
  expect(ws.backlinks("C.md").length).toBe(1);

  const hits = ws.search("THERE");
  expect(hits.map((h) => h.path)).toEqual(["C.md"]);
  expect(hits[0]!.matches[0]!.line).toBe("hello there");

  ws.open("A.md");
  ws.openLink("Nova ideia"); // a link to a missing note creates it
  expect(ws.active()).toBe("Nova ideia.md");
  ws.goBack();
  expect(ws.active()).toBe("A.md");
  ws.goForward();
  expect(ws.active()).toBe("Nova ideia.md");
  ws.remove("A.md");
  expect(ws.files()).toEqual(["C.md", "Nova ideia.md"]);
});

test("fuzzy matching for the quick switcher", () => {
  expect(fuzzyScore("bv", "Bem-vindo")).not.toBeNull();
  expect(fuzzyScore("xyz", "Bem-vindo")).toBeNull();
  expect(fuzzyScore("bem", "Bem-vindo")!).toBeLessThan(fuzzyScore("bvo", "Bem-vindo")!);
});

test("graph physics: a dragged note pulls its neighbors, then everything settles", async () => {
  const { createSimulation, physics, running, tick } = await import("../src/graph/physics.js");
  const node = (x: number, y: number) => ({ x, y, vx: 0, vy: 0, fx: null as number | null, fy: null as number | null, degree: 0 });
  // A chain 0 - 1 - 2 and a loose node 3.
  const sim = createSimulation([node(0, 0), node(70, 0), node(140, 0), node(0, 200)], [[0, 1], [1, 2]]);
  for (let i = 0; i < 300; i++) tick(sim);

  const [a, b, c, loose] = sim.nodes;
  const looseBefore = { x: loose!.x, y: loose!.y };
  const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
  // Drag node 0 far away, holding it there.
  a!.fx = a!.x + 600;
  a!.fy = a!.y;
  sim.alphaTarget = physics.dragAlpha;
  sim.alpha = physics.dragAlpha;
  for (let i = 0; i < 200; i++) tick(sim);
  expect(a!.x).toBe(a!.fx!);
  expect(dist(a!, b!)).toBeLessThan(physics.linkDistance * 2); // the neighbor came along
  expect(dist(b!, c!)).toBeLessThan(physics.linkDistance * 2); // and its neighbor too
  expect(dist(loose!, looseBefore)).toBeLessThan(dist(b!, { x: 70, y: 0 })); // the unlinked one barely moves

  // Let go: it cools down and stops.
  a!.fx = a!.fy = null;
  sim.alphaTarget = 0;
  let ticks = 0;
  while (running(sim) && ticks < 1000) (tick(sim), ticks++);
  expect(running(sim)).toBe(false);
});

test("tasks: parsed with due dates and toggled in place", async () => {
  const { parseTasks, toggleTaskAt } = await import("../src/vault/markdown.js");
  const text = "- [ ] comprar pão 📅 2026-10-15\n- [x] feito\n  - [ ] sub @2026-11-01\n```\n- [ ] no código\n```";
  expect(parseTasks(text)).toEqual([
    { offset: 0, done: false, status: "todo", text: "comprar pão", due: "2026-10-15" },
    { offset: 32, done: true, status: "done", text: "feito", due: undefined },
    { offset: 44, done: false, status: "todo", text: "sub", due: "2026-11-01" },
  ]);
  expect(toggleTaskAt(text, 32).split("\n")[1]).toBe("- [ ] feito");
  expect(toggleTaskAt(text, 0).startsWith("- [x] comprar")).toBe(true);
});

test("dates: month grid and names", async () => {
  const { monthGrid, longDate, addDays } = await import("../src/dates.js");
  const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
  expect(grid.length).toBe(42);
  expect(grid[0]).toBe("2026-09-27");
  expect(grid[4]).toBe("2026-10-01");
  expect(longDate("2026-10-14")).toBe("quarta-feira, 14 de outubro");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
});

test("workspace: daily notes, tasks and recent notes", () => {
  const vault = memoryVault({ "A.md": "- [ ] tarefa @2026-10-20" });
  const ws = createWorkspace(vault, { saveDelay: 0 });
  const path = ws.openDaily("2026-10-14");
  expect(path).toBe("Diário/2026-10-14.md");
  expect(ws.active()).toBe(path);
  expect(vault.read(path)).toContain("# quarta-feira, 14 de outubro");
  expect(ws.tasks().map((t) => [t.path, t.due])).toEqual([["A.md", "2026-10-20"]]);
  ws.toggleTask("A.md", 0);
  expect(ws.read("A.md")).toBe("- [x] tarefa @2026-10-20");
  expect(ws.recent()[0]).toBe("A.md");
});

test("the editor document takes outside changes and keeps the caret", () => {
  const doc = createDocument();
  doc.reset("- [ ] um\nfim");
  doc.moveTo(12); // inside "fim"
  doc.sync("- [x] um\nfim");
  expect(doc.text()).toBe("- [x] um\nfim");
  expect(doc.head()).toBe(12);
  doc.undo();
  expect(doc.text()).toBe("- [ ] um\nfim");
});

test("events: parsed from daily notes, rewritten in place, placed side by side", async () => {
  const ev = await import("../src/vault/events.js");
  const text = "# Dia\n\n## Agenda\n- 09:00 - 10:30 Planejar\n- [ ] 14:00 Ligar\n* 8:15–9:00 Café\n\n## Notas\n- 25:00 não é hora";
  const list = ev.parseEvents(text);
  expect(list.map((e) => [e.start, e.end, e.title, e.done])).toEqual([
    [495, 540, "Café", undefined],
    [540, 630, "Planejar", undefined],
    [840, 870, "Ligar", false],
  ]);
  const planejar = list[1]!;
  expect(ev.setEventTime(text, planejar.offset, 600, 660)).toContain("- 10:00 - 11:00 Planejar");
  expect(ev.setEventTitle(text, planejar.offset, "Planejar a semana")).toContain("- 09:00 - 10:30 Planejar a semana");
  expect(ev.removeLine(text, planejar.offset)).not.toContain("Planejar");

  // New events go into "## Agenda" in time order; the section is created when missing.
  expect(ev.insertEvent(text, "- 12:00 - 13:00 Almoço").split("\n").slice(3, 6)).toEqual([
    "- 09:00 - 10:30 Planejar",
    "- 12:00 - 13:00 Almoço",
    "- [ ] 14:00 Ligar",
  ]);
  expect(ev.insertEvent("# Dia\n\n## Notas\n", "- 08:00 - 09:00 X")).toBe("# Dia\n\n## Agenda\n- 08:00 - 09:00 X\n\n## Notas\n");

  const placed = ev.placeEvents([{ start: 0, end: 60 }, { start: 30, end: 90 }, { start: 60, end: 120 }, { start: 200, end: 230 }]);
  expect(placed.map((p) => [p.lane, p.lanes])).toEqual([[0, 2], [1, 2], [0, 2], [0, 1]]);
});

test("workspace: events move between days and are created in daily notes", () => {
  const vault = memoryVault({ "Diário/2026-10-14.md": "# Q\n\n## Agenda\n- 09:00 - 10:00 Reunião\n" });
  const ws = createWorkspace(vault, { saveDelay: 0 });
  const [reuniao] = ws.events();
  expect(reuniao).toMatchObject({ date: "2026-10-14", start: 540, title: "Reunião" });
  ws.moveEvent(reuniao!, "2026-10-15", 600, 660);
  expect(ws.read("Diário/2026-10-14.md")).not.toContain("Reunião");
  expect(ws.read("Diário/2026-10-15.md")).toContain("## Agenda\n- 10:00 - 11:00 Reunião");
  ws.addEvent("2026-10-15", 480, 510, "Café");
  expect(ws.events().map((e) => `${e.date} ${e.start} ${e.title}`)).toEqual(["2026-10-15 480 Café", "2026-10-15 600 Reunião"]);
});

test("task status: [/] is in progress; set, toggle and insert tasks", async () => {
  const { parseTasks, setTaskStatusAt, toggleTaskAt, insertTask } = await import("../src/vault/markdown.js");
  const text = "- [/] fazendo\n- [ ] 15:00 - 16:00 com hora";
  expect(parseTasks(text).map((t) => [t.status, t.text])).toEqual([["doing", "fazendo"], ["todo", "com hora"]]);
  expect(setTaskStatusAt(text, 0, "done").startsWith("- [x] fazendo")).toBe(true);
  expect(setTaskStatusAt(text, 14, "doing")).toContain("- [/] 15:00");
  expect(toggleTaskAt(text, 0).startsWith("- [x]")).toBe(true); // doing → done
  // The daily template's empty "- [ ] " is replaced; otherwise after the last task.
  expect(insertTask("# D\n\n## Tarefas\n- [ ] \n\n## Notas\n", "- [ ] Nova")).toBe("# D\n\n## Tarefas\n- [ ] Nova\n\n## Notas\n");
  expect(insertTask("## Tarefas\n- [x] a\nobs\n## Notas", "- [ ] b")).toBe("## Tarefas\n- [x] a\n- [ ] b\nobs\n## Notas");
  expect(insertTask("# Sem seção", "- [ ] c")).toBe("# Sem seção\n\n## Tarefas\n- [ ] c\n");
});

test("tray: dot when an event is near or happening, tooltip and what is left", async () => {
  const { trayState, trayIconSvg, SOON } = await import("../src/tray.js");
  const open = () => {};
  const day = [
    { title: "Daily", start: 570, end: 585, open }, // 09:30–09:45
    { title: "Dentista", start: 1050, end: 1110, open }, // 17:30–18:30
  ];
  expect(trayState(day, 480)).toMatchObject({ badge: null, tooltip: "Dia — próximo: Daily às 09:30" });
  expect(trayState(day, 570 - SOON)).toMatchObject({ badge: "soon", tooltip: "Dia — Daily às 09:30 (em 15 min)" });
  expect(trayState(day, 575)).toMatchObject({ badge: "now", tooltip: "Dia — agora: Daily (até 09:45)" });
  expect(trayState(day, 1045).badge).toBe("soon"); // 5 min before the dentist
  expect(trayState(day, 1200)).toMatchObject({ badge: null, tooltip: "Dia — nada mais na agenda hoje" });
  expect(trayState(day, 1000).left.map((e) => e.title)).toEqual(["Dentista"]);
  expect(trayIconSvg(null)).not.toContain("#e5372e");
  expect(trayIconSvg("soon")).toContain("#e5372e");
  expect(trayIconSvg("now")).toContain("#f08a24");
});
