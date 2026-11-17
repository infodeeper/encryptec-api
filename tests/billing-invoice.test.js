import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTokenAmount,
  compareTokenAmounts,
  classifyInvoicePayment,
  assertInvoiceStatusTransition,
  buildInvoiceReference
} from "../api/_lib/billing/invoice-domain.js";

test("parses stablecoin amounts without floating point arithmetic", () => {
  assert.equal(parseTokenAmount("49.00").units, 49000000n);
  assert.equal(compareTokenAmounts("49.000001", "49", { maxDecimals: 6 }), 1);
  assert.throws(() => parseTokenAmount("49.0000001"), /at most 6/);
  assert.throws(() => parseTokenAmount("1e3"), /decimal number/);
  assert.throws(() => parseTokenAmount("0"), /greater than zero/);
});

test("classifies underpayment, exact payment and overpayment", () => {
  assert.equal(classifyInvoicePayment({ expectedAmount: "49", receivedAmount: "48.99" }), "partially_paid");
  assert.equal(classifyInvoicePayment({ expectedAmount: "49", receivedAmount: "49.00" }), "paid");
  assert.equal(classifyInvoicePayment({ expectedAmount: "49", receivedAmount: "50" }), "overpaid");
});

test("enforces safe invoice status transitions", () => {
  assert.equal(assertInvoiceStatusTransition("pending", "partially_paid"), true);
  assert.equal(assertInvoiceStatusTransition("partially_paid", "paid"), true);
  assert.throws(() => assertInvoiceStatusTransition("paid", "expired"), /terminal/);
  assert.throws(() => assertInvoiceStatusTransition("pending", "refunded"), /Unknown/);
});

test("builds a deterministic invoice reference for a customer billing period", () => {
  assert.equal(
    buildInvoiceReference({ customerId: "cus_1", planId: "professional", billingPeriod: "2026-11" }),
    "cus_1:professional:2026-11"
  );
  assert.throws(() => buildInvoiceReference({ customerId: "", planId: "pro", billingPeriod: "2026-11" }), /customerId/);
});
