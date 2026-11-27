import { school } from "@/data/site";

/**
 * WhatsApp links, in one place.
 *
 * WhatsApp is how people in Cameroon actually reach an institution, so it is
 * the primary contact channel on this site rather than a nice extra. Email is
 * kept as an alternative, not as the default — a `mailto:` opens a mail client
 * most visitors on a phone have never configured, and the enquiry dies there
 * with nobody aware it was ever written.
 */

/**
 * Digits only, no `+` and no spaces: that is the format `wa.me` requires, and
 * a link built with either of them silently fails to open a chat.
 */
export const WHATSAPP_NUMBER = school.whatsapp;

/** For display, from the same source, so the two can never disagree. */
export const WHATSAPP_DISPLAY = school.phones[0];

/**
 * A wa.me link, optionally carrying a message the visitor can review before
 * they press send.
 *
 * `wa.me` is deliberately chosen over `api.whatsapp.com`: it is the link
 * WhatsApp documents for this, it opens the installed app on a phone and
 * WhatsApp Web on a desktop, and it needs no business account behind it.
 *
 * The prefilled text is a convenience, never a commitment — nothing is sent
 * until the visitor presses send in WhatsApp themselves. That is also why
 * there is no delivery confirmation anywhere in this flow: the site genuinely
 * does not know whether the message went.
 */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  if (!message) return base;

  // WhatsApp truncates very long prefills, and a wall of text is a worse
  // first message anyway. Cap it well under the limit.
  const text = message.trim().slice(0, 1500);
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Collapse newlines and trim a single-line value.
 *
 * The prefill is URL-encoded, so a newline cannot break out of it the way it
 * could out of a `mailto:` subject. It is still flattened: a stray line break
 * in "Full name" turns a tidy message into a confusing one.
 */
export function oneLine(value: unknown, max = 200): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
}
