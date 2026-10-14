// iCalendar (.ics) feeds, read-only: what Google Calendar, Outlook, iCloud and Nextcloud give
// as a "secret iCal address". ical.js handles recurrences (RRULE, EXDATE, moved occurrences)
// and time zones (the feed's VTIMEZONEs); this module turns the result into per-day pieces in
// local time, like the events of the daily notes.

import ICAL from "ical.js";
import { isoDate } from "../dates.js";

export interface Occurrence {
  uid: string;
  title: string;
  location?: string;
  description?: string;
  start: Date;
  /** Exclusive. For all-day events, midnight after the last day. */
  end: Date;
  allDay: boolean;
}

/** One day's part of an external event (an event over midnight gives two). */
export interface ExternalEvent {
  calendarId: string;
  uid: string;
  title: string;
  location?: string;
  description?: string;
  date: string;
  /** Minutes since midnight on `date`; 0..1440 for all-day events. */
  start: number;
  end: number;
  allDay: boolean;
  /** The whole occurrence, for the details dialog. */
  from: Date;
  to: Date;
}

const MAX_OCCURRENCES = 2000; // per recurring event: an RRULE without end stops here or at the range end

function text(comp: ICAL.Component, name: string) {
  const v = comp.getFirstPropertyValue(name);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Every occurrence that overlaps [from, to). */
export function parseIcs(source: string, from: Date, to: Date): Occurrence[] {
  const root = new ICAL.Component(ICAL.parse(source));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    const zone = new ICAL.Timezone(tz);
    if (!ICAL.TimezoneService.has(zone.tzid)) ICAL.TimezoneService.register(zone);
  }

  const vevents = root.getAllSubcomponents("vevent").filter((c) => text(c, "status")?.toUpperCase() !== "CANCELLED");
  // Moved or edited occurrences of a series carry RECURRENCE-ID and the series' UID.
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const c of vevents) {
    const ev = new ICAL.Event(c);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
    else masters.set(`${ex.uid}#${ex.recurrenceId}`, ex);
  }

  const out: Occurrence[] = [];
  const push = (ev: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    const s = start.toJSDate();
    let e = end.toJSDate();
    if (e <= s) e = new Date(s.getTime() + (start.isDate ? 86_400_000 : 30 * 60_000));
    if (e <= from || s >= to) return;
    const c = ev.component;
    out.push({
      uid: ev.uid,
      title: ev.summary?.trim() || "(sem título)",
      location: text(c, "location"),
      description: text(c, "description"),
      start: s,
      end: e,
      allDay: start.isDate,
    });
  };

  const rangeEnd = ICAL.Time.fromJSDate(to, false);
  for (const ev of masters.values()) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate ?? ev.startDate);
      continue;
    }
    const it = ev.iterator();
    for (let n = 0, next = it.next(); next && n < MAX_OCCURRENCES; n++, next = it.next()) {
      if (next.compare(rangeEnd) >= 0) break;
      const details = ev.getOccurrenceDetails(next);
      if (text(details.item.component, "status")?.toUpperCase() === "CANCELLED") continue;
      push(details.item, details.startDate, details.endDate);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Splits occurrences into the days they cover, in local time. */
export function toDayEvents(occurrences: Occurrence[], calendarId: string): ExternalEvent[] {
  const out: ExternalEvent[] = [];
  for (const o of occurrences) {
    const base = { calendarId, uid: o.uid, title: o.title, location: o.location, description: o.description, allDay: o.allDay, from: o.start, to: o.end };
    const day = new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate());
    for (let guard = 0; day < o.end && guard < 400; guard++) {
      const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      const start = o.allDay ? 0 : Math.max(0, Math.round((o.start.getTime() - day.getTime()) / 60_000));
      const end = o.allDay ? 1440 : Math.min(1440, Math.round((o.end.getTime() - day.getTime()) / 60_000));
      if (end > start) out.push({ ...base, date: isoDate(day), start, end });
      day.setTime(next.getTime());
    }
  }
  return out;
}
