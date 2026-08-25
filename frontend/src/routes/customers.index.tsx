import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { getCustomers, getLeakageCases } from "@/services/dataService";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/customers/")({
  head: () => ({
    meta: [
      { title: "Customer Investigation | RevenueGuard AI" },
      {
        name: "description",
        content:
          "Browse every customer account with contract value, open leakage cases and total revenue at risk.",
      },
      { property: "og:title", content: "Customer Investigation | RevenueGuard AI" },
      {
        property: "og:description",
        content: "Drill into contracts, invoices, payments and usage per customer.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const customers = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const cases = useQuery({ queryKey: ["cases"], queryFn: getLeakageCases });

  const lossFor = (id: string) =>
    (cases.data ?? [])
      .filter((c) => c.customerId === id)
      .reduce((a, c) => a + c.estimatedLoss, 0);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an account to review its billing record and detected anomalies.
        </p>
      </div>

      {customers.isError ? <ErrorState /> : null}

      {customers.isPending ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} rows={3} />
          ))}
        </div>
      ) : (customers.data ?? []).length === 0 ? (
        <EmptyState title="No customers" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(customers.data ?? []).map((c) => {
            const loss = lossFor(c.id);
            const count = (cases.data ?? []).filter((k) => k.customerId === c.id).length;
            return (
              <Link key={c.id} to="/customers/$customerId" params={{ customerId: c.id }}>
                <Card className="h-full border-border bg-card transition-colors hover:border-primary/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.id} · {c.segment} · {c.industry}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">ACV</dt>
                        <dd className="tabular">{formatINR(c.annualContractValue)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Leakage</dt>
                        <dd className="tabular text-critical">
                          {loss > 0 ? formatINR(loss) : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Cases</dt>
                        <dd className="tabular">{count}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Owner</dt>
                        <dd>{c.accountManager}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
