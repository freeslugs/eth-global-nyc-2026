import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEntryByPin } from "@/lib/registry.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { EnsName } from "@/components/ens-name";
import { statusMeta } from "@/lib/status";

export const runtime = "nodejs";
// ISR: render once per hash, then serve from cache and revalidate in the
// background. The expensive on-chain crawl is itself cached in registry.server,
// so a cold render here usually reuses a warm crawl from the registry page.
export const revalidate = 30;

export default async function SkillPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const entry = await getEntryByPin(decodeURIComponent(hash));
  if (!entry) notFound();
  const { record, status } = entry;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <Link
        href="/registry"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Registry
      </Link>

      <div className="flex items-center justify-between gap-3">
        <EnsName name={record.name} className="text-xl font-semibold" />
        <Badge variant={statusVariant(status)}>{statusMeta(status).label}</Badge>
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

      {record.metadata && Object.keys(record.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(record.metadata).map(([k, v]) => (
                  <tr key={k} className="border-b border-[#f5f4f1] last:border-0">
                    <td className="w-40 py-2 pr-3 align-top font-mono text-xs text-muted-foreground">
                      {k}
                    </td>
                    <td className="py-2 align-top">{Array.isArray(v) ? v.join(", ") : String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attestations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(record.attestations ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No attestations written yet.</p>
          )}
          {(record.attestations ?? []).map((a) => (
            <div key={a.provider} className="space-y-1.5 border-b border-[#f5f4f1] pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{a.provider}</span>
                <Badge variant={a.status === "pass" ? "verified" : "poisoned"}>{a.status}</Badge>
                <span className="ml-auto font-mono text-sm font-semibold">
                  {a.score}
                  <span className="text-muted-foreground">/100</span>
                </span>
              </div>
              <div className="space-y-1 font-mono text-xs">
                <Field label="attestation" value={a.attestationId || "—"} />
                <Field label="reviewed hash" value={a.reviewedHash} />
              </div>
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
