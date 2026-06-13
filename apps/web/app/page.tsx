import Link from "next/link";
import { getRegistry } from "@/lib/registry.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { shortHash } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const entries = await getRegistry();

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Registry</h1>
        <p className="max-w-2xl text-muted-foreground">
          Every artifact pins the exact content hash of its vetted release. Before running anything,
          Aegis resolves the name, re-hashes the real bytes, and blocks on any mismatch, missing
          provenance, or revocation.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {entries.map(({ record, attestations, revoked }) => (
          <Link key={record.bundleHash} href={`/a/${encodeURIComponent(record.bundleHash)}`}>
            <Card className="h-full transition-colors hover:border-foreground/30">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="font-mono text-base">{record.name}</CardTitle>
                  <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="font-mono text-xs">bundle {shortHash(record.bundleHash)}</div>
                <div className="font-mono text-xs">manifest {shortHash(record.manifestHash)}</div>
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span>{attestations.length} attestation(s)</span>
                  {revoked && <span className="text-amber-500">revoked</span>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
