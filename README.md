# RevenueGuard AI

**AI-powered revenue leakage investigation.** RevenueGuard cross-references contract terms against real invoices to detect unauthorized discounts and billing discrepancies — combining deterministic financial calculations with LLM-generated reasoning (Google Gemini).

> Financial impact numbers are **always calculated in code**, never by the LLM. Gemini explains *why* leakage exists; it never decides *how much*.

---

## ✨ What it does

1. Ingests customer contracts (PDF/Word) and invoices (Excel) — including unstructured documents
2. Extracts structured contract terms (approved discount %, monthly value) from prose using Gemini
3. Deterministically calculates actual vs. approved billing discrepancies in code
4. Sends the real evidence to Gemini, which produces a structured investigation report: objective, reasoning, root cause, recommended action, and confidence — all constrained to the evidence provided
5. Displays results in a live dashboard

---

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│   Frontend        │    │   Backend (Express)       │   Google Gemini   │
│                    │      │                        │      │                    │
│  React/TanStack    │─────▶│  POST /api/investigate│─────▶│  gemini-3.7-flash  │
│  or                │      │                        │      │  (+ 2 fallback     │
│  Streamlit          │      │  1. financialTools.ts  │      │   models raced      │
│  dashboard          │◀─────│     (deterministic)    │◀─────│   in parallel)      │
│                    │      │  2. leakageService.ts  │      │                    │
│                    │      │     (leakage math)     │      │                    │
│                    │      │  3. mockAgent.ts        │      │                    │
│                    │      │     (LLM orchestration) │      │                    │
└─────────────────┘      └──────────────────────┘      └─────────────────┘
                                      │
                                      ▼
                          ┌────────────────────┐
                          │  data/*.json          │
                          │  customers, contracts, │
                          │  invoices               │
                          └────────────────────┘
                                      ▲
                                      │
                          ┌────────────────────┐
                          │  scripts/               │
                          │  importInvoicesFromExcel│
                          │  importContractsFromDocs│
                          │  (PDF/Word → JSON via   │
                          │   Gemini extraction)     │
                          └────────────────────┘
```

**Key design decision:** the LLM never touches raw financial calculation. `financialTools.ts` and `leakageService.ts` compute the actual leakage amount deterministically from real invoice/contract data; the AI layer only reasons over and explains evidence it's handed. The `financialImpact` field returned to the client is always overwritten with the code-calculated value after the LLM responds, protecting against hallucinated numbers.

---

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express, TypeScript, `tsx` |
| AI | Google Gemini API (`@google/genai`), structured JSON output via `responseSchema` |
| Frontend (option A) | React, TanStack Router/Query, Tailwind, shadcn/ui |
| Frontend (option B) | Python, Streamlit |
| Document parsing | `xlsx` (Excel), `mammoth` (Word), `pdf-parse` (PDF) |
| Validation | Zod |

---

## 📁 Project Structure

```
RevenueGuard/
├── backend/
│   ├── src/
│   │   ├── agent/mockAgent.ts        # Gemini orchestration + multi-model fallback
│   │   ├── domain/types.ts            # Shared TypeScript types
│   │   ├── services/leakageService.ts # Deterministic leakage calculation
│   │   ├── tools/financialTools.ts    # Data access layer (reads data/*.json)
│   │   └── server.ts                  # Express app, /api/investigate route
│   ├── scripts/
│   │   ├── importInvoicesFromExcel.ts # Excel → data/invoices.json
│   │   └── importContractsFromDocs.ts # PDF/Word → data/contracts.json + customers.json (via Gemini)
│   ├── source-data/                   # Drop raw Excel/PDF/Word files here
│   │   └── contracts/
│   ├── data/                          # Generated structured JSON (customers, contracts, invoices)
│   └── .env                           # GEMINI_API_KEY, GEMINI_MODEL, PORT
├── frontend/                          # React/TanStack app
└── dashboard/                         # Streamlit dashboard (app.py)
```

---

## 🚀 Setup

### Prerequisites
- Node.js (v18+)
- Python 3.9+ (only if using the Streamlit dashboard)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.7-flash
PORT=3001
```

Run it:
```bash
npm run dev
```
Backend now live at `http://localhost:3001`.

### 2. Load your data

Drop files into `backend/source-data/`:
- `invoices.xlsx` — columns: `Invoice ID`, `Customer ID`, `Date`, `Amount`, `Discount %`, `Paid Amount`, `Status`
- `contracts/*.pdf` or `*.docx` — any prose contract mentioning customer name/ID, monthly value, and approved discount %

Run the importers:
```bash
npx tsx scripts/importInvoicesFromExcel.ts
npx tsx scripts/importContractsFromDocs.ts
```

This populates `data/customers.json`, `data/contracts.json`, and `data/invoices.json`. Contract import auto-creates matching customer records — no manual JSON editing required. Re-running is safe; both scripts upsert rather than overwrite.

Restart the backend after importing so it picks up the new data.

### 3a. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

### 3b. Frontend (Streamlit dashboard — alternative)

```bash
cd dashboard
pip install -r requirements.txt
streamlit run app.py
```
Opens at `http://localhost:8501`. Requires the backend running on port 3001.

---

## 📡 API

### `POST /api/investigate`

**Request:**
```json
{ "customerId": "CUS-001" }
```

**Response:**
```json
{
  "objective": "Investigate potential revenue leakage for customer CUS-001...",
  "selectedTools": ["getCustomer", "getContract", "getInvoices", "calculateLeakage"],
  "reasoningSummary": "Contract C-102 specifies an approved discount rate of 10%...",
  "evidenceIds": ["invoice:INV-8821", "invoice:INV-8822", "invoice:INV-8823"],
  "detectedIssue": "Unauthorized discount applied on invoices exceeding contract terms...",
  "financialImpact": 42000,
  "recommendedAction": "Issue debit notes or supplementary invoices totaling 42,000 INR...",
  "detectionConfidence": 1,
  "confidenceRationale": "High certainty based on direct match and mathematical discrepancy..."
}
```

### `GET /api/health`
Basic liveness check.

---

## 🛡️ Reliability

- **Multi-model fallback:** every Gemini call races 3 model variants in parallel (`Promise.any`); the fastest successful response wins. If one model is overloaded (503), another usually isn't.
- **Hallucination protection:** `financialImpact`, `selectedTools`, and `evidenceIds` in the LLM's response are always overwritten with code-calculated values before being returned to the client.
- **Graceful data-gap handling:** investigating a customer with no contract or invoice data returns a clean error rather than crashing.

---
RevenueGuard AI — Full Dependency List
========================================

This is a reference list of everything the project uses. It's documentation,
not an installer — run install.ps1 (Windows) to actually install these,
or use the commands below manually.

--------------------------------------------------
BACKEND (Node.js / npm) — run inside backend/
--------------------------------------------------
Install command:
    npm install

Runtime dependencies:
    @google/genai       — Gemini API SDK
    express              — web server
    cors                 — cross-origin request handling
    dotenv               — loads .env into process.env
    xlsx                 — Excel file parsing (invoice import)
    mammoth              — Word (.docx) text extraction (contract import)
    pdf-parse            — PDF text extraction (contract import)
    zod                  — schema validation

Dev dependencies:
    typescript
    tsx                  — run TypeScript directly without a build step
    @types/node
    @types/express
    @types/cors

--------------------------------------------------
FRONTEND — React/TanStack (Node.js / npm) — run inside frontend/
--------------------------------------------------
Install command:
    npm install

(Uses the project's own package.json — Vite, TanStack Router/Query,
Tailwind, shadcn/ui, lucide-react, sonner, etc. Already defined in
frontend/package.json from the original scaffold.)

--------------------------------------------------
DASHBOARD — Streamlit (Python / pip) — run inside dashboard/
--------------------------------------------------
Install command:
    pip install -r requirements.txt

Dependencies:
    streamlit  >=1.38    — dashboard framework
    requests   >=2.31    — HTTP calls to the backend API

--------------------------------------------------
ENVIRONMENT VARIABLES (backend/.env — not installed, must be created manually)
--------------------------------------------------
GEMINI_API_KEY   — your Gemini API key from https://aistudio.google.com/apikey
GEMINI_MODEL     — e.g. gemini-3.7-flash
PORT             — e.g. 3001

--------------------------------------------------
PREREQUISITES (installed separately, not via npm/pip)
--------------------------------------------------
Node.js  v18 or newer   — https://nodejs.org
Python   3.9 or newer   — https://python.org (only needed for the dashboard)
## 🧪 Testing edge cases

The import pipeline has been stress-tested against:
- Discounts exactly at the approved limit (should not flag)
- Discounts slightly over the limit (sensitivity check)
- Non-INR currency contracts (USD)
- Contracts with no explicit contract ID (auto-generated fallback)
- Contracts with multiple/superseded discount rates in the same document (extraction correctly picks the current rate, ignoring historical/promotional ones)
- Partial and unpaid invoice statuses
- Customer IDs with inconsistent casing (normalized to uppercase throughout)

---

## 📌 Known limitations

- Contract extraction from PDF/Word relies on LLM reading of prose — always spot-check `data/contracts.json` against source documents before trusting it in production
- Gemini free-tier quota can throttle under load; the multi-model fallback mitigates but doesn't eliminate this
- Customer/contract/invoice matching is by exact ID string — no fuzzy matching

---

## 📄 License

All rights belong to the owner of this repo

---

## 🙋 Author

Built by [Aditya Jha](https://github.com/Adityajha2557) — [RevenueGuard on GitHub](https://github.com/Adityajha2557/RevenueGuard)
