import type {
  Contract,
  Customer,
  Discount,
  Invoice,
  Payment,
  Refund,
  Subscription,
  UsageRecord,
} from "@/domain/types";
import { SCENARIOS, type ScenarioSpec } from "./scenarios";

/** Deterministic pseudo-random generator (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fixed "today" so the dataset is fully deterministic. */
export const REFERENCE_DATE = new Date("2026-08-15T00:00:00Z");

function monthKey(offsetFromNewest: number) {
  const d = new Date(REFERENCE_DATE);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - offsetFromNewest);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isoDate(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SeedDataset {
  customers: Customer[];
  contracts: Contract[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  payments: Payment[];
  discounts: Discount[];
  refunds: Refund[];
  usage: UsageRecord[];
}

function buildCustomer(s: ScenarioSpec, contractedMonthlyFee: number): Customer {
  return {
    id: s.customerId,
    name: s.name,
    segment: s.segment,
    industry: s.industry,
    region: s.region,
    accountManager: s.accountManager,
    since: s.since,
    annualContractValue: contractedMonthlyFee * 12,
  };
}

export function generateDataset(): SeedDataset {
  const customers: Customer[] = [];
  const contracts: Contract[] = [];
  const subscriptions: Subscription[] = [];
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const discounts: Discount[] = [];
  const refunds: Refund[] = [];
  const usage: UsageRecord[] = [];

  SCENARIOS.forEach((s, si) => {
    const rand = rng(hashSeed(s.customerId));
    const contractedMonthlyFee = s.seats * s.pricePerSeat;
    const contractId = `C-${101 + si}`;

    customers.push(buildCustomer(s, contractedMonthlyFee));
    contracts.push({
      id: contractId,
      customerId: s.customerId,
      startDate: s.since,
      endDate: `${Number(s.since.slice(0, 4)) + 3}${s.since.slice(4)}`,
      approvedDiscountPct: s.approvedDiscountPct,
      contractedMonthlyFee,
      includedUnits: s.includedUnits,
      overageRatePerUnit: s.overageRatePerUnit,
      paymentTermsDays: s.paymentTermsDays,
      autoRenew: si % 3 !== 0,
    });
    subscriptions.push({
      id: `SUB-${2200 + si}`,
      customerId: s.customerId,
      plan: s.plan,
      seats: s.seats,
      pricePerSeat: s.pricePerSeat,
      billingCycle: "monthly",
      status: "active",
      startedOn: s.since,
    });

    for (let m = s.months - 1; m >= 0; m -= 1) {
      const month = monthKey(m + 1);
      const idx = s.months - m; // 1-based, oldest first
      const isAffected = m < s.affectedMonths;
      const invoiceId = `INV-${8000 + si * 40 + idx}`;

      // ---- usage -------------------------------------------------------
      let unitsConsumed = Math.round(s.includedUnits * (0.6 + rand() * 0.35));
      let billableOverage = 0;
      if (s.type === "missing_usage_charge" && isAffected) {
        billableOverage = s.knob;
        unitsConsumed = s.includedUnits + billableOverage;
      }
      const billedOverage = s.type === "missing_usage_charge" && isAffected ? 0 : billableOverage;
      const activeSeats =
        s.type === "subscription_usage_mismatch" && isAffected ? s.seats + s.knob : s.seats;

      // ---- invoice -----------------------------------------------------
      let billedSeatRate = s.pricePerSeat;
      let billedBase = contractedMonthlyFee;
      if (s.type === "incorrect_pricing" && isAffected) {
        billedSeatRate = s.knob;
        billedBase = s.seats * s.knob;
      }
      if (s.type === "contract_billing_discrepancy" && isAffected) {
        billedBase = s.knob;
      }

      const appliedDiscountPct =
        s.type === "unauthorized_discount" && isAffected ? s.knob : s.approvedDiscountPct;

      const usageAmount = billedOverage * s.overageRatePerUnit;
      const expectedUsageAmount = billableOverage * s.overageRatePerUnit;
      const grossBilled = billedBase + usageAmount;
      const discountAmount = Math.round((grossBilled * appliedDiscountPct) / 100);
      let totalAmount = grossBilled - discountAmount;

      const expectedGross = contractedMonthlyFee + expectedUsageAmount;
      const expectedAmount =
        expectedGross - Math.round((expectedGross * s.approvedDiscountPct) / 100);

      const lines = [
        { description: `${s.plan} — ${s.seats} seats @ ₹${billedSeatRate.toLocaleString("en-IN")}`, amount: billedBase },
        ...(usageAmount > 0
          ? [{ description: `Overage — ${billedOverage} units @ ₹${s.overageRatePerUnit}`, amount: usageAmount }]
          : []),
        ...(discountAmount > 0
          ? [{ description: `Discount (${appliedDiscountPct}%)`, amount: -discountAmount }]
          : []),
      ];

      if (s.type === "invoice_mismatch" && isAffected) {
        totalAmount -= s.knob;
      }

      const issuedOn = isoDate(month, 3);
      const dueOn = addDays(issuedOn, s.paymentTermsDays);

      // ---- payment -----------------------------------------------------
      const shortfall = s.type === "partial_payment" && isAffected ? s.knob : 0;
      const paidAmount = totalAmount - shortfall;
      const isOpen = m === 0 && s.type !== "partial_payment";

      invoices.push({
        id: invoiceId,
        customerId: s.customerId,
        periodMonth: month,
        issuedOn,
        dueOn,
        baseAmount: billedBase,
        usageAmount,
        discountPct: appliedDiscountPct,
        discountAmount,
        totalAmount,
        expectedAmount,
        status: isOpen ? "open" : shortfall > 0 ? "partially_paid" : "paid",
        lines,
      });

      if (!isOpen) {
        payments.push({
          id: `PAY-${5000 + si * 40 + idx}`,
          customerId: s.customerId,
          invoiceId,
          paidOn: addDays(issuedOn, 8 + Math.round(rand() * 12)),
          amount: paidAmount,
          method: (["NEFT", "RTGS", "UPI", "Card"] as const)[Math.floor(rand() * 4) % 4]!,
          status: "settled",
        });
      }

      if (discountAmount > 0) {
        const authorized = appliedDiscountPct <= s.approvedDiscountPct;
        discounts.push({
          id: `DSC-${7000 + si * 40 + idx}`,
          customerId: s.customerId,
          invoiceId,
          appliedOn: issuedOn,
          pct: appliedDiscountPct,
          amount: discountAmount,
          approvedBy: authorized ? "Contract Terms" : "Billing Ops (manual override)",
          authorized,
          reason: authorized ? "Contracted standard discount" : "Retention override — no contract amendment on file",
        });
      }

      usage.push({
        id: `USG-${9000 + si * 40 + idx}`,
        customerId: s.customerId,
        periodMonth: month,
        unitsConsumed,
        includedUnits: s.includedUnits,
        billableOverage,
        billedOverage,
        activeSeats,
        billedSeats: s.seats,
      });

      // ---- refunds ------------------------------------------------------
      if (s.type === "duplicate_refund" && isAffected) {
        const reference = `RF-REF-${si}${idx}`;
        refunds.push({
          id: `REF-${6000 + si * 40 + idx}`,
          customerId: s.customerId,
          invoiceId,
          issuedOn: addDays(issuedOn, 12),
          amount: s.knob,
          reason: "Service credit — outage SLA breach",
          reference,
        });
        refunds.push({
          id: `REF-${6000 + si * 40 + idx + 1}`,
          customerId: s.customerId,
          invoiceId,
          issuedOn: addDays(issuedOn, 19),
          amount: s.knob,
          reason: "Service credit — outage SLA breach",
          reference,
        });
      } else if (rand() > 0.9) {
        refunds.push({
          id: `REF-${6500 + si * 40 + idx}`,
          customerId: s.customerId,
          invoiceId,
          issuedOn: addDays(issuedOn, 14),
          amount: Math.round(totalAmount * 0.02),
          reason: "Goodwill adjustment",
          reference: `RF-GW-${si}${idx}`,
        });
      }
    }
  });

  return { customers, contracts, subscriptions, invoices, payments, discounts, refunds, usage };
}

export const DATASET: SeedDataset = generateDataset();
