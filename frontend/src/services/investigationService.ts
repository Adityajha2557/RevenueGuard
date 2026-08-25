import type {
  AgentDecision,
  AgentLogEntry,
  InvestigationRecord,
  InvestigationStep,
  StepStatus,
} from "@/domain/types";
import { agentTools } from "@/services/agentTools";
import { LEAKAGE_LABELS } from "@/data/seed/scenarios";
import { sessionStore } from "@/store/sessionStore";
import { clockTime, formatINR } from "@/lib/format";

export interface RunOptions {
  onStep?: (step: InvestigationStep) => void;
  onLog?: (entry: AgentLogEntry) => void;
  speed?: number;
}

const STEP_PLAN: { label: string; tool?: string }[] = [
  { label: "Anomaly detected" },
  { label: "Contract retrieved", tool: "getContract" },
  { label: "Subscription checked", tool: "getSubscription" },
  { label: "Invoices retrieved", tool: "getInvoices" },
  { label: "Discount history reviewed", tool: "getDiscountHistory" },
  { label: "Payments reconciled", tool: "getPayments" },
  { label: "Usage analysed", tool: "getUsage" },
  { label: "Discrepancy identified" },
  { label: "Leakage calculated", tool: "calculateLeakage" },
  { label: "Root cause determined" },
  { label: "Recommendation prepared" },
];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Simulated investigation. It drives a fixed 11-step demo sequence but calls
 * the same read-only tool registry a real agent would use, and resolves to a
 * single AgentDecision — the only thing the UI renders.
 */
