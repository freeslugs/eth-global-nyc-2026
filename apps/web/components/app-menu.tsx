"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { APP_NAV } from "@/lib/nav";

/** Desktop "App" dropdown — groups the product pages behind one nav item. */
export function AppMenu() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on click-away and on Escape.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = APP_NAV.items.some((i) => pathname.startsWith(i.href));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 transition-colors hover:text-ink ${
          active || open ? "text-ink" : ""
        }`}
      >
        {APP_NAV.label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 top-full z-50 mt-3 w-52 -translate-x-1/2 overflow-hidden rounded-lg border border-[#e7e5e1] bg-white py-1 shadow-lg"
        >
          {APP_NAV.items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`block px-4 py-2.5 text-sm transition-colors hover:bg-[#faf9f7] ${
                pathname.startsWith(i.href) ? "text-ink" : "text-[#57534e]"
              }`}
            >
              {i.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
