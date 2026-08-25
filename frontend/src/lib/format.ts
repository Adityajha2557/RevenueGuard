export function formatINR(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${Math.abs(Math.round(amount)).toLocaleString("en-IN")}`;
}

/** Indian short scale: 1,00,000 -> ₹1.0L, 1,00,00,000 -> ₹1.0Cr */
export function formatINRShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs}`;
}

export function formatPct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatMonth(iso: string): string {
  const d = new Date(`${iso}-01T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function clockTime(date = new Date()): string {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}
