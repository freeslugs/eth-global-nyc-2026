"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Verdict {
  status: "pass" | "fail";
  riskScore: number;
  attestationId: string;
  reviewedHash: string;
}

interface VerifyResponse {
  result: { ok: true } | { ok: false; reason: string; detail?: string };
  resolved: { name: string; pin: string; owner: string; verdict?: Verdict };
  fetched: { hash: string };
  error?: string;
}

export function VerifyForm({ names }: { names: { name: string; status: string }[] }) {
  const [name, setName] = React.useState(names[0]?.name ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<VerifyResponse | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function call(init: RequestInit) {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/verify", init);
      const data = (await res.json()) as VerifyResponse;
      if (!res.ok) {
        setError(data.error ?? "verification failed");
      } else {
        setResult(data);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await call({ method: "POST", body: form });
  }

  async function verifyFixture(fixtureName: string) {
    setName(fixtureName);
    await call({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: fixtureName, fixture: true }),
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Verify a skill</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Pinned name</span>
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                placeholder="weather.acme.safeskills.eth"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">SKILL.md</span>
              <input
                type="file"
                name="skill"
                accept=".md,text/markdown"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Verifying…" : "Verify upload"}
            </Button>
          </form>

          <div className="mt-6 space-y-2 border-t pt-4">
            <p className="text-xs text-muted-foreground">Or verify a seeded skill:</p>
            <div className="flex flex-wrap gap-2">
              {names.map((n) => (
                <Button
                  key={n.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => verifyFixture(n.name)}
                >
                  {n.name.replace(".safeskills.eth", "")}
                  <Badge variant={statusVariant(n.status)}>{n.status}</Badge>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent>
          {!result && !error && (
            <p className="text-sm text-muted-foreground">Run a verification to see the verdict.</p>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {result && <ResultPanel data={result} />}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultPanel({ data }: { data: VerifyResponse }) {
  const ok = data.result.ok;
  const verdict = data.resolved.verdict;
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border p-3 text-sm font-medium",
          ok
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        )}
      >
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {ok ? "ALLOW — content matches its pin and verdict" : `BLOCK — ${data.result.reason}`}
      </div>
      {!ok && data.result.detail && (
        <p className="font-mono text-xs text-muted-foreground">{data.result.detail}</p>
      )}
      <div className="space-y-1 font-mono text-xs">
        <Row label="pin" a={data.resolved.pin} />
        <Row label="got" a={data.fetched.hash} match={data.fetched.hash === data.resolved.pin} />
        {verdict && <Row label="verdict" a={`${verdict.status} · risk ${verdict.riskScore}`} />}
        {verdict && <Row label="attestation" a={verdict.attestationId || "—"} />}
      </div>
    </div>
  );
}

function Row({ label, a, match }: { label: string; a: string; match?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "break-all",
          match === true && "text-emerald-500",
          match === false && "text-red-500",
        )}
      >
        {a}
      </span>
    </div>
  );
}
