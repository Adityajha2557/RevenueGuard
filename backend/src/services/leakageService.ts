import {
  Contract,
  Invoice,
  Evidence,
} from "../domain/types";

export function calculateDiscountLeakage(
  contract: Contract,
  invoices: Invoice[]
): {
  totalLeakage: number;
  evidence: Evidence[];
} {
  const evidence: Evidence[] = [];

  let totalLeakage = 0;

  for (const invoice of invoices) {
    if (
      invoice.discountPercent >
      contract.approvedDiscountPercent
    ) {
      const excessDiscount =
        invoice.amount *
        (
          (invoice.discountPercent -
            contract.approvedDiscountPercent) /
          100
        );

      totalLeakage += excessDiscount;

      evidence.push({
        sourceType: "invoice",
        sourceId: invoice.id,
        field: "discountPercent",
        expectedValue: `${contract.approvedDiscountPercent}%`,
        actualValue: `${invoice.discountPercent}%`,
        explanation:
          `Applied discount exceeds the ${contract.approvedDiscountPercent}% contract-approved rate.`,
      });
    }
  }

  return {
    totalLeakage,
    evidence,
  };
}