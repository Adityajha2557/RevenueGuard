export type Severity = "low" | "medium" | "high" | "critical";

export type LeakageType =
  | "unauthorized_discount"
  | "missing_usage_charge"
  | "invoice_mismatch"
  | "partial_payment"
  | "duplicate_refund"
  | "subscription_usage_mismatch"
  | "incorrect_pricing"
  | "contract_billing_discrepancy";

export type CaseStatus =
  | "detected"
  | "investigating"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "recovered";

export interface Customer {
  id: string;
  name: string;
  email: string;
  industry: string;
}

export interface Contract {
  id: string;
  customerId: string;
  monthlyValue: number;
  approvedDiscountPercent: number;
  currency: "INR";
}

export interface Subscription {
  id: string;
  customerId: string;
  plan: string;
  monthlyPrice: number;
  status: "active" | "cancelled";
}

export interface Invoice {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  discountPercent: number;
  paidAmount: number;
  status: "paid" | "partial" | "unpaid";
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  date: string;
  status: "success" | "failed" | "partial";
}

export interface Discount {
  id: string;
  customerId: string;
  invoiceId: string;
  percent: number;
  reason: string;
}

export interface Refund {
  id: string;
  customerId: string;
  invoiceId: string;
  amount: number;
  date: string;
}

export interface UsageRecord {
  id: string;
  customerId: string;
  date: string;
  units: number;
  rate: number;
  billedAmount: number;
  expectedAmount: number;
}

export interface Evidence {
  sourceType: string;
  sourceId: string;
  field: string;
  expectedValue: string | number;
  actualValue: string | number;
  explanation: string;
}

export interface LeakageCase {
  id: string;
  customerId: string;
  type: LeakageType;
  estimatedLoss: number;
  recoverable: number;
  severity: Severity;
  detectionConfidence: number;
  status: CaseStatus;
  rootCause: string;
  recommendedAction: string;
  evidence: Evidence[];
}

export interface AgentDecision {
  objective: string;
  selectedTools: string[];
  reasoningSummary: string;
  evidenceIds: string[];
  detectedIssue: string;
  financialImpact: number;
  recommendedAction: string;
  detectionConfidence: number;
  confidenceRationale: string;
}