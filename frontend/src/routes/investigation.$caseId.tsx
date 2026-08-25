import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, Play, Send, Terminal } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  SectionHeading,
  SeverityBadge,
  StatusBadge,
} from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLeakageCase } from "@/services/dataService";
import {
  getInvestigation,
  runInvestigation,
  sendToApproval,
} from "@/services/investigationService";
import { LEAKAGE_LABELS } from "@/data/seed/scenarios";
import { formatINR, formatPct } from "@/lib/format";
import type { AgentDecision, AgentLogEntry, InvestigationStep } from "@/domain/types";

export const Route = createFileRoute("/investigation/$caseId")({
  head: () => ({
    meta: [
      { title: "AI Investigation | RevenueGuard AI" },
      {
        name: "description",
        content:
          "Watch the simulated agent retrieve contracts, invoices, payments and usage, then explain the leakage it found.",
      },
      { property: "og:title", content: "AI Investigation | RevenueGuard AI" },
      {
        property: "og:description",
        content: "Step-by-step evidence, root cause and financial impact for one leakage case.",
      },
    ],
  }),
  component: InvestigationPage,
});

const GLYPH = { ok: "✓", warn: "⚠", info: "·" } as const;

function InvestigationPage() {
  const { caseId } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const leakageCase = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getLeakageCase(caseId),
  });
  const existing = useQuery({
    queryKey: ["investigation", caseId],
    queryFn: () => getInvestigation(caseId),
  });

  const [steps, setSteps] = useState<InvestigationStep[]>([]);
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [decision, setDecision] = useState<AgentDecision | null>(null);
  const [running, setRunning] = useState(false);
  const [sent, setSent] = useState(false);

  const shownSteps = steps.length > 0 ? steps : (existing.data?.steps ?? []);
  const shownLogs = logs.length > 0 ? logs : (existing.data?.logs ?? []);
  const shownDecision = decision ?? existing.data?.decision ?? null;

  const start = async () => {
    setRunning(true);
    setSteps([]);
    setLogs([]);
    setDecision(null);
    setSent(false);
    try {
      const record = await runInvestigation(caseId, {
        onStep: (step) =>
          setSteps((prev) => {
            const next = [...prev];
            const i = next.findIndex((s) => s.id === step.id);
            if (i >= 0) next[i] = step;
            else next.push(step);
            return next;
          }),
        onLog: (entry) => setLogs((prev) => [...prev, entry]),
      });
      setDecision(record.decision);
      await queryClient.invalidateQueries();
    } catch {
      toast.error("Investigation failed");
    } finally {
      setRunning(false);
    }
  };

  const send = async () => {
    await sendToApproval(caseId);
    setSent(true);
    await queryClient.invalidateQueries();
    toast.success("Sent to the approval queue");
    router.navigate({ to: "/approvals" });
  };

  const c = leakageCase.data;

  if (leakageCase.isError) {
    return (
      <AppShell>
        <ErrorState />
      </AppShell>
    );
  }
  if (leakageCase.isPending) {
    return (
      <AppShell>
        <CardSkeleton rows={6} />
      </AppShell>
    );
  }
  if (!c) {
    return (
      <AppShell>
        <EmptyState title="Case not found" description={caseId} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Simulated investigation
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            {c.customerName} · {LEAKAGE_LABELS[c.type]}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {c.id} · <SeverityBadge severity={c.severity} /> <StatusBadge status={c.status} />
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/customers/$customerId" params={{ customerId: c.customerId }}>
              View customer
            </Link>
          </Button>
          <Button onClick={start} disabled={running} size="sm">
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? "Investigating…" : "Run investigation"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Investigation steps" description="11-step tool sequence" />
            {shownSteps.length === 0 ? (
              <EmptyState
                title="Not started"
                description="Run the investigation to stream each tool call."
              />
            ) : (
              <ol className="space-y-2.5">
                {shownSteps.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                        s.status === "done"
                          ? "bg-success/15 text-success"
                          : s.status === "warning"
                            ? "bg-warning/15 text-warning"
                            : s.status === "running"
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.status === "running" ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        s.index + 1
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm">
                        {s.label}
                        {s.tool ? (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {s.tool}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.detail}</p>
                    </div>
                    <span className="tabular ml-auto shrink-0 text-[11px] text-muted-foreground">
                      {s.latencyMs}ms
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading
              title="Agent activity log"
              description="Read-only tool calls, timestamped"
            />
            <div className="h-[420px] overflow-y-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed">
              {shownLogs.length === 0 ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Terminal className="size-3.5" /> awaiting run…
                </p>
              ) : (
                shownLogs.map((l, i) => (
                  <p key={i} className="text-muted-foreground">
                    <span className="text-foreground/70">{l.time}</span>{" "}
                    <span
                      className={
                        l.glyph === "warn"
                          ? "text-warning"
                          : l.glyph === "ok"
                            ? "text-success"
                            : ""
                      }
                    >
                      {GLYPH[l.glyph]}
                    </span>{" "}
                    {l.message}
                  </p>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {shownDecision ? (
        <Card className="mt-4 border-border bg-card">
          <CardContent className="space-y-5 p-5">
            <SectionHeading
              title="Agent decision"
              description={shownDecision.objective}
              action={
                <Button onClick={send} disabled={sent}>
                  {sent ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
                  {sent ? "Sent" : "Send to Approval"}
                </Button>
              }
            />

            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</h3>
              <div className="mt-2 overflow-x-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Expected</th>
                      <th className="px-3 py-2">Actual</th>
                      <th className="px-3 py-2">Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.evidence.map((e, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          {e.sourceType} / {e.sourceId}
                        </td>
                        <td className="px-3 py-2 font-mono">{e.field}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.expectedValue}</td>
                        <td className="px-3 py-2 text-critical">{e.actualValue}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Reasoning</h3>
                <p className="mt-1 text-sm">{shownDecision.reasoningSummary}</p>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Finding</h3>
                <p className="mt-1 text-sm">{shownDecision.detectedIssue}</p>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Root cause</h3>
                <p className="mt-1 text-sm">{c.rootCause}</p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-4">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                Financial impact
              </h3>
              <p className="tabular mt-1 text-2xl font-semibold text-critical">
                {formatINR(shownDecision.financialImpact.estimatedLoss)}
              </p>
              <p className="text-xs text-muted-foreground">
                Recoverable {formatINR(shownDecision.financialImpact.recoverable)}
              </p>
              <ul className="mt-3 space-y-1 font-mono text-xs text-muted-foreground">
                {shownDecision.financialImpact.calculation.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                  Recommended action
                </h3>
                <p className="mt-1 text-sm">{shownDecision.recommendedAction}</p>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                  Confidence {formatPct(shownDecision.detectionConfidence)}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {shownDecision.confidenceRationale}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}
