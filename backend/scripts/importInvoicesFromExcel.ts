import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { Invoice } from "../src/domain/types";

const SOURCE_FILE = path.join(__dirname, "..", "source-data", "invoices.xlsx");
const OUTPUT_FILE = path.join(__dirname, "..", "data", "invoices.json");

function mapRow(row: any): Invoice {
  return {
    id: String(row["Invoice ID"]),
    customerId: String(row["Customer ID"]).toUpperCase(),
    date: String(row["Date"]),
    amount: Number(row["Amount"]),
    discountPercent: Number(row["Discount %"]),
    paidAmount: Number(row["Paid Amount"]),
    status: (row["Status"]?.toLowerCase() ?? "paid") as Invoice["status"],
  };
}

function loadExisting(): Invoice[] {
  if (!fs.existsSync(OUTPUT_FILE)) return [];
  const raw = fs.readFileSync(OUTPUT_FILE, "utf-8");
  if (!raw.trim()) return [];
  return JSON.parse(raw) as Invoice[];
}

function upsertById(existing: Invoice[], incoming: Invoice[]): Invoice[] {
  const map = new Map(existing.map((i) => [i.id, i]));
  for (const inv of incoming) {
    map.set(inv.id, inv);
  }
  return [...map.values()];
}

function main() {
  const workbook = XLSX.readFile(SOURCE_FILE);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const newInvoices = rows.map(mapRow);
  const existing = loadExisting();
  const merged = upsertById(existing, newInvoices);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));
  console.log(`Wrote ${merged.length} total invoices (${newInvoices.length} from this file) to ${OUTPUT_FILE}`);
}

main();