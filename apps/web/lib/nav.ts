// Shared nav config so the desktop nav and the mobile menu stay in sync.
export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavLink[];
}

// Landing / marketing links, shown inline in the navbar.
export const NAV_LINKS: NavLink[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/threats", label: "The threat" },
  { href: "/sdk", label: "SDK" },
  { href: "https://github.com/freeslugs/eth-global-nyc-2026", label: "GitHub", external: true },
];

// Product pages, grouped under the "App" dropdown.
export const APP_NAV: NavGroup = {
  label: "App",
  items: [
    { href: "/registry", label: "Skills registry" },
    { href: "/orgs", label: "Companies" },
    { href: "/register", label: "Submit a skill" },
  ],
};

// Whether a nav link points at the currently-active page. External links are
// never "active"; "/" must match exactly so it doesn't light up everywhere.
export function isActiveLink(pathname: string, link: Pick<NavLink, "href" | "external">): boolean {
  if (link.external) return false;
  if (link.href === "/") return pathname === "/";
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}
