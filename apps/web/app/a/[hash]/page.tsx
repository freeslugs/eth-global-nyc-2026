import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEntryByHash } from "@/lib/registry.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const entry = await getEntryByHash(decodeURIComponent(hash));
  if (!entry) notFound();
  const { record, attestations, revoked } = entry;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Registry
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="font-mono text-xl font-semibold">{record.name}</h1>
        <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs">
          <Field label="bundle hash" value={record.bundleHash} />
          <Field label="manifest hash" value={record.manifestHash} />
          <Field label="publisher" value={record.publisher} />
          <Field label="policy" value={record.policyRef} />
          <Field label="revoked" value={String(revoked)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attestations ({attestations.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {attestations.length === 0 && (
            <p className="text-sm text-muted-foreground">No attestations.</p>
          )}
          {attestations.map((a, i) => (
            <div key={i} className="rounded-md border p-3 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant={a.kind === "revocation" ? "revoked" : "neutral"}>{a.kind}</Badge>
                <span className="font-mono text-muted-foreground">{a.attestor}</span>
              </div>
              {a.payload != null && (
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono">
                  {JSON.stringify(a.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}
