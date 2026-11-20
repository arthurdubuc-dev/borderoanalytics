// Generated from Bordero Web (trailing whitespace normalized) src/lib/hotelPayments/settlementJustification.ts. Do not edit formulas here.
// SHA256 8753eda3d1017251e0651c02d6245f09dcbb0324adb9fb237f7c9352bb467a53
// L7.3-D — derived justification state of a settlement (never stored). Integer cents everywhere: no floating drift.

export type JustificationStatus = "awaiting" | "partial" | "justified" | "over";

export const toCents = (n: number | string | null | undefined): number => Math.round(Number(n || 0) * 100);
export const fromCents = (c: number): number => c / 100;

export interface JustificationLink { amount_allocated: number | string | null }

/** En attente de justificatif (0) · Partiellement justifié (0 < Σ < net) · Justifié (Σ = net). « over » only if data got out of the RPC caps. */
export function deriveJustification(settlementAmount: number | string, links: readonly JustificationLink[], active = true) {
  const net = toCents(settlementAmount);
  const allocated = active ? links.reduce((s, l) => s + toCents(l.amount_allocated), 0) : 0;
  const status: JustificationStatus =
    allocated <= 0 ? "awaiting" : allocated < net ? "partial" : allocated === net ? "justified" : "over";
  return { status, allocated: fromCents(allocated), missing: fromCents(Math.max(0, net - allocated)) };
}

/** What is left on a document once its allocations to settlements are removed (a document may justify several settlements). */
export function documentRemaining(totalTtc: number | string | null, allocations: readonly JustificationLink[]) {
  if (totalTtc == null) return null; // amount unknown: the server cannot cap it either
  return fromCents(Math.max(0, toCents(totalTtc) - allocations.reduce((s, l) => s + toCents(l.amount_allocated), 0)));
}

/** Proposed allocation when linking a document to a settlement: as much as both sides still allow. */
export function suggestAllocation(settlementMissing: number, documentLeft: number | null): number {
  const m = toCents(settlementMissing);
  return fromCents(documentLeft == null ? m : Math.min(m, toCents(documentLeft)));
}

export const JUSTIFICATION_LABELS: Record<JustificationStatus, string> = {
  awaiting: "En attente de justificatif",
  partial: "Partiellement justifié",
  justified: "Justifié",
  over: "Sur-justifié (à vérifier)",
};
