import type {
  Contract,
  Discount,
  Evidence,
  Invoice,
  LeakageCase,
  LeakageType,
  Payment,
  Refund,
  Severity,
  Subscription,
  UsageRecord,
} from "@/domain/types";
import { DATASET } from "@/data/seed/generate";
import { LEAKAGE_LABELS, SCENARIOS } from "@/data/seed/scenarios";
import { formatINR } from "@/lib/format";

export interface DetectionInput {
  customerId: string;
  contract: Contract;
  subscription: Subscription;
  invoices: Invoice[];
  payments: Payment[];
  discounts: Discount[];
  refunds: Refund[];
  usage: UsageRecord[];
}

export interface DetectionResult {
  type: LeakageType;
  estimatedLoss: number;
  evidence: Evidence[];
  calculation: string[];
  rootCause: string;
  recommendedAction: string;
  detectedIssue: string;
}

const RECOVERY_FACTOR: Record<LeakageType, number> = {
  unauthorized_discount: 1,
  missing_usage_charge: 0.9,
  invoice_mismatch: 0.95,
  partial_payment: 0.85,
  duplicate_refund: 1,
  subscription_usage_mismatch: 0.8,
  incorrect_pricing: 0.75,
  contract_billing_discrepancy: 0.9,
};

function severityFor(amount: number): Severity {
  if (amount >= 250000) return "critical";
  if (amount >= 150000) return "high";
  if (amount >= 60000) return "medium";
  return "low";
}

function pct(n: number) {
  return `${n}%`;
}

