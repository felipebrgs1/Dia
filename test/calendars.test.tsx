// External calendars (iCal). Dates are checked in a fixed time zone.
process.env.TZ = "America/Sao_Paulo";

import { expect, test } from "bun:test";
import { findByText, interact, mount } from "@nodebuilderjs/core/testing";
import { click } from "@nodebuilderjs/core/testing";
import { App } from "../src/App.js";
import { parseIcs, toDayEvents } from "../src/calendars/ics.js";
import { createCalendars, normalizeUrl } from "../src/calendars/store.js";
import { today } from "../src/dates.js";
import { memoryVault } from "../src/vault/vault.js";
import { sampleIcs, welcomeNotes } from "../src/vault/welcome.js";

const fixture = await Bun.file(new URL("./fixtures/sample.ics", import.meta.url)).text();
const tick = () => new Promise((r) => setTimeout(r, 0));

test("ics: recurrences, exceptions, time zones, all-day and cancelled events", () => {
  const occ = parseIcs(fixture, new Date(2026, 9, 1), new Date(2026, 9, 20));
  const show = occ.map((o) => `${o.title} ${o.start.getDate()}/${o.start.getMonth() + 1} ${o.start.getHours()}:${String(o.start.getMinutes()).padStart(2, "0")}${o.allDay ? " dia" : ""}`);
  expect(show).toEqual([
    "Daily de equipe 5/10 10:00", // 09:00 New York (EDT) = 10:00 São Paulo
    "Feriado 12/10 0:00 dia",
    "Daily de equipe (remarcada) 12/10 12:00", // RECURRENCE-ID moved it to 11:00 NY
    "Daily de equipe 14/10 10:00", // 7/10 was removed by EXDATE
    "Plantão 14/10 20:00",
    "Daily de equipe 19/10 10:00",
  ]);
  // Over midnight: one piece per day.
  const night = toDayEvents(occ.filter((o) => o.title === "Plantão"), "c");
  expect(night.map((e) => [e.date, e.start, e.end])).toEqual([["2026-10-14", 1200, 1440], ["2026-10-15", 0, 120]]);
  const holiday = toDayEvents(occ.filter((o) => o.allDay), "c");
  expect(holiday.map((e) => [e.date, e.allDay])).toEqual([["2026-10-12", true]]);
  expect(normalizeUrl(" webcal://exemplo.com/a.ics ")).toBe("https://exemplo.com/a.ics");
});

test("store: downloads, caches, reports errors and reopens from the cache offline", async () => {
  const vault = memoryVault();
  const calls: string[] = [];
  const cals = createCalendars(vault, {
    fetcher: async (url) => {
      calls.push(url);
      if (url.includes("quebrado")) throw new Error("HTTP 404");
      return sampleIcs();
    },
  });
  const id = cals.add("Trabalho", "webcal://exemplo.com/cal.ics");
  await tick();
  expect(calls).toEqual(["https://exemplo.com/cal.ics"]);
  expect(cals.status(id).state).toBe("ok");
  expect(cals.events().some((e) => e.title === "Dentista" && e.date === today())).toBe(true);

  const bad = cals.add("Quebrado", "https://quebrado/x.ics");
  await tick();
  expect(cals.status(bad)).toMatchObject({ state: "error", error: "HTTP 404" });

  // Turning a calendar off hides its events; the config is saved in .dia/.
  cals.update(id, { enabled: false });
  expect(cals.events().length).toBe(0);
  expect(JSON.parse(vault.readMeta("config.json")!).calendars.map((c: { name: string }) => c.name)).toEqual(["Trabalho", "Quebrado"]);

  // A new session with no network still has the last download.
  cals.update(id, { enabled: true });
  await tick();
  const offline = createCalendars(vault, { fetcher: async () => Promise.reject(new Error("offline")) });
  expect(offline.events().some((e) => e.title === "Dentista")).toBe(true);
  await tick();
  expect(offline.status(id).state).toBe("error");
  expect(offline.status(id).events).toBeGreaterThan(0);
});

test("app: external events show on the home screen and open their details", async () => {
  const vault = memoryVault(welcomeNotes());
  vault.writeMeta("config.json", JSON.stringify({ calendars: [{ id: "w", name: "Trabalho", url: "https://x", color: "#3b82f6", enabled: true }] }));
  const app = mount(() => <App vault={vault} fetcher={async () => sampleIcs()} />, { width: 1320, height: 840 });
  await tick();
  app.relayout();
  const ui = interact(app.root);
  const dentista = findByText(app.root, "Dentista")!; // in "Agenda de hoje"
  expect(dentista).toBeDefined();
  dentista.scrollIntoView();
  app.relayout();
  ui.press(dentista);
  ui.release(dentista);
  app.relayout();
  expect(findByText(app.root, "Rua das Flores, 120")).toBeDefined();
  // A copy goes into today's note as a regular event.
  click(findByText(app.root, "Copiar para a nota do dia")!);
  app.relayout();
  await new Promise((r) => setTimeout(r, 450));
  expect(vault.read(`Diário/${today()}.md`)).toContain("- 17:30 - 18:30 Dentista");
});
