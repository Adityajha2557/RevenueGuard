import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BadgeCheck, Percent, Wallet } from "lucide-react";
import { getRecoveryHistory } from "@/services/recoveryService";
import { formatDate, formatINR, formatINRShort, formatPct } from "@/lib/format";

export const Route = createFileRoute("/recovery")({
  head: () => ({
    meta: [
      { title: "Recovery History | RevenueGuard AI" },
      {
        name: "description",
        content:
          "Audit trail of every approved or rejected recovery: amount recovered, action taken, approver and date.",
      },
      { property: "og:title", content: "Recovery History | RevenueGuard AI" },
      {
        property: "og:description",
        content: "A complete, human-signed audit log of recovered revenue.",
      },
    ],
  }),
  component: RecoveryPage,
});

const ALL = "all";

function RecoveryPage() {
  const history = useQuery({ queryKey: ["recoveries"], queryFn: getRecoveryHistory });
  const [status, setStatus] = useState(ALL);
  const [q, setQ] = useState("");

  const rows = useMemo(
    () =>
      (history.data ?? [])
        .filter((r) => (status === ALL ? true : r.status === status))
        .filter((r) =>
          q.trim() === ""
            ? true
            : `${r.customerName} ${r.id} ${r.caseId}`.toLowerCase().includes(q.trim().toLowerCase()),
        )
        .sort((a, b) => (a.decidedOn < b.decidedOn ? 1 : -1)),
    [history.data, status, q],
  );

  const recovered = rows
    .filter((r) => r.status === "recovered")
    .reduce((a, r) => a + r.amountRecovered, 0);
  const identified = rows.reduce((a, r) => a + r.originalLeakage, 0);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Recovery History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every decision is attributable to a named approver.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total recovered"
          value={formatINRShort(recovered)}
          sub={formatINR(recovered)}
          icon={BadgeCheck}
          tone="success"
        />
        <KpiCard
          label="Original leakage"
          value={formatINRShort(identified)}
          sub={formatINR(identified)}
          icon={Wallet}
          tone="warning"
        />
        <KpiCard
          label="Recovery rate"
          value={identified === 0 ? "—" : formatPct(recovered / identified, 1)}
          sub="recovered ÷ identified"
          icon={Percent}
          tone="primary"
        />
      </div>

      <Card className="mt-4 border-border bg-card">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer, recovery or case ID"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="recovered">Recovered</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4">
        {history.isError ? <ErrorState /> : null}
        {history.isPending ? (
          <TableSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="No recovery actions" description="Approve a case to start the log." />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Recovery</th>
                    <th className="px-3 py-2.5">Customer</th>
                    <th className="px-3 py-2.5 text-right">Original leakage</th>
                    <th className="px-3 py-2.5 text-right">Recovered</th>
                    <th className="px-3 py-2.5">Action taken</th>
                    <th className="px-3 py-2.5">Approved by</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/70 last:border-0">
                      <td className="px-3 py-2.5 font-medium">{r.id}</td>
                      <td className="px-3 py-2.5">
                        {r.customerName}
                        <span className="ml-2 text-xs text-muted-foreground">{r.caseId}</span>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-muted-foreground">
                        {formatINR(r.originalLeakage)}
                      </td>
                      <td
                        className={
                          r.status === "recovered"
                            ? "tabular px-3 py-2.5 text-right text-success"
                            : "tabular px-3 py-2.5 text-right text-muted-foreground"
                        }
                      >
                        {formatINR(r.amountRecovered)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.actionTaken}</td>
                      <td className="px-3 py-2.5 text-xs">{r.approvedBy}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatDate(r.decidedOn)}
                      </td>
                      <td className="px-3 py-2.5 text-xs capitalize">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {rows.map((r) => (
                <Card key={r.id} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{r.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.id} · {r.caseId} · {formatDate(r.decidedOn)}
                        </p>
                      </div>
                      <span
                        className={
                          r.status === "recovered"
                            ? "tabular text-sm text-success"
                            : "tabular text-sm text-muted-foreground"
                        }
                      >
                        {formatINR(r.amountRecovered)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{r.actionTaken}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Approved by {r.approvedBy}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
