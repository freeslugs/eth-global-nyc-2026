import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Aegis — verify every package before it runs",
  description:
    "Cryptographic integrity for npm packages and MCP servers — hashed, signed on Ledger, anchored on-chain via Chainlink CRE, and named with ENS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Providers>
          <header className="sticky top-0 z-50 border-b border-[#e7e5e1] bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-4">
              <Link href="/" className="font-display text-xl font-bold tracking-tight">
                ◇ Aegis
              </Link>
              <nav className="ml-4 hidden flex-1 items-center justify-center gap-7 text-sm text-[#78716c] md:flex">
                <Link href="/how-it-works" className="hover:text-ink">
                  How it works
                </Link>
                <Link href="/threats" className="hover:text-ink">
                  The threat
                </Link>
                <Link href="/" className="hover:text-ink">
                  Registry
                </Link>
                <Link href="/verify" className="hover:text-ink">
                  Verify
                </Link>
                <a
                  href="https://github.com/freeslugs/eth-global-nyc-2026"
                  className="hover:text-ink"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </nav>
              <Link
                href="/verify"
                className="ml-auto rounded-md bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink/90 md:ml-0"
              >
                Get the SDK
              </Link>
            </div>
          </header>

          <main>{children}</main>

          <footer className="border-t border-[#e7e5e1] bg-white">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[#78716c] sm:flex-row">
              <span className="font-display font-bold text-ink">◇ Aegis</span>
              <span>Hash · Sign on Ledger · Anchor via Chainlink CRE · Resolve on ENS</span>
              <span>ETHGlobal NYC 2026</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