/** Per-type detectors. Each folds over raw records — no hardcoded totals. */
export function calculateLeakage(input: DetectionInput, type: LeakageType): DetectionResult {
  const { contract, subscription, invoices, payments, discounts, refunds, usage } = input;
  const evidence: Evidence[] = [];
  const calculation: string[] = [];
  let estimatedLoss = 0;

  switch (type) {
    case "unauthorized_discount": {
      const bad = discounts.filter((d) => !d.authorized);
      bad.forEach((d) => {
        const inv = invoices.find((i) => i.id === d.invoiceId)!;
        const gross = inv.baseAmount + inv.usageAmount;
        const delta = Math.round((gross * (d.pct - contract.approvedDiscountPct)) / 100);
        estimatedLoss += delta;
        calculation.push(
          `${inv.id}: ₹${gross.toLocaleString("en-IN")} × (${d.pct}% − ${contract.approvedDiscountPct}%) = ${formatINR(delta)}`,
        );
        evidence.push({
          sourceType: "invoice",
          sourceId: inv.id,
          field: "discount_pct",
          expectedValue: pct(contract.approvedDiscountPct),
          actualValue: pct(d.pct),
          explanation: `Applied discount exceeds contract ${contract.id} approved rate`,
        });
      });
      return {
        type,
        estimatedLoss,
        evidence,
        calculation,
        detectedIssue: `${bad.length} invoices contain a discount inconsistent with contract ${contract.id}`,
        rootCause: `A ${discounts.find((d) => !d.authorized)?.pct ?? 0}% discount was applied at billing time although contract ${contract.id} authorises only ${contract.approvedDiscountPct}%. No contract amendment exists for the higher rate.`,
        recommendedAction: `Raise a debit note for ${formatINR(estimatedLoss)} covering the unauthorised discount differential and lock the billing profile to the contracted rate.`,
      };
    }

    case "missing_usage_charge": {
      const gaps = usage.filter((u) => u.billableOverage > u.billedOverage);
      gaps.forEach((u) => {
        const units = u.billableOverage - u.billedOverage;
        const delta = units * contract.overageRatePerUnit;
        estimatedLoss += delta;
        calculation.push(
          `${u.periodMonth}: ${units.toLocaleString("en-IN")} units × ₹${contract.overageRatePerUnit} = ${formatINR(delta)}`,
        );
        evidence.push({
          sourceType: "usage",
          sourceId: u.id,
          field: "billed_overage_units",
          expectedValue: `${u.billableOverage} units`,
          actualValue: `${u.billedOverage} units`,
          explanation: `Metered consumption above the ${contract.includedUnits.toLocaleString("en-IN")} included units was never invoiced`,
        });
      });
      return {
        type,
        estimatedLoss,
        evidence,
        calculation,
        detectedIssue: `${gaps.length} billing periods carry metered overage that was never invoiced`,
        rootCause: `Usage records show consumption above the contracted allowance, but the rating job did not push overage lines onto the corresponding invoices.`,
        recommendedAction: `Issue supplementary invoices totalling ${formatINR(estimatedLoss)} for unbilled overage and re-run the rating job for the affected periods.`,
      };
    }

    case "invoice_mismatch": {
      const bad = invoices.filter(
        (i) => Math.abs(i.lines.reduce((a, l) => a + l.amount, 0) - i.totalAmount) > 1,
      );
      bad.forEach((i) => {
        const lineSum = i.lines.reduce((a, l) => a + l.amount, 0);
        const delta = lineSum - i.totalAmount;
        estimatedLoss += delta;
        calculation.push(
          `${i.id}: line items ₹${lineSum.toLocaleString("en-IN")} − invoiced ₹${i.totalAmount.toLocaleString("en-IN")} = ${formatINR(delta)}`,
        );
        evidence.push({
          sourceType: "invoice",
          sourceId: i.id,
          field: "total_amount",
          expectedValue: formatINR(lineSum),
          actualValue: formatINR(i.totalAmount),
          explanation: "Invoice header total does not reconcile with the sum of its line items",
        });
      });
      return {
        type,
        estimatedLoss,
        evidence,
        calculation,
        detectedIssue: `${bad.length} invoices where the header total is below the sum of line items`,
        rootCause:
          "A pro-rata adjustment was applied to the invoice header without a corresponding credit line, so the customer was billed less than the itemised charges.",
        recommendedAction: `Re-issue the affected invoices with the corrected totals and collect the ${formatINR(estimatedLoss)} differential.`,
      };
    }

    case "partial_payment": {
      const bad = invoices.filter((i) => i.status === "partially_paid");
      bad.forEach((i) => {
        const paid = payments.filter((p) => p.invoiceId === i.id).reduce((a, p) => a + p.amount, 0);
        const delta = i.totalAmount - paid;
        estimatedLoss += delta;
        calculation.push(
          `${i.id}: invoiced ₹${i.totalAmount.toLocaleString("en-IN")} − settled ₹${paid.toLocaleString("en-IN")} = ${formatINR(delta)}`,
        );
        evidence.push({
          sourceType: "payment",
          sourceId: payments.find((p) => p.invoiceId === i.id)?.id ?? i.id,
          field: "amount_settled",
          expectedValue: formatINR(i.totalAmount),
          actualValue: formatINR(paid),
          explanation: `Settlement short of the invoiced amount, past ${contract.paymentTermsDays}-day terms`,
        });
      });
      return {
        type,
        estimatedLoss,
        evidence,
        calculation,
        detectedIssue: `${bad.length} invoices were settled short and never followed up`,
        rootCause:
          "Remittances were matched to invoices by reference and auto-closed on partial settlement, so the residual balances dropped out of collections.",
        recommendedAction: `Re-open the short-paid invoices and initiate dunning for ${formatINR(estimatedLoss)}.`,
      };
    }

    case "duplicate_refund": {
      const byRef = new Map<string, Refund[]>();
      refunds.forEach((r) => byRef.set(r.reference, [...(byRef.get(r.reference) ?? []), r]));
      byRef.forEach((group) => {
        if (group.length < 2) return;
        group.slice(1).forEach((dup) => {
          estimatedLoss += dup.amount;
          calculation.push(
            `${dup.id}: duplicate of ${group[0]!.id} on reference ${dup.reference} = ${formatINR(dup.amount)}`,
          );
          evidence.push({
            sourceType: "refund",
            sourceId: dup.id,
            field: "reference",
            expectedValue: "1 refund per reference",
            actualValue: `${group.length} refunds on ${dup.reference}`,
            explanation: `Identical credit re-issued against invoice ${dup.invoiceId}`,
          });
        });
      });
      return {
        type,
        estimatedLoss,
        evidence,
        calculation,
        detectedIssue: "The same service credit was refunded twice under one reference",
        rootCause:
          "The refund workflow has no idempotency check on the credit reference, so a retried approval issued a second payout for the same SLA credit.",
        recommendedAction: `Claw back ${formatINR(estimatedLoss)} against the customer's next invoice and enforce reference-level idempotency on refunds.`,
      };
    }

    case "subscription_usage_mismatch": {
      const bad = usage.filter((u) => u.activeSeats > u.billedSeats);
      bad.forEach((u) => {
        const extra = u.activeSeats - u.billedSeats;
        const delta = extra * subscription.pricePerSeat;
        estimatedLoss += delta;
        calculation.push(
          `${u.periodMonth}: ${extra} unbilled seats × ₹${subscription.pricePerSeat.toLocaleString("en-IN")} = ${formatINR(delta)}`,
        );
        evidence.push({
          sourceType: "usage",
          sourceId: u.id,
          field: "active_seats",
          expectedValue: `${u.billedSeats} seats`,
          actualValue: `${u.activeSeats} seats`,
          explanation: `Provisioned seats exceed the seats billed on subscription ${subscription.id}`,
        });
      });
      return {
        type,
        estimatedLoss,
        evidence,
        calculation,
        detectedIssue: `${bad.length} periods where provisioned seats exceeded billed seats`,
        rootCause:
          "Seats added mid-term through the admin console were provisioned immediately but never synced back to the subscription quantity used for billing.",
        recommendedAction: `Backdate the seat count on subscription ${subscription.id} and invoice ${formatINR(estimatedLoss)} for the unbilled seats.`,
      };
    }

    case "incorrect_pricing": {
      const bad = invoices.filter((i) => i.baseAmount < contract.contractedMonthlyFee);
      bad.forEach((i) => {
        const billedRate = Math.round(i.baseAmount / subscription.seats);
        const delta = (subscription.pricePerSeat - billedRate) * subscription.seats;
        estimatedLoss += delta;
        calculation.push(
          `${i.id}: (₹${subscription.pricePerSeat.toLocaleString("en-IN")} − ₹${billedRate.toLocaleString("en-IN")}) × ${subscription.seats} seats = ${formatINR(delta)}`,
        );
        evidence.push({
          sourceType: "invoice",
          sourceId: i.id,
          field: "price_per_seat",
          expectedValue: `₹${subscription.pricePerSeat.toLocaleString("en-IN")}`,
          actualValue: `₹${billedRate.toLocaleString("en-IN")}`,
          explanation: `Rate billed is below the rate on contract ${contract.id}`,
        });
      });
      return {
        type,
        estimatedLoss,
        evidence,
        calculation,
        detectedIssue: `${bad.length} invoices priced below the contracted seat rate`,
        rootCause:
          "A stale price-book version stayed attached to the account after the annual uplift, so every invoice since then used the previous year's seat rate.",
        recommendedAction: `Correct the price-book assignment and raise a consolidated debit note of ${formatINR(estimatedLoss)} for the under-priced periods.`,
      };
    }

    case "contract_billing_discrepancy": {
      const bad = invoices.filter((i) => i.baseAmount !== contract.contractedMonthlyFee);
      bad.forEach((i) => {
        const delta = contract.contractedMonthlyFee - i.baseAmount;
        estimatedLoss += delta;
        calculation.push(
          `${i.id}: contracted ₹${contract.contractedMonthlyFee.toLocaleString("en-IN")} − billed ₹${i.baseAmount.toLocaleString("en-IN")} = ${formatINR(delta)}`,
        );
        evidence.push({
          sourceType: "invoice",
          sourceId: i.id,
          field: "base_amount",
          expectedValue: formatINR(contract.contractedMonthlyFee),
          actualValue: formatINR(i.baseAmount),
          explanation: `Recurring charge does not match the committed monthly fee on contract ${contract.id}`,
        });
      });
      return {
        type,
        estimatedLoss,
        evidence,
        calculation,
        detectedIssue: `${bad.length} invoices billed below the committed contract value`,
        rootCause:
          "The billing schedule was never updated after the contract renewal raised the committed monthly fee, so invoices continued at the prior commitment.",
        recommendedAction: `Align the billing schedule to contract ${contract.id} and recover ${formatINR(estimatedLoss)} of under-billed commitment.`,
      };
    }
  }
}

