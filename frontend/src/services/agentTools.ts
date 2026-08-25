import {
  getContract,
  getCustomer,
  getDiscountHistory,
  getInvoices,
  getPayments,
  getRefundHistory,
  getSubscription,
  getUsage,
} from "@/services/dataService";
import { calculateLeakage, type DetectionInput } from "@/services/detectionService";
import type { LeakageType } from "@/domain/types";

/**
 * Read-only tool registry. The simulated investigation calls exactly these
 * tools; a real Bedrock agent would call the same registry. No tool mutates
 * a financial record — all writes live behind RecoveryService.
 */
export const agentTools = {
  getCustomer,
  getContract,
  getSubscription,
  getInvoices,
  getPayments,
  getDiscountHistory,
  getRefundHistory,
  getUsage,
  calculateLeakage: async (input: DetectionInput, type: LeakageType) => calculateLeakage(input, type),
} as const;

export type AgentToolName = keyof typeof agentTools;

export const TOOL_DESCRIPTIONS: Record<AgentToolName, string> = {
  getCustomer: "Read the customer master record",
  getContract: "Read the signed contract terms",
  getSubscription: "Read the active subscription and seat count",
  getInvoices: "Read the invoice ledger for the customer",
  getPayments: "Read settled and pending payments",
  getDiscountHistory: "Read every discount applied at billing time",
  getRefundHistory: "Read issued credits and refunds",
  getUsage: "Read metered usage and provisioned seats",
  calculateLeakage: "Fold the retrieved records into a leakage figure",
};
