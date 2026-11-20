// Generated from Bordero Web (trailing whitespace normalized) src/lib/hotelPayments/hotelPaymentPlan.ts. Do not edit formulas here.
// SHA256 1049c3d15ad9e8d984872437eced3013691e9d82a3ddb559b4769a193dbe85dc
// L7.3/L7.4 — pure rules of the hotel payment plan (no I/O): derived state of a line, balance, settlement form validation.
//
// Four concepts stay apart: commitment (the stay), schedule line (amount + due date), settlement (real dated payment), consolidated situation.
// A line carries a read cache of its ACTIVE settlements (paid_amount, last date/means) written only by the server RPCs; « partial » and « overdue »
// are independent facts: a line can be both.

import { toCents, fromCents } from "./settlementJustification";

export type HotelPaymentStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface HotelPaymentLike {
  status: string | null;
  due_date: string | null;
  paid_at?: string | null;
  paid_on?: string | null;
  payment_method?: string | null;
  settlement_id?: string | null;
  paid_amount?: number | string | null;
  amount?: number | string | null;
}

const todayIso = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/** Marked paid before L7.3: no settlement, no real date, no means. Shown as such and regularised explicitly, never converted silently. */
export const isHistoricalPaid = (p: HotelPaymentLike): boolean =>
  (p.status === "paid" || !!p.paid_at) && !p.settlement_id && !(Number(p.paid_amount || 0) > 0);

export type LineSettlementState = "cancelled" | "historical" | "unpaid" | "partial" | "paid";

export interface HotelLineState {
  state: LineSettlementState;
  amount: number;
  /** Σ of the active settlements (server cache). Historical lines report 0: their payment is unproven. */
  paidAmount: number;
  /** Still owed on this line; 0 for a paid, cancelled or historical line. */
  remaining: number;
  /** Something is still owed AND the due date is past — independent of « partial ». */
  overdue: boolean;
  dueDate: string | null;
  lastPaidOn: string | null;
}

/** Exact (integer cents) state of one plan line: paid, partial, unpaid, overdue. */
export function hotelLineState(p: HotelPaymentLike, now: Date = new Date()): HotelLineState {
  const amountC = toCents(p.amount);
  const paidC = Math.min(toCents(p.paid_amount), amountC);
  const base = { amount: fromCents(amountC), paidAmount: fromCents(paidC), dueDate: p.due_date, lastPaidOn: p.paid_on ?? null };
  if (p.status === "cancelled") return { ...base, state: "cancelled", remaining: 0, overdue: false };
  if (isHistoricalPaid(p)) return { ...base, paidAmount: 0, state: "historical", remaining: 0, overdue: false };
  const remainingC = Math.max(0, amountC - paidC);
  const overdue = remainingC > 0 && !!p.due_date && p.due_date.slice(0, 10) < todayIso(now);
  const state: LineSettlementState = remainingC === 0 && paidC > 0 ? "paid" : paidC > 0 ? "partial" : "unpaid";
  return { ...base, state, remaining: fromCents(remainingC), overdue };
}

/** Display status, never stored. A fully paid line is « paid »; otherwise « overdue » when something is owed past the due date (partial or not). */
export function deriveHotelPaymentStatus(p: HotelPaymentLike, now: Date = new Date()): HotelPaymentStatus {
  if (p.status === "paid" || p.paid_at) return "paid";
  if (p.status === "cancelled") return "cancelled";
  if (p.amount == null) return p.due_date && p.due_date.slice(0, 10) < todayIso(now) ? "overdue" : "pending";   // amount unknown: the due date alone decides
  return hotelLineState(p, now).overdue ? "overdue" : "pending";
}

/** Balance = stay total TTC − Σ active deposits (never negative). */
export function computeHotelBalance(totalTtc: number, payments: { payment_type: string; status: string | null; amount: number | string | null }[]): number {
  const deposits = payments
    .filter((p) => p.payment_type === "deposit" && p.status !== "cancelled")
    .reduce((s, p) => s + toCents(p.amount), 0);
  return fromCents(Math.max(0, toCents(totalTtc) - deposits));
}

export interface SettlementFormInput { paidOn: string; method: string; amount?: string | number | null }

/** Real payment date (not in the future), non-empty free-text means, and — when given — a positive cents amount not above what remains. */
export function validateSettlementForm(input: SettlementFormInput, now: Date = new Date(), remaining?: number): string | null {
  if (!input.paidOn) return "La date réelle du paiement est obligatoire.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) return "Date de paiement invalide.";
  if (input.paidOn > todayIso(now)) return "La date de paiement ne peut pas être dans le futur.";
  if (!input.method.trim()) return "Le moyen de paiement est obligatoire (ex. virement, carte, chèque).";
  if (input.amount !== undefined && input.amount !== null && input.amount !== "") {
    const n = typeof input.amount === "number" ? input.amount : Number(String(input.amount).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return "Montant invalide (centimes, supérieur à 0).";
    if (remaining !== undefined && toCents(n) > toCents(remaining)) return "Le montant dépasse le reste à régler de cette échéance.";
  }
  return null;
}

/** Plan totals from the server cache: real settlements count as paid, historical « paid » lines are reported apart, partial lines count for what they received. */
export function summarizeHotelPlan(totalTtc: number, payments: HotelPaymentLike[], now: Date = new Date()) {
  const planned = toCents(totalTtc);
  let paid = 0, historical = 0, overdue = 0;
  for (const p of payments) {
    const s = hotelLineState(p, now);
    if (s.state === "cancelled") continue;
    if (s.state === "historical") historical += toCents(p.amount);
    else paid += toCents(s.paidAmount);
    if (s.overdue) overdue += toCents(s.remaining);
  }
  return { planned: fromCents(planned), paid: fromCents(paid), historical: fromCents(historical), remaining: fromCents(planned - paid - historical), overdueAmount: fromCents(overdue) };
}

export interface CommitmentDates { nextDueDate: string | null; lastPaidOn: string | null; remaining: number }

/** What an accounting row of a hotel commitment must show next to its engaged amount: next unpaid due date, last REAL settlement date, what is left. */
export function hotelCommitmentDates(p: { expected_amount: number | string; received_amount: number | string; due_date: string | null; received_date: string | null }): CommitmentDates {
  const remainingC = Math.max(0, toCents(p.expected_amount) - toCents(p.received_amount));
  return { nextDueDate: remainingC > 0 ? p.due_date : null, lastPaidOn: toCents(p.received_amount) > 0 ? p.received_date : null, remaining: fromCents(remainingC) };
}
