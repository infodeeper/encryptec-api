const INVOICE_STATUSES = new Set(["pending", "partially_paid", "paid", "overpaid", "expired", "cancelled"]);
const TERMINAL_STATUSES = new Set(["paid", "overpaid", "expired", "cancelled"]);

export function parseTokenAmount(value, { maxDecimals = 6 } = {}) {
  const raw = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) {
    throw new TypeError("Amount must be a positive decimal number.");
  }
  const fraction = raw.split(".")[1] || "";
  if (fraction.length > maxDecimals) {
    throw new RangeError(`Amount supports at most ${maxDecimals} decimal places.`);
  }
  const [whole, decimal = ""] = raw.split(".");
  const normalized = `${whole}.${decimal.padEnd(maxDecimals, "0")}`;
  const units = BigInt(normalized.replace(".", ""));
  if (units <= 0n) throw new RangeError("Amount must be greater than zero.");
  return { raw, units, decimals: maxDecimals };
}

export function compareTokenAmounts(left, right, options) {
  const a = parseTokenAmount(left, options);
  const b = parseTokenAmount(right, options);
  return a.units < b.units ? -1 : a.units > b.units ? 1 : 0;
}

export function classifyInvoicePayment({ expectedAmount, receivedAmount, decimals = 6 }) {
  const comparison = compareTokenAmounts(receivedAmount, expectedAmount, { maxDecimals: decimals });
  if (comparison < 0) return "partially_paid";
  if (comparison > 0) return "overpaid";
  return "paid";
}

export function assertInvoiceStatusTransition(from, to) {
  if (!INVOICE_STATUSES.has(from) || !INVOICE_STATUSES.has(to)) {
    throw new TypeError("Unknown invoice status.");
  }
  if (from === to) return true;
  if (TERMINAL_STATUSES.has(from)) {
    throw new Error(`Invoice status ${from} is terminal.`);
  }
  const allowed = {
    pending: new Set(["partially_paid", "paid", "overpaid", "expired", "cancelled"]),
    partially_paid: new Set(["paid", "overpaid", "expired", "cancelled"])
  };
  if (!allowed[from]?.has(to)) {
    throw new Error(`Invalid invoice status transition: ${from} -> ${to}.`);
  }
  return true;
}

export function buildInvoiceReference({ customerId, planId, billingPeriod }) {
  for (const [key, value] of Object.entries({ customerId, planId, billingPeriod })) {
    if (typeof value !== "string" || !value.trim() || value.length > 128) {
      throw new TypeError(`${key} is required and must be a string of at most 128 characters.`);
    }
  }
  return `${customerId}:${planId}:${billingPeriod}`;
}
