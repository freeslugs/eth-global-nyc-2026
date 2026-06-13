import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Aegis — trust check for third-party code",
  description:
    "Verify npm packages and MCP servers against their pinned, vetted release before you run them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <header className="border-b">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Aegis
              </Link>
              <nav className="flex items-center gap-5 text-sm text-muted-foreground">
                <Link href="/" className="hover:text-foreground">
                  Registry
                </Link>
                <Link href="/verify" className="hover:text-foreground">
                  Verify
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
