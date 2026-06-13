"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/nav";

export function MobileMenu() {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#e7e5e1] text-ink transition-colors hover:bg-[#faf9f7]"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <button
            aria-hidden
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 top-[57px] z-40 cursor-default bg-black/5"
          />
          <nav className="absolute inset-x-0 top-full z-50 border-b border-[#e7e5e1] bg-white shadow-sm">
            <div className="mx-auto flex max-w-6xl flex-col px-6 py-2">
              {NAV_LINKS.map((l) =>
                l.external ? (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={close}
                    className="border-b border-[#f5f4f1] py-3 text-[15px] text-[#57534e] last:border-0 hover:text-ink"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={close}
                    className="border-b border-[#f5f4f1] py-3 text-[15px] text-[#57534e] last:border-0 hover:text-ink"
                  >
                    {l.label}
                  </Link>
                ),
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
