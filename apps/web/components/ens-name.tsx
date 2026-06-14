"use client";

import { ArrowUpRight } from "lucide-react";

/**
 * An ENS name with a small button linking to the ENS explorer. A `<button>`
 * (not an `<a>`) so it nests legally inside the clickable cards/rows, and
 * stopPropagation/preventDefault so clicking the icon opens the explorer without
 * triggering the surrounding card link.
 */
export function EnsName({
  name,
  display,
  className,
}: {
  name: string;
  /** Optional shorter label to show instead of the full name. */
  display?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span className="truncate font-mono">{display ?? name}</span>
      <button
        type="button"
        title={`View ${name} on the ENS explorer`}
        aria-label={`View ${name} on the ENS explorer`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(`https://explorer.ens.dev/${name}`, "_blank", "noopener,noreferrer");
        }}
        className="shrink-0 text-[#a8a29e] transition-colors hover:text-ink"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
