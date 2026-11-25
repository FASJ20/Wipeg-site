import { randomUUID } from "node:crypto";

import {
  bookingDays,
  env,
  requireCalendarId,
} from "../../lib/env.js";
import { badRequest, conflict } from "../../lib/errors.js";
import { googleFetch, SCOPES } from "./serviceAccount.js";

/**
 * Call booking, which lives entirely in Google Calendar.
 *
 * There is no appointments table. The shared WIPEG calendar is the booking
 * system: this module reads free/busy out of it to offer slots, and writes
 * the event into it when somebody books. Nothing is mirrored in Postgres.
 *
 * The reason is operational rather than technical. Staff already have Google
 * Calendar on their phones. If a call has to move, they move it there, and it
 * is moved — no second system to remember, nothing to reconcile, and no
 * "the website says 9:00 but the calendar says 10:00" to arbitrate.
 *
 * The cost, stated honestly: WIPEG cannot report on bookings with SQL, and if
 * Google is down nobody can book. Both are acceptable for a handful of calls
 * a day. If booking volume ever justifies reporting, the fix is to copy
 * events into a table for reading — not to make Postgres the source of truth.
 */

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type BookingMode = "online" | "onsite";

export type Slot = {
  /** ISO instant the slot starts. */
  startsAt: string;
  endsAt: string;
  /** "09:00", in BOOKING_TIMEZONE, for display. */
  label: string;
};

// --------------------------------------------------------------- time zones

/** How far the zone is ahead of UTC, in ms, at a given instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // `hour` comes back as 24 at midnight under hour12:false in some versions.
  const hour = get("hour") % 24;

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/** The UTC instant of a wall-clock time in BOOKING_TIMEZONE. */
function zonedToUtc(day: string, time: string, timeZone: string): Date {
  const naive = new Date(`${day}T${time}:00Z`);
  if (Number.isNaN(naive.getTime())) {
    throw badRequest(`"${day} ${time}" is not a valid date and time.`);
  }
  // Correct by the offset, then correct again: the offset can differ either
  // side of a DST boundary. Africa/Douala has no DST, but this module should
  // not quietly break if WIPEG ever opens somewhere that does.
  const first = new Date(naive.getTime() - zoneOffsetMs(naive, timeZone));
  return new Date(naive.getTime() - zoneOffsetMs(first, timeZone));
}

/** 1 = Monday … 7 = Sunday, in BOOKING_TIMEZONE. */
function isoWeekday(instant: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(instant);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return order.indexOf(name) + 1;
}

function hhmm(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

// ------------------------------------------------------------------- slots

function minutesOf(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Every slot the office could offer on a day, before Google is consulted.
 * Closed days return nothing, as does a day outside the booking window.
 */
function candidateSlots(day: string): Slot[] {
  const tz = env.BOOKING_TIMEZONE;
  const open = minutesOf(env.BOOKING_OPEN_TIME);
  const close = minutesOf(env.BOOKING_CLOSE_TIME);
  const step = env.BOOKING_SLOT_MINUTES;

  const dayStart = zonedToUtc(day, env.BOOKING_OPEN_TIME, tz);
  if (!bookingDays.has(isoWeekday(dayStart, tz))) return [];

  const earliest = Date.now() + env.BOOKING_MIN_NOTICE_MINUTES * 60_000;
  const latest = Date.now() + env.BOOKING_DAYS_AHEAD * 86_400_000;

  const slots: Slot[] = [];
  for (let m = open; m + step <= close; m += step) {
    const startsAt = new Date(dayStart.getTime() + (m - open) * 60_000);
    const endsAt = new Date(startsAt.getTime() + step * 60_000);

    if (startsAt.getTime() < earliest) continue;
    if (startsAt.getTime() > latest) continue;

    slots.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      label: hhmm(startsAt, tz),
    });
  }
  return slots;
}

type FreeBusyResponse = {
  calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
};

