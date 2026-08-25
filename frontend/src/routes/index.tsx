import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Flame,
  Percent,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
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
import { getDashboardMetrics, getLeakageCases } from "@/services/dataService";
import { getRecoveryHistory } from "@/services/recoveryService";
import { LEAKAGE_LABELS } from "@/data/seed/scenarios";
import { formatDate, formatINR, formatINRShort, formatMonth, formatPct } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Executive Dashboard | RevenueGuard AI" },
      {
        name: "description",
        content:
          "Track revenue at risk, recoverable leakage and recovered value across every detected billing anomaly.",
      },
      { property: "og:title", content: "Executive Dashboard | RevenueGuard AI" },
      {
        property: "og:description",
        content: "AI-detected revenue leakage, investigation and human-approved recovery.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: getDashboardMetrics });
  const cases = useQuery({ queryKey: ["cases"], queryFn: getLeakageCases });
  const recoveries = useQuery({ queryKey: ["recoveries"], queryFn: getRecoveryHistory });

  const m = metrics.data;
  const openCases = (cases.data ?? [])
    .filter((c) => ["detected", "investigating", "investigated", "pending_approval"].includes(c.status))
    .sort((a, b) => b.estimatedLoss - a.estimatedLoss);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Executive Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Synthetic revenue ledger · all figures derived on read from contracts, invoices, payments
          and usage.
        </p>
      </div>

      {metrics.isError ? <ErrorState /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {metrics.isPending || !m ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} rows={2} />)
        ) : (
          <>
            <KpiCard
              label="Revenue at Risk"
              value={formatINRShort(m.revenueAtRisk)}
              sub={formatINR(m.revenueAtRisk)}
              icon={ShieldAlert}
              tone="critical"
            />
            <KpiCard
              label="Recoverable"
              value={formatINRShort(m.recoverable)}
              sub={formatINR(m.recoverable)}
              icon={Wallet}
              tone="warning"
            />
            <KpiCard
              label="Recovered"
              value={formatINRShort(m.recovered)}
              sub={formatINR(m.recovered)}
              icon={BadgeCheck}
              tone="success"
            />
            <KpiCard label="Active Cases" value={String(m.activeCases)} icon={Activity} />
            <KpiCard
              label="Critical Cases"
              value={String(m.criticalCases)}
              icon={Flame}
              tone="critical"
            />
            <KpiCard
              label="Recovery Rate"
              value={formatPct(m.recoveryRate, 1)}
              sub="recovered ÷ identified"
              icon={Percent}
              tone="primary"
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-2">
          <CardContent className="p-5">
            <SectionHeading title="Leakage trend" description="Detected vs recovered, last 8 months" />
            <div className="h-64">
              {m ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={formatMonth}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatINRShort(v)}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      width={54}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => formatINR(v)}
                      labelFormatter={(l: string) => formatMonth(l)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="atRisk"
                      name="Detected"
                      stroke="var(--critical)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="recovered"
                      name="Recovered"
                      stroke="var(--success)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <CardSkeleton rows={6} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Leakage by category" />
            <div className="h-64">
              {m ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.byCategory} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatINRShort(v)}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                    />
                    <YAxis type="category" dataKey="label" hide />
                    <Tooltip
                      cursor={{ fill: "var(--accent)" }}
                      contentStyle={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => formatINR(v)}
                    />
                    <Bar dataKey="amount" name="At risk" fill="var(--warning)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <CardSkeleton rows={6} />
              )}
            </div>
            <ul className="mt-3 space-y-1.5">
              {(m?.byCategory ?? []).slice(0, 4).map((c) => (
                <li key={c.type} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="tabular">{formatINR(c.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-critical/35 bg-critical/6">
        <CardContent className="p-5">
          <SectionHeading
            title="AI-Detected Revenue Leakage"
            description="Highest-value open cases awaiting investigation"
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/leakage">
                  View all cases <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            }
          />
          {cases.isPending ? (
            <div className="grid gap-3 md:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : openCases.length === 0 ? (
            <EmptyState title="No open leakage" description="Every detected case has been resolved." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {openCases.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{c.customerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.id} · {LEAKAGE_LABELS[c.type]}
                      </p>
                    </div>
                    <SeverityBadge severity={c.severity} />
                  </div>
                  <p className="tabular mt-3 text-xl font-semibold text-critical">
                    {formatINR(c.estimatedLoss)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recoverable {formatINR(c.recoverable)} · confidence {formatPct(c.confidence)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.rootCause}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <StatusBadge status={c.status} />
                    <Button asChild size="sm">
                      <Link to="/investigation/$caseId" params={{ caseId: c.id }}>
                        <AlertTriangle className="size-3.5" /> Investigate
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Top customers by leakage" />
            <ul className="space-y-2.5">
              {(m?.topCustomers ?? []).map((t) => (
                <li key={t.customerId} className="flex items-center justify-between gap-3">
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: t.customerId }}
                    className="text-sm hover:text-primary"
                  >
                    {t.name}
                    <span className="ml-2 text-xs text-muted-foreground">{t.cases} case(s)</span>
                  </Link>
                  <span className="tabular text-sm text-critical">{formatINR(t.amount)}</span>
                </li>
              ))}
              {!m ? <CardSkeleton rows={5} /> : null}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Recent investigations" />
            {openCases.filter((c) => c.status !== "detected").length === 0 ? (
              <EmptyState
                title="No investigations yet"
                description="Run an investigation from a leakage case to populate this feed."
              />
            ) : (
              <ul className="space-y-2.5">
                {openCases
                  .filter((c) => c.status !== "detected")
                  .slice(0, 6)
                  .map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link
                        to="/investigation/$caseId"
                        params={{ caseId: c.id }}
                        className="hover:text-primary"
                      >
                        {c.customerName}
                        <span className="ml-2 text-xs text-muted-foreground">{c.id}</span>
                      </Link>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Recent recovery actions" />
            <ul className="space-y-2.5">
              {(recoveries.data ?? []).slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {r.customerName}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDate(r.decidedOn)}
                    </span>
                  </span>
                  <span
                    className={
                      r.status === "recovered"
                        ? "tabular text-success"
                        : "tabular text-muted-foreground"
                    }
                  >
                    {r.status === "recovered" ? formatINR(r.amountRecovered) : "Rejected"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