export async function runInvestigation(
  caseId: string,
  options: RunOptions = {},
): Promise<InvestigationRecord> {
  const { onStep, onLog, speed = 1 } = options;
  const leakageCase = sessionStore.getCase(caseId);
  if (!leakageCase) throw new Error(`Case ${caseId} not found`);

  const steps: InvestigationStep[] = [];
  const logs: AgentLogEntry[] = [];

  const log = (glyph: AgentLogEntry["glyph"], message: string) => {
    const entry: AgentLogEntry = { time: clockTime(), glyph, message };
    logs.push(entry);
    onLog?.(entry);
  };

  const emit = (step: InvestigationStep) => {
    const existing = steps.findIndex((s) => s.id === step.id);
    if (existing >= 0) steps[existing] = step;
    else steps.push(step);
    onStep?.({ ...step });
  };

  const customerId = leakageCase.customerId;
  sessionStore.setCaseStatus(caseId, "investigating");

  log("info", `Investigation started for case ${caseId} (${leakageCase.customerName})`);

  const selectedTools: string[] = [];

  for (let i = 0; i < STEP_PLAN.length; i += 1) {
    const plan = STEP_PLAN[i]!;
    const id = `${caseId}-S${i + 1}`;
    const started = performance.now();
    emit({
      id,
      index: i + 1,
      label: plan.label,
      tool: plan.tool,
      detail: plan.tool ? `Calling ${plan.tool}()` : "Reasoning…",
      status: "running",
      latencyMs: 0,
    });

    await wait((160 + Math.round(Math.random() * 240)) / speed);

    let detail = "";
    let status: StepStatus = "done";

    switch (plan.tool) {
      case "getContract": {
        const contract = await agentTools.getContract(customerId);
        detail = `Contract ${contract?.id} — approved discount ${contract?.approvedDiscountPct}%, committed ${formatINR(contract?.contractedMonthlyFee ?? 0)}/mo`;
        log("ok", `Retrieved contract ${contract?.id}`);
        break;
      }
      case "getSubscription": {
        const sub = await agentTools.getSubscription(customerId);
        detail = `${sub?.plan} — ${sub?.seats} seats @ ${formatINR(sub?.pricePerSeat ?? 0)}`;
        log("ok", `Retrieved subscription ${sub?.id}`);
        break;
      }
      case "getInvoices": {
        const invoices = await agentTools.getInvoices(customerId);
        detail = `${invoices.length} invoices spanning ${invoices[0]?.periodMonth} → ${invoices[invoices.length - 1]?.periodMonth}`;
        log("ok", `Retrieved ${invoices.length} invoices`);
        break;
      }
      case "getDiscountHistory": {
        const discounts = await agentTools.getDiscountHistory(customerId);
        const unauth = discounts.filter((d) => !d.authorized).length;
        detail = `${discounts.length} discount records, ${unauth} without contract authority`;
        if (unauth > 0) {
          status = "warning";
          log("warn", `Discount discrepancy detected on ${unauth} invoices`);
        } else {
          log("ok", `Retrieved ${discounts.length} discount records`);
        }
        break;
      }
      case "getPayments": {
        const payments = await agentTools.getPayments(customerId);
        const settled = payments.reduce((a, p) => a + p.amount, 0);
        detail = `${payments.length} payments, ${formatINR(settled)} settled`;
        log("ok", `Reconciled ${payments.length} payments`);
        break;
      }
      case "getUsage": {
        const usage = await agentTools.getUsage(customerId);
        const gaps = usage.filter((u) => u.billableOverage > u.billedOverage).length;
        detail = `${usage.length} usage periods, ${gaps} with unbilled overage`;
        if (gaps > 0) {
          status = "warning";
          log("warn", `${gaps} usage periods carry unbilled overage`);
        } else {
          log("ok", `Analysed ${usage.length} usage periods`);
        }
        break;
      }
      case "calculateLeakage": {
        const refunds = await agentTools.getRefundHistory(customerId);
        detail = `Leakage computed from ${leakageCase.evidence.length} evidence records → ${formatINR(leakageCase.estimatedLoss)}`;
        log("ok", `${formatINR(leakageCase.estimatedLoss)} potential leakage identified`);
        break;
      }
      default: {
        if (i === 0) {
          const customer = await agentTools.getCustomer(customerId);
          detail = `${LEAKAGE_LABELS[leakageCase.type]} flagged on ${customer?.name}`;
          status = "warning";
          log("warn", `Anomaly flagged: ${LEAKAGE_LABELS[leakageCase.type]}`);
        } else if (plan.label === "Discrepancy identified") {
          detail = leakageCase.evidence[0]
            ? `${leakageCase.evidence[0].field}: expected ${leakageCase.evidence[0].expectedValue}, found ${leakageCase.evidence[0].actualValue}`
            : "Records contradict the contracted terms";
          status = "warning";
          log("warn", detail);
        } else if (plan.label === "Root cause determined") {
          detail = leakageCase.rootCause;
          log("ok", "Root cause determined");
        } else {
          detail = leakageCase.recommendedAction;
          log("ok", "Recommendation prepared");
        }
      }
    }

    if (plan.tool) selectedTools.push(plan.tool);

    emit({
      id,
      index: i + 1,
      label: plan.label,
      tool: plan.tool,
      detail,
      status,
      latencyMs: Math.round(performance.now() - started),
    });
  }

  const decision: AgentDecision = {
    objective: `Determine whether ${leakageCase.customerName} has revenue leakage of type "${LEAKAGE_LABELS[leakageCase.type]}" and quantify the recoverable amount.`,
    selectedTools: ["getCustomer", ...selectedTools],
    reasoningSummary: `Contract terms were compared against the billing ledger for ${leakageCase.customerName}. ${leakageCase.evidence.length} records contradict the agreed terms; each discrepancy was priced from the underlying invoice, usage and payment records and summed to the total impact.`,
    evidenceIds: leakageCase.evidence.map((e) => e.sourceId),
    detectedIssue: leakageCase.rootCause,
    financialImpact: {
      estimatedLoss: leakageCase.estimatedLoss,
      recoverable: leakageCase.recoverable,
      calculation: [
        ...leakageCase.calculation,
        `Total estimated loss = ${formatINR(leakageCase.estimatedLoss)}`,
        `Recoverable (net of dispute and collection risk) = ${formatINR(leakageCase.recoverable)}`,
      ],
    },
    recommendedAction: leakageCase.recommendedAction,
    detectionConfidence: leakageCase.confidence,
    confidenceRationale:
      leakageCase.evidence.length > 3
        ? "Multiple independent source records directly contradict the contract; the discrepancy is deterministic, not inferred."
        : "Contract and billing records directly contradict each other, though the affected period count is small.",
  };

  const record: InvestigationRecord = {
    caseId,
    completedOn: new Date().toISOString(),
    steps,
    logs,
    decision,
  };

  sessionStore.setInvestigation(record);
  sessionStore.setCaseStatus(caseId, "investigated");
  log("ok", "Investigation complete — ready for human approval");

  return record;
}

export async function sendToApproval(caseId: string): Promise<void> {
  await wait(220);
  sessionStore.setCaseStatus(caseId, "pending_approval");
}

export async function getInvestigation(caseId: string): Promise<InvestigationRecord | undefined> {
  await wait(120);
  return sessionStore.getInvestigation(caseId);
}
