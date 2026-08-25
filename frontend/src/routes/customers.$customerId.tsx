import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
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
import {
  getCasesForCustomer,
  getContract,
  getCustomer,
  getDiscountHistory,
  getInvoices,
  getPayments,
  getRefundHistory,
  getSubscription,
  getUsage,
} from "@/services/dataService";
import { LEAKAGE_LABELS } from "@/data/seed/scenarios";
import { formatDate, formatINR, formatMonth, formatPct } from "@/lib/format";

export const Route = createFileRoute("/customers/$customerId")({
  head: () => ({
    meta: [
      { title: "Customer Billing Record | RevenueGuard AI" },
      {
        name: "description",
        content:
          "Full billing record for one account: contract, subscription, invoices, payments, discounts, refunds, usage and detected anomalies.",
      },
      { property: "og:title", content: "Customer Billing Record | RevenueGuard AI" },
      {
        property: "og:description",
        content: "Investigate a single customer's revenue leakage against source records.",
      },
    ],
  }),
  component: CustomerDetail,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular text-sm">{value}</dd>
    </div>
  );
}

function CustomerDetail() {
  const { customerId } = Route.useParams();

  const customer = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => getCustomer(customerId),
  });
  const contract = useQuery({
    queryKey: ["contract", customerId],
    queryFn: () => getContract(customerId),
  });
  const subscription = useQuery({
    queryKey: ["subscription", customerId],
    queryFn: () => getSubscription(customerId),
  });
  const invoices = useQuery({
    queryKey: ["invoices", customerId],
    queryFn: () => getInvoices(customerId),
  });
  const payments = useQuery({
    queryKey: ["payments", customerId],
    queryFn: () => getPayments(customerId),
  });
  const discounts = useQuery({
    queryKey: ["discounts", customerId],
    queryFn: () => getDiscountHistory(customerId),
  });
  const refunds = useQuery({
    queryKey: ["refunds", customerId],
    queryFn: () => getRefundHistory(customerId),
  });
  const usage = useQuery({
    queryKey: ["usage", customerId],
    queryFn: () => getUsage(customerId),
  });
  const cases = useQuery({
    queryKey: ["cases", customerId],
    queryFn: () => getCasesForCustomer(customerId),
  });

  const c = customer.data;
  const ct = contract.data;
  const sub = subscription.data;

  const leakage = (cases.data ?? []).reduce((a, k) => a + k.estimatedLoss, 0);
  const recoverable = (cases.data ?? []).reduce((a, k) => a + k.recoverable, 0);

  const timeline = [
    ...(invoices.data ?? []).map((i) => ({
      date: i.issuedOn,
      title: `Invoice ${i.id} issued`,
      detail: `${formatMonth(i.periodMonth)} · ${formatINR(i.totalAmount)} (expected ${formatINR(i.expectedAmount)})`,
      tone: i.totalAmount < i.expectedAmount ? "warn" : "ok",
    })),
    ...(payments.data ?? []).map((p) => ({
      date: p.paidOn,
      title: `Payment ${p.id}`,
      detail: `${formatINR(p.amount)} via ${p.method} against ${p.invoiceId}`,
      tone: "ok",
    })),
    ...(discounts.data ?? []).map((d) => ({
      date: d.appliedOn,
      title: `Discount ${formatPct(d.pct / 100)} on ${d.invoiceId}`,
      detail: `${d.authorized ? "Authorized" : "UNAUTHORIZED"} · approved by ${d.approvedBy}`,
      tone: d.authorized ? "ok" : "warn",
    })),
    ...(refunds.data ?? []).map((r) => ({
      date: r.issuedOn,
      title: `Refund ${r.id}`,
      detail: `${formatINR(r.amount)} · ${r.reason} · ref ${r.reference}`,
      tone: "warn",
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (customer.isError) {
    return (
      <AppShell>
        <ErrorState />
      </AppShell>
    );
  }

  if (customer.isPending) {
    return (
      <AppShell>
        <CardSkeleton rows={6} />
      </AppShell>
    );
  }

  if (!c) {
    return (
      <AppShell>
        <EmptyState title="Customer not found" description={customerId} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.id} · {c.segment} · {c.industry} · {c.region} · customer since {formatDate(c.since)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Estimated leakage</p>
          <p className="tabular text-xl font-semibold text-critical">{formatINR(leakage)}</p>
          <p className="text-xs text-muted-foreground">
            Recoverable {formatINR(recoverable)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Contract" />
            {ct ? (
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Contract" value={ct.id} />
                <Field label="Approved discount" value={`${ct.approvedDiscountPct}%`} />
                <Field label="Monthly fee" value={formatINR(ct.contractedMonthlyFee)} />
                <Field label="Included units" value={String(ct.includedUnits)} />
                <Field label="Overage rate" value={formatINR(ct.overageRatePerUnit)} />
                <Field label="Payment terms" value={`${ct.paymentTermsDays} days`} />
                <Field label="Start" value={formatDate(ct.startDate)} />
                <Field label="End" value={formatDate(ct.endDate)} />
              </dl>
            ) : (
              <CardSkeleton rows={4} />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Subscription" />
            {sub ? (
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Plan" value={sub.plan} />
                <Field label="Status" value={sub.status} />
                <Field label="Seats" value={String(sub.seats)} />
                <Field label="Price / seat" value={formatINR(sub.pricePerSeat)} />
                <Field label="Cycle" value={sub.billingCycle} />
                <Field label="Started" value={formatDate(sub.startedOn)} />
              </dl>
            ) : (
              <CardSkeleton rows={4} />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Detected anomalies" />
            {(cases.data ?? []).length === 0 ? (
              <EmptyState title="Clean account" description="No leakage detected." />
            ) : (
              <ul className="space-y-3">
                {(cases.data ?? []).map((k) => (
                  <li key={k.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{LEAKAGE_LABELS[k.type]}</p>
                        <p className="text-xs text-muted-foreground">{k.id}</p>
                      </div>
                      <SeverityBadge severity={k.severity} />
                    </div>
                    <p className="tabular mt-2 text-sm text-critical">
                      {formatINR(k.estimatedLoss)}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <StatusBadge status={k.status} />
                      <Button asChild size="sm" variant="outline">
                        <Link to="/investigation/$caseId" params={{ caseId: k.id }}>
                          <AlertTriangle className="size-3.5" /> Investigate
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Invoices" description="Billed vs expected per period" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Invoice</th>
                    <th className="py-2">Period</th>
                    <th className="py-2 text-right">Billed</th>
                    <th className="py-2 text-right">Expected</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoices.data ?? []).map((i) => (
                    <tr key={i.id} className="border-t border-border/60">
                      <td className="py-2">{i.id}</td>
                      <td className="py-2 text-muted-foreground">{formatMonth(i.periodMonth)}</td>
                      <td className="tabular py-2 text-right">{formatINR(i.totalAmount)}</td>
                      <td className="tabular py-2 text-right text-muted-foreground">
                        {formatINR(i.expectedAmount)}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {i.status.replace("_", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <SectionHeading title="Usage" description="Consumption vs billed overage" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Period</th>
                    <th className="py-2 text-right">Units</th>
                    <th className="py-2 text-right">Billable</th>
                    <th className="py-2 text-right">Billed</th>
                    <th className="py-2 text-right">Seats</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage.data ?? []).map((u) => (
                    <tr key={u.id} className="border-t border-border/60">
                      <td className="py-2 text-muted-foreground">{formatMonth(u.periodMonth)}</td>
                      <td className="tabular py-2 text-right">{u.unitsConsumed}</td>
                      <td className="tabular py-2 text-right">{u.billableOverage}</td>
                      <td
                        className={
                          u.billedOverage < u.billableOverage
                            ? "tabular py-2 text-right text-critical"
                            : "tabular py-2 text-right"
                        }
                      >
                        {u.billedOverage}
                      </td>
                      <td className="tabular py-2 text-right">
                        {u.billedSeats}/{u.activeSeats}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 border-border bg-card">
        <CardContent className="p-5">
          <SectionHeading title="Billing event timeline" description="Newest first" />
          {timeline.length === 0 ? (
            <EmptyState title="No events" />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {timeline.map((e, i) => (
                <li key={`${e.title}-${i}`} className="relative">
                  <span
                    className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${
                      e.tone === "warn" ? "bg-warning" : "bg-primary"
                    }`}
                  />
                  <p className="text-sm">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.date)} · {e.detail}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
