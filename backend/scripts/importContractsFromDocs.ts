import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { Contract, Customer } from "../src/domain/types";

dotenv.config();

const SOURCE_DIR = path.join(__dirname, "..", "source-data", "contracts");
const CONTRACTS_FILE = path.join(__dirname, "..", "data", "contracts.json");
const CUSTOMERS_FILE = path.join(__dirname, "..", "data", "customers.json");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
];

// Extraction result includes customerName temporarily, used to build
// the Customer record. It is NOT part of the final Contract shape.
interface ExtractedContract extends Contract {
  customerName: string;
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }
  if (ext === ".docx") {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

async function generateWithFallback(prompt: string): Promise<string> {
  const attempts = CANDIDATE_MODELS.map(async (model) => {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    if (!response.text) {
      throw new Error(`Model ${model} returned an empty response`);
    }
    console.log(`  (used model: ${model})`);
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

async function extractContractFields(
  text: string,
  fileName: string
): Promise<ExtractedContract> {
  const prompt = `
You are extracting structured contract data from raw text.

Extract exactly these fields as JSON:
- id: a contract ID if mentioned, otherwise generate one like "C-<random 3 digits>"
- customerId: the customer ID if mentioned (format like "CUS-XXX"). ALWAYS return it fully uppercase, e.g. "CUS-005" not "cus-005". If no ID is mentioned, generate one like "CUS-<random 3 digits>".
- customerName: the customer's company/legal name as written in the document
- monthlyValue: the monthly contract value as a plain number (no currency symbols, no commas)
- approvedDiscountPercent: the approved/authorized discount percentage as a number. If multiple discount rates are mentioned (e.g. a superseded promotional rate vs the current approved rate), use ONLY the current/standing approved rate, not historical or promotional ones.
- currency: the ISO currency code, e.g. "INR" or "USD". Infer from context if not explicit; default "INR" only if truly unclear.

Return ONLY valid JSON matching this exact shape, nothing else:
{"id": string, "customerId": string, "customerName": string, "monthlyValue": number, "approvedDiscountPercent": number, "currency": string}

Document filename: ${fileName}

Document text:
${text}
`;

  const responseText = await generateWithFallback(prompt);
  const parsed = JSON.parse(responseText) as ExtractedContract;

  // Belt-and-suspenders normalization in case the model doesn't uppercase it
  parsed.customerId = parsed.customerId.toUpperCase();

  return parsed;
}

function loadJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];
  return JSON.parse(raw) as T[];
}

function upsertById<T extends { id: string }>(existing: T[], incoming: T): T[] {
  const idx = existing.findIndex((e) => e.id === incoming.id);
  if (idx >= 0) {
    existing[idx] = incoming;
  } else {
    existing.push(incoming);
  }
  return existing;
}

async function main() {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".pdf") || f.endsWith(".docx"));

  // Load existing data so re-running doesn't wipe out previously imported contracts/customers
  let contracts: Contract[] = loadJsonArray<Contract>(CONTRACTS_FILE);
  let customers: Customer[] = loadJsonArray<Customer>(CUSTOMERS_FILE);

  for (const file of files) {
    const filePath = path.join(SOURCE_DIR, file);
    console.log(`Processing ${file}...`);
    try {
      const text = await extractText(filePath);
      const extracted = await extractContractFields(text, file);

      const { customerName, ...contract } = extracted;

      contracts = upsertById(contracts, contract);

      // Auto-create or update the matching customer record
      const customer: Customer = {
        id: contract.customerId,
        name: customerName,
        email: customers.find((c) => c.id === contract.customerId)?.email
          ?? `finance@${customerName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
        industry: customers.find((c) => c.id === contract.customerId)?.industry
          ?? "Unknown",
      };
      customers = upsertById(customers, customer);

      console.log(
        `  -> Extracted contract ${contract.id} for ${contract.customerId} (${customerName})`
      );
    } catch (err) {
      console.error(`  FAILED on ${file}:`, err);
    }
  }

  fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(contracts, null, 2));
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
  console.log(`\nWrote ${contracts.length} contracts to ${CONTRACTS_FILE}`);
  console.log(`Wrote ${customers.length} customers to ${CUSTOMERS_FILE}`);
}

main();