/** Slots on `day` that nothing on the WIPEG calendar overlaps. */
export async function openSlots(day: string): Promise<Slot[]> {
  const candidates = candidateSlots(day);
  if (candidates.length === 0) return [];

  const calendarId = requireCalendarId();
  const first = candidates[0];
  const last = candidates[candidates.length - 1];
  // `candidates.length > 0` is checked above, so these are defined; the
  // assertions exist only because noUncheckedIndexedAccess cannot see that.
  if (!first || !last) return [];

  const body = {
    timeMin: first.startsAt,
    timeMax: last.endsAt,
    timeZone: env.BOOKING_TIMEZONE,
    items: [{ id: calendarId }],
  };

  const result = await googleFetch<FreeBusyResponse>(
    SCOPES.calendar,
    `${CALENDAR_API}/freeBusy`,
    { method: "POST", body, service: "Google Calendar" },
  );

  const busy = result.calendars?.[calendarId]?.busy ?? [];

  return candidates.filter((slot) => {
    const start = Date.parse(slot.startsAt);
    const end = Date.parse(slot.endsAt);
    return !busy.some((b) => {
      const bStart = Date.parse(b.start);
      const bEnd = Date.parse(b.end);
      // Touching at the edges is not an overlap: a 09:30 end and a 09:30
      // start are two different slots.
      return start < bEnd && end > bStart;
    });
  });
}

// ----------------------------------------------------------------- booking

export type BookingRequest = {
  name: string;
  phone: string;
  email: string | null;
  mode: BookingMode;
  /** What they want to talk about, in their words. */
  topic: string | null;
  department: string | null;
  startsAt: string;
};

export type BookingResult = {
  eventId: string;
  startsAt: string;
  endsAt: string;
  mode: BookingMode;
  /** Present for online calls only. */
  meetUrl: string | null;
  /** Present for onsite calls only. */
  address: string | null;
};

type CalendarEvent = {
  id: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
};

/**
 * Write the booking onto the WIPEG calendar.
 *
 * The slot is re-checked against free/busy immediately beforehand. That is a
 * narrow race — two people can still book the same slot a few hundred
 * milliseconds apart — and it is left narrow rather than closed because the
 * alternative is a lock in a system we have deliberately not made the source
 * of truth. A double-booked 30-minute call is a phone call to reschedule, not
 * a corrupted record.
 */
export async function createBooking(
  request: BookingRequest,
): Promise<BookingResult> {
  const calendarId = requireCalendarId();

  const startsAt = new Date(request.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw badRequest("That is not a valid appointment time.");
  }
  const endsAt = new Date(
    startsAt.getTime() + env.BOOKING_SLOT_MINUTES * 60_000,
  );

  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.BOOKING_TIMEZONE,
  }).format(startsAt);

  const stillOpen = await openSlots(day);
  if (!stillOpen.some((s) => s.startsAt === startsAt.toISOString())) {
    throw conflict(
      "That time has just been taken. Please pick another slot.",
    );
  }

  const summary = `WIPEG enquiry — ${request.name}`;
  const lines = [
    `Booked from the WIPEG website.`,
    ``,
    `Name:       ${request.name}`,
    `Phone:      ${request.phone}`,
    `Email:      ${request.email ?? "(not given)"}`,
    `Department: ${request.department ?? "(not said)"}`,
    `Type:       ${request.mode === "online" ? "Online call" : "At the campus"}`,
    ``,
    `What they want to discuss:`,
    request.topic ?? "(nothing written)",
  ];

  const body: Record<string, unknown> = {
    summary,
    description: lines.join("\n"),
    start: { dateTime: startsAt.toISOString(), timeZone: env.BOOKING_TIMEZONE },
    end: { dateTime: endsAt.toISOString(), timeZone: env.BOOKING_TIMEZONE },
    // Google emails the invitation and the reminder. One less thing for this
    // backend to own, and it arrives from a Google address rather than a new
    // domain nobody's spam filter trusts yet.
    attendees: request.email ? [{ email: request.email }] : [],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "email", minutes: 120 },
      ],
    },
  };

  if (request.mode === "online") {
    body.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  } else {
    body.location = env.BOOKING_ONSITE_ADDRESS;
  }

  const params = new URLSearchParams({
    conferenceDataVersion: request.mode === "online" ? "1" : "0",
    sendUpdates: request.email ? "all" : "none",
  });

  const event = await googleFetch<CalendarEvent>(
    SCOPES.calendar,
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { method: "POST", body, service: "Google Calendar" },
  );

  const meetUrl =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
      ?.uri ??
    null;

  return {
    eventId: event.id,
    startsAt: event.start?.dateTime ?? startsAt.toISOString(),
    endsAt: event.end?.dateTime ?? endsAt.toISOString(),
    mode: request.mode,
    meetUrl: request.mode === "online" ? meetUrl : null,
    address: request.mode === "onsite" ? env.BOOKING_ONSITE_ADDRESS : null,
  };
}
