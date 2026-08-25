import type {
  CaseStatus,
  InvestigationRecord,
  LeakageCase,
  RecoveryAction,
} from "@/domain/types";
import { buildCasesFromRecords } from "@/services/detectionService";

/** Historic, already-recovered cases — the ₹4.2L baseline on the Recovered KPI. */
const HISTORIC: { caseId: string; customerId: string; customerName: string; amount: number; action: string; approvedBy: string; date: string; type: LeakageCase["type"] }[] = [
  {
    caseId: "LC-2312",
    customerId: "CUST-1004",
    customerName: "Vertex Pharma",
    amount: 180000,
    action: "Debit note raised for under-billed commitment",
    approvedBy: "N. Krishnan (Finance Controller)",
    date: "2026-06-18",
    type: "contract_billing_discrepancy",
  },
  {
    caseId: "LC-2318",
    customerId: "CUST-1008",
    customerName: "Deccan Analytics",
    amount: 140000,
    action: "Supplementary invoice issued for unbilled overage",
    approvedBy: "N. Krishnan (Finance Controller)",
    date: "2026-07-02",
    type: "missing_usage_charge",
  },
  {
    caseId: "LC-2326",
    customerId: "CUST-1003",
    customerName: "Helios Retail",
    amount: 100000,
    action: "Duplicate credit clawed back on next invoice",
    approvedBy: "A. Fernandes (Revenue Ops Lead)",
    date: "2026-07-21",
    type: "duplicate_refund",
  },
];

interface SessionState {
  cases: LeakageCase[];
  investigations: Record<string, InvestigationRecord>;
  recoveries: RecoveryAction[];
}

function initialState(): SessionState {
  const cases = buildCasesFromRecords();
  const historicCases: LeakageCase[] = HISTORIC.map((h) => ({
    id: h.caseId,
    customerId: h.customerId,
    customerName: h.customerName,
    type: h.type,
    severity: "high",
    confidence: 0.94,
    detectedOn: h.date,
    estimatedLoss: h.amount,
    recoverable: h.amount,
    status: "recovered" as CaseStatus,
    rootCause: "Closed in a prior recovery cycle — retained for audit trail.",
    recommendedAction: h.action,
    evidence: [],
    calculation: [],
    riskLevel: "low",
  }));

  const recoveries: RecoveryAction[] = HISTORIC.map((h, i) => ({
    id: `REC-${900 + i}`,
    caseId: h.caseId,
    customerId: h.customerId,
    customerName: h.customerName,
    originalLeakage: h.amount,
    amountRecovered: h.amount,
    actionTaken: h.action,
    approvedBy: h.approvedBy,
    decidedOn: h.date,
    status: "recovered",
    reason: "Approved in prior recovery cycle",
  }));

  return { cases: [...cases, ...historicCases], investigations: {}, recoveries };
}

let state: SessionState = initialState();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const sessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getCases: () => state.cases,
  getCase: (id: string) => state.cases.find((c) => c.id === id),
  getRecoveries: () => state.recoveries,
  getInvestigation: (caseId: string) => state.investigations[caseId],
  setInvestigation(record: InvestigationRecord) {
    state = {
      ...state,
      investigations: { ...state.investigations, [record.caseId]: record },
    };
    emit();
  },
  setCaseStatus(caseId: string, status: CaseStatus) {
    state = {
      ...state,
      cases: state.cases.map((c) => (c.id === caseId ? { ...c, status } : c)),
    };
    emit();
  },
  addRecovery(action: RecoveryAction) {
    state = { ...state, recoveries: [action, ...state.recoveries] };
    emit();
  },
  reset() {
    state = initialState();
    emit();
  },
};
