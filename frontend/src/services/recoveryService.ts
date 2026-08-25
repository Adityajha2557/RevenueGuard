import type { LeakageCase, RecoveryAction } from "@/domain/types";
import { sessionStore } from "@/store/sessionStore";

const wait = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));

const APPROVER = "You (Finance Approver)";

/**
 * The only write surface in the app. The read-only agent tool layer cannot
 * reach it — every mutation here requires an explicit human decision.
 */
export async function approveRecovery(caseId: string, reason: string): Promise<RecoveryAction> {
  await wait();
  const leakageCase = sessionStore.getCase(caseId);
  if (!leakageCase) throw new Error(`Case ${caseId} not found`);

  const action: RecoveryAction = {
    id: `REC-${1000 + sessionStore.getRecoveries().length}`,
    caseId,
    customerId: leakageCase.customerId,
    customerName: leakageCase.customerName,
    originalLeakage: leakageCase.estimatedLoss,
    amountRecovered: leakageCase.recoverable,
    actionTaken: leakageCase.recommendedAction,
    approvedBy: APPROVER,
    decidedOn: new Date().toISOString().slice(0, 10),
    status: "recovered",
    reason: reason || "Approved — evidence supports recovery",
  };

  sessionStore.addRecovery(action);
  sessionStore.setCaseStatus(caseId, "recovered");
  return action;
}

export async function rejectRecovery(caseId: string, reason: string): Promise<RecoveryAction> {
  await wait();
  const leakageCase = sessionStore.getCase(caseId);
  if (!leakageCase) throw new Error(`Case ${caseId} not found`);

  const action: RecoveryAction = {
    id: `REC-${1000 + sessionStore.getRecoveries().length}`,
    caseId,
    customerId: leakageCase.customerId,
    customerName: leakageCase.customerName,
    originalLeakage: leakageCase.estimatedLoss,
    amountRecovered: 0,
    actionTaken: "No recovery — rejected by finance",
    approvedBy: APPROVER,
    decidedOn: new Date().toISOString().slice(0, 10),
    status: "rejected",
    reason: reason || "Rejected by finance approver",
  };

  sessionStore.addRecovery(action);
  sessionStore.setCaseStatus(caseId, "rejected");
  return action;
}

export async function getRecoveryHistory(): Promise<RecoveryAction[]> {
  await wait(180);
  return sessionStore.getRecoveries();
}

export async function getApprovalQueue(): Promise<LeakageCase[]> {
  await wait(180);
  return sessionStore.getCases().filter((c) => c.status === "pending_approval");
}
