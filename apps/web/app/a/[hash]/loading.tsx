import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Shown instantly while the on-chain crawl resolves on a cold render. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6 px-6 py-12">
      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Registry
      </span>

      <div className="flex items-center justify-between gap-3">
        <div className="h-7 w-64 rounded bg-[#ecebe7]" />
        <div className="h-6 w-20 rounded-full bg-[#ecebe7]" />
      </div>

      {[3, 4].map((rows, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-28 rounded bg-[#ecebe7]" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="h-3.5 w-full max-w-xl rounded bg-[#f1f0ec]" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
