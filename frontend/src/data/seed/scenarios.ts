import type { LeakageType } from "@/domain/types";

export interface ScenarioSpec {
  customerId: string;
  name: string;
  segment: "Enterprise" | "Mid-Market" | "Growth";
  industry: string;
  region: string;
  accountManager: string;
  since: string;
  months: number;
  plan: string;
  seats: number;
  pricePerSeat: number;
  approvedDiscountPct: number;
  includedUnits: number;
  overageRatePerUnit: number;
  paymentTermsDays: number;
  type: LeakageType;
  /** how many recent months carry the flaw */
  affectedMonths: number;
  /** scenario-specific magnitude knobs */
  knob: number;
}

/**
 * Deterministic scenario table. Every leakage amount is *derived* from these
 * records by the detectors — nothing is typed in as a final number.
 */
export const SCENARIOS: ScenarioSpec[] = [
  {
    customerId: "CUST-1001",
    name: "Acme Corp",
    segment: "Enterprise",
    industry: "Manufacturing",
    region: "Maharashtra",
    accountManager: "R. Iyer",
    since: "2021-04-01",
    months: 12,
    plan: "Enterprise Suite",
    seats: 40,
    pricePerSeat: 2500,
    approvedDiscountPct: 10,
    includedUnits: 5000,
    overageRatePerUnit: 40,
    paymentTermsDays: 30,
    type: "unauthorized_discount",
    affectedMonths: 3,
    knob: 30, // applied discount pct
  },
  {
    customerId: "CUST-1002",
    name: "Nimbus Logistics",
    segment: "Enterprise",
    industry: "Logistics",
    region: "Karnataka",
    accountManager: "S. Nair",
    since: "2020-07-01",
    months: 12,
    plan: "Fleet Platform",
    seats: 60,
    pricePerSeat: 3200,
    approvedDiscountPct: 5,
    includedUnits: 4000,
    overageRatePerUnit: 250,
    paymentTermsDays: 45,
    type: "missing_usage_charge",
    affectedMonths: 3,
    knob: 400, // unbilled overage units per affected month
  },
  {
    customerId: "CUST-1003",
    name: "Helios Retail",
    segment: "Mid-Market",
    industry: "Retail",
    region: "Tamil Nadu",
    accountManager: "P. Menon",
    since: "2022-01-15",
    months: 10,
    plan: "Commerce Pro",
    seats: 35,
    pricePerSeat: 2200,
    approvedDiscountPct: 8,
    includedUnits: 3000,
    overageRatePerUnit: 60,
    paymentTermsDays: 30,
    type: "invoice_mismatch",
    affectedMonths: 2,
    knob: 137500, // invoiced total short-fall vs line items
  },
  {
    customerId: "CUST-1004",
    name: "Vertex Pharma",
    segment: "Enterprise",
    industry: "Pharmaceuticals",
    region: "Gujarat",
    accountManager: "A. Deshpande",
    since: "2019-11-01",
    months: 12,
    plan: "Compliance Cloud",
    seats: 80,
    pricePerSeat: 4100,
    approvedDiscountPct: 12,
    includedUnits: 6000,
    overageRatePerUnit: 55,
    paymentTermsDays: 60,
    type: "partial_payment",
    affectedMonths: 2,
    knob: 102500, // shortfall per affected invoice
  },
  {
    customerId: "CUST-1005",
    name: "Orion Media",
    segment: "Mid-Market",
    industry: "Media",
    region: "Delhi NCR",
    accountManager: "K. Bose",
    since: "2021-09-01",
    months: 9,
    plan: "Broadcast Analytics",
    seats: 25,
    pricePerSeat: 3000,
    approvedDiscountPct: 6,
    includedUnits: 2500,
    overageRatePerUnit: 70,
    paymentTermsDays: 30,
    type: "duplicate_refund",
    affectedMonths: 1,
    knob: 220000, // refund amount issued twice
  },
  {
    customerId: "CUST-1006",
    name: "Ganges Freight",
    segment: "Mid-Market",
    industry: "Shipping",
    region: "West Bengal",
    accountManager: "M. Chatterjee",
    since: "2022-05-01",
    months: 8,
    plan: "Freight Ops",
    seats: 40,
    pricePerSeat: 3500,
    approvedDiscountPct: 0,
    includedUnits: 2000,
    overageRatePerUnit: 45,
    paymentTermsDays: 30,
    type: "subscription_usage_mismatch",
    affectedMonths: 4,
    knob: 12, // active seats above the billed seat count
  },
  {
    customerId: "CUST-1007",
    name: "Kaveri Textiles",
    segment: "Growth",
    industry: "Textiles",
    region: "Tamil Nadu",
    accountManager: "V. Raghavan",
    since: "2023-02-01",
    months: 11,
    plan: "Supply Core",
    seats: 30,
    pricePerSeat: 3500,
    approvedDiscountPct: 0,
    includedUnits: 1500,
    overageRatePerUnit: 35,
    paymentTermsDays: 30,
    type: "incorrect_pricing",
    affectedMonths: 8,
    knob: 2800, // rate actually billed per seat
  },
  {
    customerId: "CUST-1008",
    name: "Deccan Analytics",
    segment: "Enterprise",
    industry: "Technology",
    region: "Telangana",
    accountManager: "R. Iyer",
    since: "2020-03-01",
    months: 12,
    plan: "Data Platform",
    seats: 105,
    pricePerSeat: 4000,
    approvedDiscountPct: 0,
    includedUnits: 8000,
    overageRatePerUnit: 30,
    paymentTermsDays: 45,
    type: "contract_billing_discrepancy",
    affectedMonths: 4,
    knob: 355000, // amount actually billed vs contracted monthly fee
  },
  {
    customerId: "CUST-1009",
    name: "Sahyadri Energy",
    segment: "Enterprise",
    industry: "Energy",
    region: "Maharashtra",
    accountManager: "S. Nair",
    since: "2018-06-01",
    months: 12,
    plan: "Grid Insight",
    seats: 50,
    pricePerSeat: 5000,
    approvedDiscountPct: 5,
    includedUnits: 7000,
    overageRatePerUnit: 40,
    paymentTermsDays: 45,
    type: "unauthorized_discount",
    affectedMonths: 2,
    knob: 12,
  },
  {
    customerId: "CUST-1010",
    name: "Bengal Foods",
    segment: "Growth",
    industry: "FMCG",
    region: "West Bengal",
    accountManager: "M. Chatterjee",
    since: "2023-08-01",
    months: 6,
    plan: "Distribution Lite",
    seats: 20,
    pricePerSeat: 1800,
    approvedDiscountPct: 0,
    includedUnits: 1000,
    overageRatePerUnit: 180,
    paymentTermsDays: 15,
    type: "missing_usage_charge",
    affectedMonths: 2,
    knob: 500,
  },
];

export const LEAKAGE_LABELS: Record<LeakageType, string> = {
  unauthorized_discount: "Unauthorized Discount",
  missing_usage_charge: "Missing Usage Charge",
  invoice_mismatch: "Invoice Mismatch",
  partial_payment: "Partial Payment",
  duplicate_refund: "Duplicate Refund",
  subscription_usage_mismatch: "Subscription / Usage Mismatch",
  incorrect_pricing: "Incorrect Pricing",
  contract_billing_discrepancy: "Contract Billing Discrepancy",
};
