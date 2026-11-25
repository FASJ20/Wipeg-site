import type { Request, Response } from "express";
import { z } from "zod";

import { env } from "../lib/env.js";
import { created, ok } from "../lib/http.js";
import { queryOf } from "../middleware/validate.js";
import * as audit from "../models/auditLog.js";
import * as calendar from "../services/google/calendar.js";

/**
 * Booking a call, straight onto the WIPEG Google Calendar.
 *
 * Nothing is written to Postgres. The calendar is the booking system, so
 * there is no record here to drift out of step with what staff see on their
 * phones. The only thing that touches the database is one audit line, which
 * is there so a booking that later causes a question can be traced.
 */

const PHONE = /^\+[0-9]{8,15}$/;

export const slotsQuery = z.object({
  /** YYYY-MM-DD, in WIPEG's timezone. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-01."),
});

export const bookingBody = z.object({
  name: z.string().trim().min(2, "Please give your name.").max(120),
  phone: z
    .string()
    .trim()
    .regex(PHONE, "Use the international form, like +237677487127."),
  email: z.string().trim().toLowerCase().email().max(200).nullish(),
  mode: z.enum(["online", "onsite"], {
    errorMap: () => ({ message: "Choose an online call or a campus visit." }),
  }),
  department: z.string().trim().max(120).nullish(),
  topic: z.string().trim().max(1000).nullish(),
  startsAt: z.string().datetime({ offset: true }),
});

export type BookingBody = z.infer<typeof bookingBody>;

/** Open slots on a day. Read-only, and safe for an anonymous caller. */
export async function slots(req: Request, res: Response): Promise<void> {
  const { date } = queryOf<z.infer<typeof slotsQuery>>(req);
  const open = await calendar.openSlots(date);

  ok(res, {
    date,
    timezone: env.BOOKING_TIMEZONE,
    slotMinutes: env.BOOKING_SLOT_MINUTES,
    slots: open,
  });
}

/**
 * Take the booking.
 *
 * `mode` decides what the visitor gets back: an online call produces a Google
 * Meet link on the event, a campus visit produces the address. Both are put
 * in the response so the confirmation screen can show it immediately rather
 * than telling them to wait for an email.
 */
export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as BookingBody;

  const result = await calendar.createBooking({
    name: body.name,
    phone: body.phone,
    email: body.email ?? null,
    mode: body.mode,
    department: body.department ?? null,
    topic: body.topic ?? null,
    startsAt: body.startsAt,
  });

  // One line, so that "who booked this and when" is answerable without
  // reading the calendar. No lead pipeline, no follow-up stages.
  await audit.record(req.actor, {
    action: "book_call",
    entity: "calendar_event",
    entityId: result.eventId,
    summary: `${body.name} (${body.phone}) booked a ${body.mode} call for ${result.startsAt}.`,
  });

  created(res, {
    startsAt: result.startsAt,
    endsAt: result.endsAt,
    mode: result.mode,
    meetUrl: result.meetUrl,
    address: result.address,
    emailed: Boolean(body.email),
  });
}