export function buildCasesFromRecords(): LeakageCase[] {
  return SCENARIOS.map((s, i) => {
    const contract = DATASET.contracts.find((c) => c.customerId === s.customerId)!;
    const subscription = DATASET.subscriptions.find((x) => x.customerId === s.customerId)!;
    const input: DetectionInput = {
      customerId: s.customerId,
      contract,
      subscription,
      invoices: DATASET.invoices.filter((x) => x.customerId === s.customerId),
      payments: DATASET.payments.filter((x) => x.customerId === s.customerId),
      discounts: DATASET.discounts.filter((x) => x.customerId === s.customerId),
      refunds: DATASET.refunds.filter((x) => x.customerId === s.customerId),
      usage: DATASET.usage.filter((x) => x.customerId === s.customerId),
    };
    const result = calculateLeakage(input, s.type);
    const recoverable = Math.round(result.estimatedLoss * RECOVERY_FACTOR[s.type]);
    const severity = severityFor(result.estimatedLoss);
    const confidence = Math.min(
      0.98,
      0.72 + result.evidence.length * 0.03 + (severity === "critical" ? 0.06 : 0.02),
    );
    const detectedOn = new Date(Date.UTC(2026, 6, 28 - i, 0, 0, 0)).toISOString().slice(0, 10);

    return {
      id: `LC-${2401 + i}`,
      customerId: s.customerId,
      customerName: s.name,
      type: s.type,
      severity,
      confidence: Number(confidence.toFixed(2)),
      detectedOn,
      estimatedLoss: result.estimatedLoss,
      recoverable,
      status: "detected" as const,
      rootCause: result.rootCause,
      recommendedAction: result.recommendedAction,
      evidence: result.evidence,
      calculation: result.calculation,
      riskLevel: severity === "critical" ? "high" : severity === "high" ? "medium" : "low",
    };
  });
}

export { LEAKAGE_LABELS };
