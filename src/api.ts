import { rpc, table, request } from "./client";
import {
  numberOrNull as num,
  type Workspace,
  type Project,
  type Tour,
  type DateSummary,
  type Scope,
  type FinanceSummary,
  type Breakdown,
  type Dimension,
  type Timeline,
} from "./domain";
type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
export async function bootstrap(signal: AbortSignal) {
  const lifecycle = await rpc<Row>("get_my_account_lifecycle", {}, signal);
  if (lifecycle.success !== true || lifecycle.account_status !== "active")
    throw new Error("FORBIDDEN");
  const access = await rpc<Array<{ workspace_id: string }>>(
    "list_accessible_workspaces",
    {},
    signal,
  );
  const ids = [...new Set(access.map((a) => a.workspace_id))];
  if (!ids.length) return [];
  return table<Workspace>(
    "workspaces",
    {
      select: "id,name",
      id: `in.(${ids.join(",")})`,
      order: "name.asc,id.asc",
    },
    signal,
  );
}
export async function catalog(workspaceId: string, signal: AbortSignal) {
  const [projects, tours] = await Promise.all([
    table<Project>(
      "projects",
      {
        select: "id,name,season,workspace_id",
        workspace_id: `eq.${workspaceId}`,
        archived_at: "is.null",
        order: "name.asc,id.asc",
      },
      signal,
    ),
    table<Tour>(
      "tours",
      {
        select: "id,project_id,name,season",
        workspace_id: `eq.${workspaceId}`,
        archived_at: "is.null",
        order: "name.asc,id.asc",
      },
      signal,
    ),
  ]);
  return { projects, tours };
}
export async function loadDates(
  workspaceId: string,
  projects: Project[],
  signal: AbortSignal,
): Promise<DateSummary[]> {
  const [meta, canonical, economic] = await Promise.all([
    table<Row>(
      "event_dates",
      {
        select:
          "id,project_id,tour_id,date,name,show_time,status,deal_type,capacity,venues:venue_id(name,city)",
        workspace_id: `eq.${workspaceId}`,
        order: "date.asc,id.asc",
      },
      signal,
    ),
    table<Row>(
      "v_event_date_sales_current_canonical",
      {
        select:
          "event_date_id,tickets_sold,gross_revenue,revenue_hors_dl_ttc,source_type,source_updated_at",
        workspace_id: `eq.${workspaceId}`,
        order: "event_date_id.asc",
      },
      signal,
    ),
    table<Row>(
      "v_event_date_sales_economic_current",
      {
        select:
          "event_date_id,economic_tickets,economic_gross_ttc,inherited_tickets,commercial_role,continuity_pending",
        workspace_id: `eq.${workspaceId}`,
        order: "event_date_id.asc",
      },
      signal,
    ),
  ]);
  const sources = new Map(canonical.map((r) => [String(r.event_date_id), r]));
  const eco = new Map(economic.map((r) => [String(r.event_date_id), r]));
  const allowed = new Set(projects.map((p) => p.id));
  return meta
    .filter((r) => allowed.has(String(r.project_id)))
    .map((r) => {
      const c = sources.get(String(r.id));
      const e = eco.get(String(r.id));
      const venue = r.venues as Row | null;
      return {
        id: String(r.id),
        projectId: String(r.project_id),
        tourId: str(r.tour_id),
        name: String(r.name ?? "Représentation"),
        day: String(r.date),
        time: str(r.show_time),
        venue: str(venue?.name),
        city: str(venue?.city),
        status: String(r.status),
        dealType: String(r.deal_type ?? "ticketing"),
        tickets:
          c?.source_type === "cession_attendance" ||
          e?.continuity_pending === true
            ? null
            : num(e?.economic_tickets ?? c?.tickets_sold),
        gross:
          c?.source_type === "cession_attendance" ||
          e?.continuity_pending === true
            ? null
            : num(e?.economic_gross_ttc ?? c?.gross_revenue),
        horsDl:
          c?.source_type === "cession_attendance" ||
          Number(e?.inherited_tickets) > 0 ||
          e?.continuity_pending === true
            ? null
            : num(c?.revenue_hors_dl_ttc),
        inherited: num(e?.inherited_tickets),
        updatedAt: str(c?.source_updated_at),
        source: str(c?.source_type),
        capacity: num(r.capacity),
      };
    });
}
export function eligible(d: DateSummary) {
  return (
    d.dealType !== "cession" &&
    ![
      "cancelled",
      "postponed",
      "rescheduled",
      "off",
      "option_1",
      "option_2",
    ].includes(d.status)
  );
}
export async function financials(
  scope: Scope,
  signal: AbortSignal,
): Promise<FinanceSummary[]> {
  const result = await request<{
    schema_version: string;
    dates: FinanceSummary[];
  }>("/functions/v1/mobile-dashboard", signal, { action: "finance", scope });
  if (result.schema_version !== "1.0" || !Array.isArray(result.dates))
    throw new Error("CONTRACT");
  return result.dates;
}
export async function breakdown(
  scope: Scope,
  kind: "tariff" | "distributor",
  signal: AbortSignal,
): Promise<Breakdown> {
  if (!scope.projectId) throw new Error("SCOPE");
  const raw = await rpc<Row>(
    "get_project_sales_breakdown",
    {
      p_project_id: scope.projectId,
      p_group_by: kind,
      p_level: scope.eventId ? "by_event" : "rollup",
      p_tour_id: scope.tourId ?? null,
      p_from: scope.from ?? null,
      p_to: scope.to ?? null,
      p_include_cancelled: false,
      p_limit: 25,
      p_offset: 0,
    },
    signal,
  );
  // Event pages are bounded by the server; walk all pages to find the selected representation.
  let events = rows(raw.events);
  let offset = 25;
  while (
    scope.eventId &&
    !events.some((e) => e.event_date_id === scope.eventId) &&
    offset < Number(raw.total_dates)
  ) {
    const page = await rpc<Row>(
      "get_project_sales_breakdown",
      {
        p_project_id: scope.projectId,
        p_group_by: kind,
        p_level: "by_event",
        p_tour_id: scope.tourId ?? null,
        p_from: scope.from ?? null,
        p_to: scope.to ?? null,
        p_limit: 25,
        p_offset: offset,
      },
      signal,
    );
    const pageRows = rows(page.events);
    events = events.concat(pageRows);
    offset += 25;
    if (!pageRows.length) break;
  }
  const event = scope.eventId
    ? events.find((e) => e.event_date_id === scope.eventId)
    : undefined;
  const dims = rows(scope.eventId ? event?.dimensions : raw.dimensions);
  const totals = (raw.totals ?? {}) as Row;
  const recon = rows(raw.reconciliation);
  const status = scope.eventId
    ? String(event?.reconciliation_status ?? "unavailable")
    : recon.some((r) => r.status === "mismatch")
      ? "inconsistent"
      : recon.some((r) =>
            ["non_comparable_source", "breakdown_unavailable"].includes(
              String(r.status),
            ),
          )
        ? "partial"
        : "complete";
  return {
    items: dims.map(
      (d): Dimension => ({
        key: String(d.key),
        label: String(d.label ?? "Tarif"),
        category: str(d.category_label),
        tickets: num(d.tickets) ?? 0,
        gross: num(d.gross_revenue_ttc),
        horsDl: num(d.revenue_hors_dl_ttc),
        variants: num(d.price_variants) ?? 1,
        dateCount: num(d.dates_count),
        priceIds: Array.isArray(d.ticket_price_ids)
          ? (d.ticket_price_ids as string[])
          : [],
        priceMin: num(d.min_price_ttc),
        priceMax: num(d.max_price_ttc),
      }),
    ),
    officialTickets: num(
      scope.eventId ? event?.canonical_tickets : totals.canonical_tickets,
    ),
    detailTickets: num(
      scope.eventId ? event?.breakdown_tickets : totals.breakdown_tickets,
    ),
    status,
    truncated: raw.dates_truncated === true,
    notes: [],
  };
}
export async function timeline(
  scope: Scope,
  signal: AbortSignal,
): Promise<Timeline> {
  if (scope.eventId) {
    const points = await table<Row>(
      "v_event_date_sales_daily_canonical",
      {
        select: "snapshot_date,tickets_sold,gross_revenue",
        event_date_id: `eq.${scope.eventId}`,
        workspace_id: `eq.${scope.workspaceId}`,
        order: "snapshot_date.asc",
      },
      signal,
    );
    return {
      points: points.map((p) => ({
        day: String(p.snapshot_date),
        tickets: num(p.tickets_sold),
        gross: num(p.gross_revenue),
        span: null,
        status: "observed",
      })),
      through: str(points.at(-1)?.snapshot_date),
      lag: null,
    };
  }
  if (!scope.projectId) throw new Error("SCOPE");
  const raw = await rpc<Row>(
    "get_project_sales_timeline",
    { p_project_id: scope.projectId, p_tour_id: scope.tourId ?? null },
    signal,
  );
  const sales = raw.sales as Row;
  return {
    points: rows(sales?.days).map((d) => ({
      day: String(d.day),
      tickets: num(d.cumulative),
      gross: num(d.gross_revenue_cumulative),
      span: num(d.span_days),
      status: String(d.status),
    })),
    through: str(sales?.data_through),
    lag: num(sales?.data_lag_days),
  };
}
export async function prices(eventId: string, signal: AbortSignal) {
  return table<Row>(
    "ticket_prices",
    {
      select:
        "id,tariff_name,price_ht,dl_producer,dl_venue,dl_distribution,quota,quota_type,ticket_categories(label)",
      event_date_id: `eq.${eventId}`,
      order: "sort_order.asc,id.asc",
    },
    signal,
  );
}

export async function workspaceEvolution(projects:Project[],signal:AbortSignal){
 const {parisDay,observedWeek,sumKnown}=await import('./domain');
 const now=new Date(parisDay()+'T12:00:00Z');now.setUTCDate(now.getUTCDate()-1);const end=now.toISOString().slice(0,10);now.setUTCDate(now.getUTCDate()-6);const start=now.toISOString().slice(0,10);
 const results:Array<{tickets:number;gross:number|null}|null>=Array(projects.length).fill(null);let next=0;
 await Promise.all(Array.from({length:Math.min(4,projects.length)},async()=>{while(next<projects.length){const i=next++;const raw=await rpc('get_project_sales_timeline',{p_project_id:projects[i]!.id,p_as_of_date:parisDay()},signal);results[i]=observedWeek(raw,start,end);}}));
 const comparable=results.filter((r):r is {tickets:number;gross:number|null}=>r!==null);
 return {start,end,projects:projects.length,covered:comparable.length,tickets:comparable.length?comparable.reduce((sum,r)=>sum+r.tickets,0):null,gross:sumKnown(comparable.map(r=>r.gross))};
}
