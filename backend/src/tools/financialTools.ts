import {
  Customer,
  Contract,
  Invoice,
  Subscription,
} from "../domain/types";

const customers: Customer[] = [
  {
    id: "CUS-001",
    name: "Acme Corp",
    email: "finance@acme.example",
    industry: "Technology",
  },
  {
    id: "CUS-002",
    name: "Nova Retail",
    email: "finance@nova.example",
    industry: "Retail",
  },
];

const contracts: Contract[] = [
  {
    id: "C-102",
    customerId: "CUS-001",
    monthlyValue: 100000,
    approvedDiscountPercent: 10,
    currency: "INR",
  },
  {
    id: "C-103",
    customerId: "CUS-002",
    monthlyValue: 75000,
    approvedDiscountPercent: 15,
    currency: "INR",
  },
];

const subscriptions: Subscription[] = [
  {
    id: "SUB-001",
    customerId: "CUS-001",
    plan: "Enterprise",
    monthlyPrice: 100000,
    status: "active",
  },
  {
    id: "SUB-002",
    customerId: "CUS-002",
    plan: "Business",
    monthlyPrice: 75000,
    status: "active",
  },
];

const invoices: Invoice[] = [
  {
    id: "INV-8821",
    customerId: "CUS-001",
    date: "2026-06-01",
    amount: 70000,
    discountPercent: 30,
    paidAmount: 70000,
    status: "paid",
  },
  {
    id: "INV-8822",
    customerId: "CUS-001",
    date: "2026-07-01",
    amount: 70000,
    discountPercent: 30,
    paidAmount: 70000,
    status: "paid",
  },
  {
    id: "INV-8823",
    customerId: "CUS-001",
    date: "2026-08-01",
    amount: 70000,
    discountPercent: 30,
    paidAmount: 70000,
    status: "paid",
  },
  {
    id: "INV-9001",
    customerId: "CUS-002",
    date: "2026-08-01",
    amount: 63750,
    discountPercent: 15,
    paidAmount: 63750,
    status: "paid",
  },
];

export const financialTools = {
  getCustomer(customerId: string): Customer | undefined {
    return customers.find((c) => c.id === customerId);
  },

  getContract(customerId: string): Contract | undefined {
    return contracts.find((c) => c.customerId === customerId);
  },

  getSubscription(customerId: string): Subscription | undefined {
    return subscriptions.find((s) => s.customerId === customerId);
  },

  getInvoices(customerId: string): Invoice[] {
    return invoices.filter((i) => i.customerId === customerId);
  },
};