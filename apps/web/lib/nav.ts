// Shared nav links so the desktop nav and the mobile menu stay in sync.
export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/#architecture", label: "Architecture" },
  { href: "/threats", label: "The threat" },
  { href: "/", label: "Registry" },
  { href: "/verify", label: "Verify" },
  { href: "https://github.com/freeslugs/eth-global-nyc-2026", label: "GitHub", external: true },
];
