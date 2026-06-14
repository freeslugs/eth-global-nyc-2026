import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MobileMenu } from "@/components/mobile-menu";
import { ConnectButton } from "@/components/connect-button";
import { DesktopNav } from "@/components/desktop-nav";

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
  title: "Aegis — verify every skill before it runs",
  description:
    "Cryptographic integrity for agent skills — each named on ENS, evaluated by a trustless AI attestor on Chainlink CRE, and gated by policies you approve on your Ledger.",
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
              <DesktopNav />
              <div className="ml-auto flex items-center gap-2 md:ml-0">
                <Link
                  href="/register"
                  className="hidden rounded-md border border-[#d6d3ce] bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-[#faf9f7] sm:inline-block"
                >
                  Submit a skill
                </Link>
                <ConnectButton />
              </div>
              <MobileMenu />
            </div>
          </header>

          <main>{children}</main>

          <footer className="border-t border-[#e7e5e1] bg-white">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[#78716c] sm:flex-row">
              <span className="font-display font-bold text-ink">◇ Aegis</span>
              <span>Name on ENS · Attest via Chainlink CRE · Gate on Ledger · Verify before run</span>
              <span>ETHGlobal NYC 2026</span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
