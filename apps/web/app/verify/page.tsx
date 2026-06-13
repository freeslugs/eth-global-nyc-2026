import { seededNames } from "@/lib/registry.server";
import { VerifyForm } from "@/components/verify-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Verify</h1>
        <p className="max-w-2xl text-muted-foreground">
          Resolve a pinned name, re-hash the real bytes, and get an ALLOW or BLOCK verdict. Upload a
          bundle + manifest, or one-click a seeded fixture below.
        </p>
      </section>
      <VerifyForm names={seededNames()} />
    </div>
  );
}
