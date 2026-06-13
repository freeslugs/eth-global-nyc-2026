import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEntryByPin } from "@/lib/registry.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SkillPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const entry = await getEntryByPin(decodeURIComponent(hash));
  if (!entry) notFound();
  const { record, status } = entry;
  const verdict = record.verdict;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Registry
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="font-mono text-xl font-semibold">{record.name}</h1>
        <Badge variant={statusVariant(status)}>{status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs">
          <Field label="content pin" value={record.pin} />
          <Field label="ens node" value={record.node} />
          <Field label="owner" value={record.owner} />
          <Field label="content uri" value={record.contentUri ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verdict</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs">
          {!verdict && <p className="text-sm text-muted-foreground">No verdict written yet.</p>}
          {verdict && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant={verdict.status === "pass" ? "neutral" : "revoked"}>
                  {verdict.status}
                </Badge>
                <span className="text-muted-foreground">risk {verdict.riskScore}/100</span>
              </div>
              <Field label="attestation" value={verdict.attestationId || "—"} />
              <Field label="reviewed hash" value={verdict.reviewedHash} />
            </>
          )}
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
