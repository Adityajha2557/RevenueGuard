export type LeakageType =
  | "unauthorized_discount"
  | "missing_usage_charge"
  | "invoice_mismatch"
  | "partial_payment"
  | "duplicate_refund"
  | "subscription_usage_mismatch"
  | "incorrect_pricing"
  | "contract_billing_discrepancy";

export type Severity = "critical" | "high" | "medium" | "low";

export type CaseStatus =
  | "detected"
  | "investigating"
  | "investigated"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "recovered";

export interface Customer {
  id: string;
  name: string;
  segment: "Enterprise" | "Mid-Market" | "Growth";
  industry: string;
  region: string;
  accountManager: string;
  since: string;
  annualContractValue: number;
}

export interface Contract {
  id: string;
  customerId: string;
  startDate: string;
  endDate: string;
  approvedDiscountPct: number;
  contractedMonthlyFee: number;
  includedUnits: number;
  overageRatePerUnit: number;
  paymentTermsDays: number;
  autoRenew: boolean;
}

export interface Subscription {
  id: string;
  customerId: string;
  plan: string;
  seats: number;
  pricePerSeat: number;
  billingCycle: "monthly";
  status: "active" | "paused";
  startedOn: string;
}

export interface InvoiceLine {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  periodMonth: string; // YYYY-MM
  issuedOn: string;
  dueOn: string;
  baseAmount: number;
  usageAmount: number;
  discountPct: number;
  discountAmount: number;
  totalAmount: number;
  expectedAmount: number;
  status: "paid" | "partially_paid" | "open";
  lines: InvoiceLine[];
}

export interface Payment {
  id: string;
  customerId: string;
  invoiceId: string;
  paidOn: string;
  amount: number;
  method: "NEFT" | "RTGS" | "UPI" | "Card";
  status: "settled" | "pending";
}

export interface Discount {
  id: string;
  customerId: string;
  invoiceId: string;
  appliedOn: string;
  pct: number;
  amount: number;
  approvedBy: string;
  authorized: boolean;
  reason: string;
}

export interface Refund {
  id: string;
  customerId: string;
  invoiceId: string;
  issuedOn: string;
  amount: number;
  reason: string;
  reference: string;
}

export interface UsageRecord {
  id: string;
  customerId: string;
  periodMonth: string;
  unitsConsumed: number;
  includedUnits: number;
  billableOverage: number;
  billedOverage: number;
  activeSeats: number;
  billedSeats: number;
}

export interface Evidence {
  sourceType: "contract" | "subscription" | "invoice" | "payment" | "discount" | "refund" | "usage";
  sourceId: string;
  field: string;
  expectedValue: string;
  actualValue: string;
  explanation: string;
}

export interface AgentDecision {
  objective: string;
  selectedTools: string[];
  reasoningSummary: string;
  evidenceIds: string[];
  detectedIssue: string;
  financialImpact: {
    estimatedLoss: number;
    recoverable: number;
    calculation: string[];
  };
  recommendedAction: string;
  detectionConfidence: number;
  confidenceRationale: string;
}

export interface LeakageCase {
  id: string;
  customerId: string;
  customerName: string;
  type: LeakageType;
  severity: Severity;
  confidence: number;
  detectedOn: string;
  estimatedLoss: number;
  recoverable: number;
  status: CaseStatus;
  rootCause: string;
  recommendedAction: string;
  evidence: Evidence[];
  calculation: string[];
  riskLevel: "low" | "medium" | "high";
}

export type StepStatus = "pending" | "running" | "done" | "warning";

export interface InvestigationStep {
  id: string;
  index: number;
  label: string;
  tool?: string | undefined;
  detail: string;
  status: StepStatus;
  latencyMs: number;
}

export interface AgentLogEntry {
  time: string;
  glyph: "ok" | "warn" | "info";
  message: string;
}

export interface InvestigationRecord {
  caseId: string;
  completedOn: string;
  steps: InvestigationStep[];
  logs: AgentLogEntry[];
  decision: AgentDecision;
}

export interface RecoveryAction {
  id: string;
  caseId: string;
  customerId: string;
  customerName: string;
  originalLeakage: number;
  amountRecovered: number;
  actionTaken: string;
  approvedBy: string;
  decidedOn: string;
  status: "recovered" | "rejected";
  reason: string;
}

export interface DashboardMetrics {
  revenueAtRisk: number;
  recoverable: number;
  recovered: number;
  activeCases: number;
  criticalCases: number;
  recoveryRate: number;
  trend: { month: string; atRisk: number; recovered: number }[];
  byCategory: { type: LeakageType; label: string; amount: number; count: number }[];
  topCustomers: { customerId: string; name: string; amount: number; cases: number }[];
}
