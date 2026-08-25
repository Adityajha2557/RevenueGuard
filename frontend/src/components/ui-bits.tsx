import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CaseStatus, Severity } from "@/domain/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Inbox } from "lucide-react";

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-critical/15 text-critical border-critical/40",
  high: "bg-warning/15 text-warning border-warning/40",
  medium: "bg-chart-4/15 text-chart-4 border-chart-4/40",
  low: "bg-muted text-muted-foreground border-border",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        SEVERITY_STYLES[severity],
      )}
    >
      {severity}
    </span>
  );
}

const STATUS_LABEL: Record<CaseStatus, string> = {
  detected: "Detected",
  investigating: "Investigating",
  investigated: "Investigated",
  pending_approval: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  recovered: "Recovered",
};

const STATUS_STYLES: Record<CaseStatus, string> = {
  detected: "bg-muted text-muted-foreground border-border",
  investigating: "bg-primary/12 text-primary border-primary/40",
  investigated: "bg-primary/12 text-primary border-primary/40",
  pending_approval: "bg-warning/15 text-warning border-warning/40",
  approved: "bg-success/15 text-success border-success/40",
  rejected: "bg-critical/15 text-critical border-critical/40",
  recovered: "bg-success/15 text-success border-success/40",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Money({
  value,
  className,
  formatter,
}: {
  value: number;
  className?: string;
  formatter: (n: number) => string;
}) {
  return <span className={cn("tabular", className)}>{formatter(value)}</span>;
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-critical/40 bg-critical/8 px-6 py-12 text-center">
      <AlertCircle className="size-6 text-critical" />
      <p className="mt-3 text-sm font-medium">Couldn't load this data</p>
      <p className="mt-1 text-sm text-muted-foreground">{message ?? "Please try again."}</p>
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-3 p-5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
