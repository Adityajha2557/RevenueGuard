import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  SectionHeading,
  SeverityBadge,
} from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { approveRecovery, getApprovalQueue, rejectRecovery } from "@/services/recoveryService";
import { LEAKAGE_LABELS } from "@/data/seed/scenarios";
import { formatDate, formatINR, formatPct } from "@/lib/format";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "Recovery Approvals | RevenueGuard AI" },
      {
        name: "description",
        content:
          "Human approval queue: review AI findings, evidence and risk before any recovery is executed.",
      },
      { property: "og:title", content: "Recovery Approvals | RevenueGuard AI" },
      {
        property: "og:description",
        content: "Every financial write is gated behind an explicit finance approval.",
      },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ["approvalQueue"], queryFn: getApprovalQueue });

  const [pending, setPending] = useState<{ caseId: string; mode: "approve" | "reject" } | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!pending) return;
      if (pending.mode === "approve") return approveRecovery(pending.caseId, reason);
      return rejectRecovery(pending.caseId, reason);
    },
    onSuccess: async (action) => {
      await queryClient.invalidateQueries();
      if (action && action.status === "recovered") {
        toast.success(`Recovery approved — ${formatINR(action.amountRecovered)} recovered`);
      } else {
        toast.success("Case rejected — no recovery recorded");
      }
      setPending(null);
      setReason("");
    },
    onError: () => toast.error("Could not record the decision"),
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Recovery Approval</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI can only read records. Nothing is recovered until a human approves it here.
        </p>
      </div>

      {queue.isError ? <ErrorState /> : null}

      {queue.isPending ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <CardSkeleton rows={5} />
          <CardSkeleton rows={5} />
        </div>
      ) : (queue.data ?? []).length === 0 ? (
        <EmptyState
          title="Approval queue is empty"
          description="Run an investigation and send it to approval to see it here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(queue.data ?? []).map((c) => (
            <Card key={c.id} className="border-border bg-card">
              <CardContent className="p-5">
                <SectionHeading
                  title={c.customerName}
                  description={`${c.id} · ${LEAKAGE_LABELS[c.type]} · detected ${formatDate(c.detectedOn)}`}
                  action={<SeverityBadge severity={c.severity} />}
                />
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated loss</p>
                    <p className="tabular text-lg font-semibold text-critical">
                      {formatINR(c.estimatedLoss)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recoverable</p>
                    <p className="tabular text-lg font-semibold">{formatINR(c.recoverable)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">AI confidence</p>
                    <p className="tabular text-lg font-semibold text-primary">
                      {formatPct(c.confidence)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-sm">{c.rootCause}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.recommendedAction}</p>

                <ul className="mt-3 space-y-1 rounded-md border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                  {c.evidence.slice(0, 4).map((e, i) => (
                    <li key={i}>
                      <span className="font-mono text-foreground/80">
                        {e.sourceType}/{e.sourceId}
                      </span>{" "}
                      · {e.field}: {e.expectedValue} → {e.actualValue}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" /> Risk level: {c.riskLevel}
                  </span>
                  <div className="flex gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/investigation/$caseId" params={{ caseId: c.id }}>
                        Review
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPending({ caseId: c.id, mode: "reject" })}
                    >
                      <X className="size-3.5" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => setPending({ caseId: c.id, mode: "approve" })}>
                      <Check className="size-3.5" /> Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => (open ? null : setPending(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.mode === "approve" ? "Approve recovery" : "Reject case"}
            </DialogTitle>
            <DialogDescription>
              {pending?.mode === "approve"
                ? "This records a recovery action against the case and updates recovered revenue."
                : "This closes the case with no recovery recorded."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for the decision (optional)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Recording…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
