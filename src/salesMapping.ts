import { numberOrNull as num, type DateSummary } from "./domain";
type Row = Record<string, unknown>;
/** The Web economic RPC is the authority for current stock, including transfers. */
export function mapCurrentSales(meta: Row[], economic: Row[]): DateSummary[] {
  const byId = new Map(economic.map((r) => [String(r.event_date_id), r]));
  return meta.map((r) => {
    const e = byId.get(String(r.id));
    const venue = r.venues as Row | null;
    const pending =
      e?.continuity_state === "pending_decision" ||
      e?.attribution_status === "inherited_ambiguous";
    const cession = String(r.deal_type ?? "ticketing") === "cession";
    const accessible = !!e && !pending && !cession;
    const amounts = accessible && e.revenue_visible === true;
    const text = (v: unknown) => (typeof v === "string" ? v : null);
    return {
      id: String(r.id),
      projectId: String(r.project_id),
      tourId: text(r.tour_id),
      name: String(r.name ?? "Représentation"),
      day: String(r.date),
      time: text(r.show_time),
      venue: text(venue?.name),
      city: text(venue?.city),
      status: String(r.status),
      dealType: String(r.deal_type ?? "ticketing"),
      tickets: accessible ? num(e.economic_tickets) : null,
      gross: amounts ? num(e.economic_gross_ttc) : null,
      horsDl:
        amounts && num(e.inherited_tickets) === 0
          ? num(e.economic_revenue_ht)
          : null,
      inherited: num(e?.inherited_tickets),
      updatedAt: null,
      source: null,
      capacity: num(r.capacity),
    };
  });
}
