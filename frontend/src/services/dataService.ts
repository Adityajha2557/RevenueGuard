import { DATASET } from "@/data/seed/generate";
import { LEAKAGE_LABELS } from "@/data/seed/scenarios";
import type {
  Contract,
  Customer,
  DashboardMetrics,
  Discount,
  Invoice,
  LeakageCase,
  LeakageType,
  Payment,
  Refund,
  Subscription,
  UsageRecord,
} from "@/domain/types";
import { sessionStore } from "@/store/sessionStore";

/** Simulated network latency so swapping in fetch/Supabase/Bedrock needs no UI change. */
const delay = (ms = 220) => new Promise<void>((r) => setTimeout(r, ms));

export async function getCustomers(): Promise<Customer[]> {
  await delay(180);
  return DATASET.customers;
}

export async function getCustomer(customerId: string): Promise<Customer | undefined> {
  await delay(120);
  return DATASET.customers.find((c) => c.id === customerId);
}

export async function getContract(customerId: string): Promise<Contract | undefined> {
  await delay(120);
  return DATASET.contracts.find((c) => c.customerId === customerId);
}

export async function getSubscription(customerId: string): Promise<Subscription | undefined> {
  await delay(110);
  return DATASET.subscriptions.find((s) => s.customerId === customerId);
}

export async function getInvoices(customerId: string): Promise<Invoice[]> {
  await delay(150);
  return DATASET.invoices.filter((i) => i.customerId === customerId);
}

export async function getPayments(customerId: string): Promise<Payment[]> {
  await delay(140);
  return DATASET.payments.filter((p) => p.customerId === customerId);
}

export async function getDiscountHistory(customerId: string): Promise<Discount[]> {
  await delay(120);
  return DATASET.discounts.filter((d) => d.customerId === customerId);
}

export async function getRefundHistory(customerId: string): Promise<Refund[]> {
  await delay(120);
  return DATASET.refunds.filter((r) => r.customerId === customerId);
}

export async function getUsage(customerId: string): Promise<UsageRecord[]> {
  await delay(130);
  return DATASET.usage.filter((u) => u.customerId === customerId);
}

export async function getLeakageCases(): Promise<LeakageCase[]> {
  await delay(200);
  return sessionStore.getCases();
}

export async function getLeakageCase(caseId: string): Promise<LeakageCase | undefined> {
  await delay(140);
  return sessionStore.getCase(caseId);
}

export async function getCasesForCustomer(customerId: string): Promise<LeakageCase[]> {
  await delay(140);
  return sessionStore.getCases().filter((c) => c.customerId === customerId);
}

const OPEN_STATUSES = new Set(["detected", "investigating", "investigated", "pending_approval"]);

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await delay(240);
  const cases = sessionStore.getCases();
  const recoveries = sessionStore.getRecoveries();

  const open = cases.filter((c) => OPEN_STATUSES.has(c.status));
  const revenueAtRisk = open.reduce((a, c) => a + c.estimatedLoss, 0);
  const recoverable = open.reduce((a, c) => a + c.recoverable, 0);
  const recovered = recoveries
    .filter((r) => r.status === "recovered")
    .reduce((a, r) => a + r.amountRecovered, 0);

  const identifiedTotal = cases.reduce((a, c) => a + c.estimatedLoss, 0);
  const recoveryRate = identifiedTotal === 0 ? 0 : recovered / identifiedTotal;

  const monthBuckets = new Map<string, { atRisk: number; recovered: number }>();
  const monthOf = (iso: string) => iso.slice(0, 7);
  for (let i = 7; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(2026, 7 - i, 1));
    monthBuckets.set(d.toISOString().slice(0, 7), { atRisk: 0, recovered: 0 });
  }
  cases.forEach((c) => {
    const b = monthBuckets.get(monthOf(c.detectedOn));
    if (b) b.atRisk += c.estimatedLoss;
  });
  recoveries.forEach((r) => {
    const b = monthBuckets.get(monthOf(r.decidedOn));
    if (b && r.status === "recovered") b.recovered += r.amountRecovered;
  });

  const byCategoryMap = new Map<LeakageType, { amount: number; count: number }>();
  open.forEach((c) => {
    const prev = byCategoryMap.get(c.type) ?? { amount: 0, count: 0 };
    byCategoryMap.set(c.type, { amount: prev.amount + c.estimatedLoss, count: prev.count + 1 });
  });

  const topMap = new Map<string, { name: string; amount: number; cases: number }>();
  open.forEach((c) => {
    const prev = topMap.get(c.customerId) ?? { name: c.customerName, amount: 0, cases: 0 };
    topMap.set(c.customerId, {
      name: c.customerName,
      amount: prev.amount + c.estimatedLoss,
      cases: prev.cases + 1,
    });
  });

  return {
    revenueAtRisk,
    recoverable,
    recovered,
    activeCases: open.length,
    criticalCases: open.filter((c) => c.severity === "critical").length,
    recoveryRate,
    trend: [...monthBuckets.entries()].map(([month, v]) => ({ month, ...v })),
    byCategory: [...byCategoryMap.entries()]
      .map(([type, v]) => ({ type, label: LEAKAGE_LABELS[type], ...v }))
      .sort((a, b) => b.amount - a.amount),
    topCustomers: [...topMap.entries()]
      .map(([customerId, v]) => ({ customerId, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6),
  };
}
