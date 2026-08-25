import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  ErrorState,
  SectionHeading,
  SeverityBadge,
  StatusBadge,
  TableSkeleton,
} from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLeakageCases } from "@/services/dataService";
import { LEAKAGE_LABELS } from "@/data/seed/scenarios";
import { formatDate, formatINR, formatPct } from "@/lib/format";

export const Route = createFileRoute("/leakage")({
  head: () => ({
    meta: [
      { title: "Revenue Leakage Cases | RevenueGuard AI" },
      {
        name: "description",
        content:
          "Every AI-detected billing anomaly with estimated loss, recoverable value, severity, confidence and recommended action.",
      },
      { property: "og:title", content: "Revenue Leakage Cases | RevenueGuard AI" },
      {
        property: "og:description",
        content: "Filter and triage detected revenue leakage across the customer book.",
      },
    ],
  }),
  component: LeakagePage,
});

const ALL = "all";

function LeakagePage() {
  const cases = useQuery({ queryKey: ["cases"], queryFn: getLeakageCases });

  const [severity, setSeverity] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [q, setQ] = useState("");
  const [minAmount, setMinAmount] = useState("");

  const rows = useMemo(() => {
    const min = Number(minAmount) || 0;
    return (cases.data ?? [])
      .filter((c) => (severity === ALL ? true : c.severity === severity))
      .filter((c) => (type === ALL ? true : c.type === type))
      .filter((c) => (status === ALL ? true : c.status === status))
      .filter((c) => c.estimatedLoss >= min)
      .filter((c) =>
        q.trim() === ""
          ? true
          : `${c.customerName} ${c.id}`.toLowerCase().includes(q.trim().toLowerCase()),
      )
      .sort((a, b) => b.estimatedLoss - a.estimatedLoss);
  }, [cases.data, severity, type, status, q, minAmount]);

  const totalLoss = rows.reduce((a, c) => a + c.estimatedLoss, 0);
  const totalRecoverable = rows.reduce((a, c) => a + c.recoverable, 0);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Revenue Leakage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} case(s) · {formatINR(totalLoss)} estimated loss ·{" "}
          {formatINR(totalRecoverable)} recoverable
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Customer or case ID"
                className="pl-8"
              />
            </div>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All severities</SelectItem>
                {["critical", "high", "medium", "low"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {Object.entries(LEAKAGE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {[
                  "detected",
                  "investigating",
                  "investigated",
                  "pending_approval",
                  "recovered",
                  "rejected",
                ].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Min amount (₹)"
              inputMode="numeric"
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4">
        {cases.isError ? <ErrorState /> : null}
        {cases.isPending ? (
          <TableSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState title="No matching cases" description="Adjust the filters above." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Case</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5 text-right">Est. loss</th>
                    <th className="px-3 py-2.5 text-right">Recoverable</th>
                    <th className="px-3 py-2.5">Severity</th>
                    <th className="px-3 py-2.5 text-right">Conf.</th>
                    <th className="px-3 py-2.5">Detected</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b border-border/70 last:border-0 hover:bg-accent/40">
                      <td className="px-3 py-2.5 font-medium">{c.id}</td>
                      <td className="px-3 py-2.5">
                        <Link
                          to="/customers/$customerId"
                          params={{ customerId: c.customerId }}
                          className="hover:text-primary"
                        >
                          {c.customerName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{LEAKAGE_LABELS[c.type]}</td>
                      <td className="tabular px-3 py-2.5 text-right text-critical">
                        {formatINR(c.estimatedLoss)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{formatINR(c.recoverable)}</td>
                      <td className="px-3 py-2.5">
                        <SeverityBadge severity={c.severity} />
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{formatPct(c.confidence)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(c.detectedOn)}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button asChild size="sm">
                          <Link to="/investigation/$caseId" params={{ caseId: c.id }}>
                            <AlertTriangle className="size-3.5" /> Investigate
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 lg:hidden">
              {rows.map((c) => (
                <Card key={c.id} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{c.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.id} · {LEAKAGE_LABELS[c.type]}
                        </p>
                      </div>
                      <SeverityBadge severity={c.severity} />
                    </div>
                    <p className="tabular mt-3 text-lg font-semibold text-critical">
                      {formatINR(c.estimatedLoss)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recoverable {formatINR(c.recoverable)} · {formatPct(c.confidence)} confidence ·{" "}
                      {formatDate(c.detectedOn)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{c.rootCause}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <StatusBadge status={c.status} />
                      <Button asChild size="sm">
                        <Link to="/investigation/$caseId" params={{ caseId: c.id }}>
                          Investigate
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-6">
        <SectionHeading
          title="Recommended actions"
          description="Generated per case from the underlying records"
        />
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {rows.slice(0, 5).map((c) => (
            <li key={c.id}>
              <span className="text-foreground">{c.id}</span> — {c.recommendedAction}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
