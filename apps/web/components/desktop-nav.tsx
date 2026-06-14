"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, isActiveLink } from "@/lib/nav";
import { AppMenu } from "@/components/app-menu";

/** Inline marketing links for the desktop navbar, with active-page highlighting. */
export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="ml-4 hidden flex-1 items-center justify-center gap-7 text-sm text-[#78716c] md:flex">
      {NAV_LINKS.map((l) =>
        l.external ? (
          <a
            key={l.href}
            href={l.href}
            className="hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            {l.label}
          </a>
        ) : (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActiveLink(pathname, l) ? "page" : undefined}
            className={`hover:text-ink ${isActiveLink(pathname, l) ? "font-medium text-ink" : ""}`}
          >
            {l.label}
          </Link>
        ),
      )}
      <span className="h-4 w-px bg-[#e7e5e1]" aria-hidden />
      <AppMenu />
    </nav>
  );
}
