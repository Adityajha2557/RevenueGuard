import { GoogleGenAI } from "@google/genai";
import { AgentDecision } from "../domain/types";
import { financialTools } from "../tools/financialTools";
import { calculateDiscountLeakage } from "../services/leakageService";

let ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return ai;
}

// Models to race in parallel. First one to succeed wins.
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
];

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    objective: { type: "string" },
    selectedTools: { type: "array", items: { type: "string" } },
    reasoningSummary: { type: "string" },
    evidenceIds: { type: "array", items: { type: "string" } },
    detectedIssue: { type: "string" },
    financialImpact: { type: "number" },
    recommendedAction: { type: "string" },
    detectionConfidence: { type: "number" },
    confidenceRationale: { type: "string" },
  },
  required: [
    "objective",
    "selectedTools",
    "reasoningSummary",
    "evidenceIds",
    "detectedIssue",
    "financialImpact",
    "recommendedAction",
    "detectionConfidence",
    "confidenceRationale",
  ],
} as const;

/**
 * Fires the same prompt at several models in parallel and returns
 * whichever one succeeds first. Only throws if every model fails.
 */
async function generateWithFallback(prompt: string): Promise<string> {
  const attempts = CANDIDATE_MODELS.map(async (model) => {
    const response = await getClient().models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    if (!response.text) {
      throw new Error(`Model ${model} returned an empty response`);
    }

    console.log(`Gemini call succeeded using model: ${model}`);
    return response.text;
  });

  try {
    return await Promise.any(attempts);
  } catch (aggregateError) {
    const details =
      aggregateError instanceof AggregateError
        ? aggregateError.errors.map((e) => e?.message || String(e)).join(" | ")
        : String(aggregateError);
    throw new Error(`All Gemini models failed: ${details}`);
  }
}

export async function runMockAgent(
  customerId: string
): Promise<AgentDecision> {
  const selectedTools: string[] = [];

  // 1. Gather facts using our deterministic financial tools
  selectedTools.push("getCustomer");
  const customer = financialTools.getCustomer(customerId);

  selectedTools.push("getContract");
  const contract = financialTools.getContract(customerId);

  selectedTools.push("getInvoices");
  const invoices = financialTools.getInvoices(customerId);

  if (!customer || !contract) {
    throw new Error("Customer or contract not found");
  }

  // 2. Calculate financial impact deterministically
  const result = calculateDiscountLeakage(contract, invoices);

  selectedTools.push("calculateLeakage");

  const evidenceIds = result.evidence.map(
    (e) => `${e.sourceType}:${e.sourceId}`
  );

  // 3. Give the REAL financial evidence to Gemini
  const investigationData = {
    customer,
    contract,
    invoices,
    leakageCalculation: result,
    evidenceIds,
  };

  const prompt = `
You are the RevenueGuard AI financial investigation agent.

Your job is to analyze financial records and identify revenue leakage.

IMPORTANT RULES:
- Use ONLY the evidence provided below.
- Do NOT invent financial facts.
- Do NOT change the calculated financial impact.
- The financial impact calculated by the application is authoritative.
- Explain the discrepancy clearly.
- Base confidence on the strength of the evidence.
- Return ONLY valid JSON matching the requested structure.

Customer ID:
${customerId}

Financial investigation data:
${JSON.stringify(investigationData, null, 2)}

Return an investigation decision with:
- objective
- selectedTools
- reasoningSummary
- evidenceIds
- detectedIssue
- financialImpact
- recommendedAction
- detectionConfidence
- confidenceRationale
`;

  // 4. Ask Gemini (racing multiple models in parallel) to reason over the evidence
  const responseText = await generateWithFallback(prompt);

  const aiDecision = JSON.parse(responseText) as AgentDecision;

  // 5. Protect the financial calculation from LLM hallucination
  aiDecision.financialImpact = result.totalLeakage;
  aiDecision.selectedTools = selectedTools;
  aiDecision.evidenceIds = evidenceIds;

  return aiDecision;
}