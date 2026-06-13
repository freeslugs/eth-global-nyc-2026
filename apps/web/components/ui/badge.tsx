import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        poisoned: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
        revoked: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        neutral: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function statusVariant(status: string): NonNullable<BadgeProps["variant"]> {
  if (status === "verified") return "verified";
  if (status === "poisoned") return "poisoned";
  if (status === "revoked") return "revoked";
  return "neutral";
}
