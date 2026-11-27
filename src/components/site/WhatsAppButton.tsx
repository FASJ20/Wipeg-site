"use client";

import { MessageCircle } from "lucide-react";

import { WHATSAPP_DISPLAY, whatsappLink } from "@/lib/whatsapp";

/**
 * The floating WhatsApp button.
 *
 * On every page, because the question a prospective student wants to ask
 * rarely arrives while they happen to be on the contact page — it arrives
 * halfway down a programme page, and they should not have to go looking.
 *
 * Deliberately WhatsApp's own green rather than the WIPEG accent. This is the
 * one place on the site where being instantly recognisable beats being on
 * brand: people identify this button by its colour before they read anything.
 */
export function WhatsAppButton() {
  const href = whatsappLink(
    "Hello WIPEG, I saw your website and I would like to ask about admission.",
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Message WIPEG on WhatsApp at ${WHATSAPP_DISPLAY}`}
      className="group fixed bottom-5 right-5 z-[70] flex items-center gap-0 overflow-hidden rounded-full bg-[#25D366] pl-[0.95rem] pr-[0.95rem] text-white shadow-[0_8px_28px_rgba(37,211,102,0.42)] outline-none transition-[gap,padding,box-shadow,transform] duration-300 ease-[var(--ease-out-quint)] hover:-translate-y-0.5 hover:gap-2.5 hover:pr-5 hover:shadow-[0_12px_34px_rgba(37,211,102,0.5)] focus-visible:gap-2.5 focus-visible:pr-5 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 motion-reduce:transition-none sm:bottom-7 sm:right-7"
      style={{ height: "3.25rem" }}
    >
      <MessageCircle className="size-6 shrink-0" strokeWidth={2.25} />

      {/*
        The label expands on hover and on keyboard focus, and is collapsed to
        zero width otherwise. `max-w` rather than `display:none` so the text
        stays in the accessibility tree and the transition has something to
        animate. On a touch screen there is no hover, so what people get is a
        clean circular button — which is the familiar shape anyway.
      */}
      <span className="max-w-0 whitespace-nowrap text-[0.9rem] font-semibold opacity-0 transition-[max-width,opacity] duration-300 ease-[var(--ease-out-quint)] group-hover:max-w-[12rem] group-hover:opacity-100 group-focus-visible:max-w-[12rem] group-focus-visible:opacity-100 motion-reduce:transition-none">
        Chat with us
      </span>
    </a>
  );
}
