// All requests use the caller's JWT and RLS. There is no service-role client.
import {
  computeBordereauCalculations,
  resolvePlateauCosts,
  toTourCostLines,
  toStaffCostLines,
  toHotelCostLines,
  computeStaffCostLineTotal,
  calculateHotelRows,
} from "./canonical.mjs";
type Row = Record<string, any>;
type Env = { url: string; anonKey: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class SafeError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  Vary: "Authorization",
};
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
export function validateScope(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SafeError(400, "INVALID_SCOPE");
  const s = value as Row;
  for (const k of ["workspaceId", "projectId", "tourId", "eventId"])
    if (
      s[k] !== undefined &&
      s[k] !== null &&
      (typeof s[k] !== "string" || !UUID.test(s[k]))
    )
      throw new SafeError(400, "INVALID_SCOPE");
  if (!UUID.test(s.workspaceId ?? ""))
    throw new SafeError(400, "INVALID_SCOPE");
  for (const k of ["from", "to"])
    if (
      s[k] !== undefined &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(s[k]) ||
        !Number.isFinite(Date.parse(s[k] + "T12:00:00Z")) ||
        new Date(s[k] + "T12:00:00Z").toISOString().slice(0, 10) !== s[k])
    )
      throw new SafeError(400, "INVALID_PERIOD");
  if (s.from && s.to && s.from > s.to)
    throw new SafeError(400, "INVALID_PERIOD");
  return s;
}
export function canReadPlateau(
  cap: Row,
  project: Row,
  workspace: Row,
  entitlements: Row,
): boolean {
  if (cap.role === "super_admin") return true;
  if (
    !cap.canViewBordereau ||
    !["workspace_admin", "workspace_member", "coproducer"].includes(cap.role)
  )
    return false;
  if (entitlements.orgKind === "promoter")
    return (
      entitlements.canViewPlateauOwn === true &&
      !!project.owner_org_id &&
      project.owner_org_id === workspace.organization_id
    );
  return ["producer", "festival", "venue"].includes(entitlements.orgKind);
}
function store(
  env: Env,
  authorization: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
) {
  async function call(path: string, body?: unknown): Promise<any> {
    const r = await fetcher(env.url + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        apikey: env.anonKey,
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!r.ok)
      throw new SafeError(
        r.status === 401 ? 401 : r.status === 403 ? 403 : 503,
        "SOURCE_UNAVAILABLE",
      );
    return r.json();
  }
  async function table(
    name: string,
    params: Record<string, string> = {},
    order = "id.asc",
  ): Promise<Row[]> {
    const out: Row[] = [];
    for (let offset = 0; ; offset += 500) {
      const q = new URLSearchParams({
        select: "*",
        order,
        ...params,
        limit: "500",
        offset: String(offset),
      });
      const page = await call("/rest/v1/" + name + "?" + q);
      if (!Array.isArray(page)) throw new SafeError(503, "SOURCE_INVALID");
      out.push(...page);
      if (page.length < 500) return out;
      if (offset >= 50000) throw new SafeError(422, "SCOPE_TOO_LARGE");
    }
  }
  async function forDates(name: string, ids: string[], select: string) {
    const out: Row[] = [];
    for (let i = 0; i < ids.length; i += 30)
      out.push(
        ...(await table(name, {
          select,
          event_date_id: "in.(" + ids.slice(i, i + 30).join(",") + ")",
        })),
      );
    return out;
  }
  return {
    call,
    table,
    forDates,
    rpc: (name: string, args: Row) => call("/rest/v1/rpc/" + name, args),
  };
}
async function parallelMap<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const i = next++;
        out[i] = await fn(values[i]!);
      }
    }),
  );
  return out;
}
async function plateauForProject(
  db: ReturnType<typeof store>,
  project: Row,
  dates: Row[],
) {
  const [costs, staff, days, stays] = await Promise.all([
    db.table("tour_cost_items", {
      project_id: "eq." + project.id,
      select:
        "id,tour_id,amount,quantity,allocation_method,applies_to_date_ids",
    }),
    db.table("tour_staff_costs", {
      project_id: "eq." + project.id,
      select:
        "id,tour_id,billing_mode,amount_ht,vat_applicable,vat_rate,cost_mode,total_employer_cost,per_diem_total,applies_to_date_ids",
    }),
    db.table("tour_days", {
      project_id: "eq." + project.id,
      select:
        "id,date,day_type,city,event_date_id,tour_id,event_date:event_dates(tour_id)",
    }),
    db.table("hotel_stays_with_financials", {
      project_id: "eq." + project.id,
      select:
        "id,tour_id,roadbook_entry_id,rates,pax_count,city_tax_per_person_per_night,status",
    }),
  ]);
  // The Web's read-only virtual SHOW days and deterministic entry-to-day fallback.
  const allDays = [
    ...days,
    ...dates
      .filter((d) => !days.some((td) => td.event_date_id === d.id))
      .map((d) => ({
        id: "__virtual_tour_day__:" + d.id,
        date: d.date,
        day_type: "SHOW",
        city: null,
        event_date_id: d.id,
        tour_id: d.tour_id,
        event_date: { tour_id: d.tour_id },
      })),
  ];
  const entries: Row[] = [];
  for (let i = 0; i < allDays.length; i += 25) {
    const batch = allDays.slice(i, i + 25);
    const real = batch.map((d) => d.id).filter((id) => UUID.test(id));
    const ev = batch.map((d) => d.event_date_id).filter(Boolean);
    const filters = [
      ...(real.length ? ["tour_day_id.in.(" + real.join(",") + ")"] : []),
      ...(ev.length ? ["event_date_id.in.(" + ev.join(",") + ")"] : []),
    ];
    if (filters.length)
      entries.push(
        ...(await db.table("roadbook_entries_with_financials", {
          select: "id,tour_day_id,event_date_id,type,details,location_name",
          type: "in.(hotel,tourbus)",
          or: "(" + filters.join(",") + ")",
        })),
      );
  }
  const unique = [...new Map(entries.map((e) => [e.id, e])).values()].map(
    (e) => ({
      ...e,
      tour_day_id: allDays.some((d) => d.id === e.tour_day_id)
        ? e.tour_day_id
        : allDays.find((d) => d.event_date_id === e.event_date_id)?.id,
    }),
  );
  const stayMap = new Map(
    stays
      .filter((s) => s.roadbook_entry_id)
      .map((s) => [s.roadbook_entry_id, s]),
  );
  const economicDates = dates.map((d) => ({
    id: d.id,
    status: d.status,
    financialClosedAt: d.financial_closed_at,
    lockedAllocation: d.plateau_allocation_locked,
    plateauOverride: d.plateau_override,
  }));
  const pool = (tourId: string | null) => {
    const dayScope = tourId
      ? allDays.filter((d) => (d.event_date?.tour_id ?? d.tour_id) === tourId)
      : allDays;
    const dateScope = tourId
      ? dates.filter((d) => d.tour_id === tourId)
      : dates;
    const hotelRows = calculateHotelRows(dayScope, unique, stayMap);
    const hotelTotal = hotelRows.reduce(
      (sum: number, r: Row) => sum + r.total_ttc,
      0,
    );
    const scopeCosts = tourId
      ? costs.filter((c) => c.tour_id === tourId)
      : costs;
    const scopeStaff = tourId
      ? staff.filter((c) => c.tour_id === tourId)
      : staff;
    return {
      dates: economicDates.filter((d) => dateScope.some((s) => s.id === d.id)),
      lines: [
        ...toTourCostLines(scopeCosts),
        ...toStaffCostLines(scopeStaff, (c: Row) =>
          computeStaffCostLineTotal(c, dateScope.length),
        ),
        ...toHotelCostLines(hotelTotal),
      ],
    };
  };
  const base = pool(null),
    cache = new Map<string, any>();
  return (d: Row) => {
    const key = d.tour_id ?? "";
    if (!cache.has(key))
      cache.set(
        key,
        resolvePlateauCosts({
          tourId: d.tour_id,
          tour: d.tour_id ? pool(d.tour_id) : { dates: [], lines: [] },
          project: base,
        }),
      );
    return cache.get(key).getPlateauCostForDate(d.id).totalAllocation;
  };
}
export function buildPublicFinance(input: {
  date: Row;
  project: Row;
  source: Row | undefined;
  sales: Row[];
  prices: Row[];
  taxes: Row[];
  costs: Row[];
  communication: Row[];
  digital: Row[];
  canPlateau: boolean;
  allocation: number | null;
  plateauWarning?: string;
}) {
  const {
    date: d,
    project,
    source,
    sales,
    prices,
    taxes,
    costs,
    communication,
    digital,
  } = input;
  const inherited = Array.isArray(
    d.tax_override_enabled ? d.tax_profile_override : project.tax_profile,
  )
    ? d.tax_override_enabled
      ? d.tax_profile_override
      : project.tax_profile
    : [];
  const perDate = new Set(["PROMOTEUR_LOCAL", "COMMISSION_AGENT"]);
  const merged = [
    ...inherited.filter((t: Row) => !perDate.has(t.code)),
    ...taxes.filter((t) => perDate.has(t.code)),
  ];
  const c = computeBordereauCalculations({
    eventDateId: d.id,
    eventDate: {
      vatRate: d.vat_rate,
      dealType: d.deal_type,
      dlPromoterPct: d.dl_promoter_pct,
      cessionAmountHt: d.cession_amount_ht,
      status: d.status,
      actualAttendance: d.actual_attendance,
    },
    project: { vatRate: project.vat_rate },
    sales,
    ticketPrices: prices,
    costItems: costs.filter((i) => i.group_code !== "E" || input.canPlateau),
    taxes: merged,
    communicationActions: communication,
    plateauCost: {
      totalAllocation: input.canPlateau ? (input.allocation ?? 0) : 0,
    },
    totalDigitalTTC: input.canPlateau
      ? digital.reduce((s, r) => s + Number(r.amount_ttc), 0)
      : 0,
    enabled: true,
  });
  const warnings: string[] = [];
  const comparable =
    source?.source_type === "bordero_sales" &&
    source.gross_revenue !== null &&
    Math.abs(Number(source.gross_revenue) - c.recetteTTC) < 0.01;
  if (!comparable)
    warnings.push(
      "Les recettes financières ne sont pas réconciliées avec la source commerciale actuelle.",
    );
  if (input.plateauWarning) warnings.push(input.plateauWarning);
  const section = (
    key: string,
    label: string,
    amount: number | null,
    note?: string,
  ) => ({
    key,
    label,
    amount: amount === null ? null : Math.round(amount * 100) / 100,
    basis: "Montant du bordereau · base historique",
    ...(note ? { note } : {}),
  });
  const sections = [
    section("vat", "TVA billetterie", c.tva),
    section(
      "taxes",
      "Taxes et retenues",
      c.retenuesTotalBeforePromoteur,
      "Hors commission du promoteur local",
    ),
    section("A", "Salle", c.totalA),
    section("B", "Personnel", c.totalB),
    section("C", "Local", c.totalC),
    section("D", "Marketing", c.totalD),
    section("P", "dont Communication", c.totalP, "Déjà incluse dans Marketing"),
  ];
  if (input.canPlateau)
    sections.push(
      section(
        "E",
        "Plateau",
        input.allocation === null ? null : c.totalE,
        "Allocation mutualisée et coûts plateau du workspace",
      ),
    );
  // Never return a result/total from which a hidden E could be inferred.
  return {
    eventId: d.id,
    gross: comparable ? c.recetteTTC : null,
    horsDl: comparable ? c.revenueExcludingDlTtc : null,
    producerDl: comparable
      ? Math.round((c.revenueExcludingDlTtc + c.dlProducerAmount) * 100) / 100
      : null,
    net: comparable ? c.recetteHTApresRetenues : null,
    sections,
    warnings,
  };
}
export function createHandler(env: Env, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
    const authorization = request.headers.get("Authorization") ?? "";
    if (!/^Bearer \S+$/.test(authorization))
      return reply({ code: "UNAUTHORIZED" }, 401);
    try {
      if (Number(request.headers.get("content-length") ?? 0) > 8192)
        throw new SafeError(413, "REQUEST_TOO_LARGE");
      const text = await request.text();
      if (text.length > 8192) throw new SafeError(413, "REQUEST_TOO_LARGE");
      let body: Row;
      try {
        body = JSON.parse(text);
      } catch {
        throw new SafeError(400, "INVALID_JSON");
      }
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        body.action !== "finance"
      )
        throw new SafeError(400, "INVALID_ACTION");
      const scope = validateScope(body.scope);
      const includeSections = Boolean(scope.eventId);
      const db = store(env, authorization, request.signal, fetcher);
      const user = await db.call("/auth/v1/user");
      if (!UUID.test(user.id ?? "")) throw new SafeError(401, "UNAUTHORIZED");
      const lifecycle = await db.rpc("get_my_account_lifecycle", {});
      if (lifecycle.success !== true || lifecycle.account_status !== "active")
        throw new SafeError(403, "ACCOUNT_UNAVAILABLE");
      const projectParams: Record<string, string> = {
        workspace_id: "eq." + scope.workspaceId,
        archived_at: "is.null",
        select: "id,workspace_id,owner_org_id,vat_rate,tax_profile",
      };
      if (scope.projectId) projectParams.id = "eq." + scope.projectId;
      const projects = await db.table("projects", projectParams);
      if (!projects.length) return reply({ schema_version: "1.0", dates: [] });
      const projectIds = projects.map((p) => p.id);
      const dates = await db.table("event_dates", {
        workspace_id: "eq." + scope.workspaceId,
        project_id: "in.(" + projectIds.join(",") + ")",
        select:
          "id,workspace_id,project_id,tour_id,date,status,vat_rate,deal_type,cession_amount_ht,actual_attendance,dl_promoter_pct,tax_override_enabled,tax_profile_override,plateau_override,financial_closed_at,plateau_allocation_locked",
      });
      const selected = dates.filter(
        (d) =>
          (!scope.eventId || d.id === scope.eventId) &&
          (scope.tourId === undefined || d.tour_id === scope.tourId) &&
          (!scope.from || d.date >= scope.from) &&
          (!scope.to || d.date <= scope.to),
      );
      if (selected.length > 500) throw new SafeError(422, "SCOPE_TOO_LARGE");
      const capabilities = await parallelMap(dates, 6, (d) =>
        db.rpc("get_date_capabilities", { _event_date_id: d.id }),
      );
      const caps = new Map(dates.map((d, i) => [d.id, capabilities[i]]));
      const authorized = selected.filter(
        (d) => caps.get(d.id)?.canViewBordereau === true,
      );
      const ids = authorized.map((d) => d.id);
      if (!ids.length) return reply({ schema_version: "1.0", dates: [] });
      const [
        sales,
        prices,
        costs,
        taxes,
        communication,
        sources,
        workspaces,
        billing,
      ] = await Promise.all([
        db.forDates(
          "sales",
          ids,
          "id,event_date_id,ticket_price_id,quantity,platform",
        ),
        db.forDates(
          "ticket_prices",
          ids,
          "id,event_date_id,tariff_name,price_ht,dl_producer,dl_venue,dl_distribution",
        ),
        includeSections ? db.forDates(
          "bordereau_cost_items", ids,
          "event_date_id,group_code,cell_code,total,quantity",
        ) : Promise.resolve([]),
        db.forDates(
          "bordereau_taxes",
          ids,
          "event_date_id,code,label,mode,value,apply_to",
        ),
        includeSections ? db.forDates("communication_actions", ids, "event_date_id,total_cost") : Promise.resolve([]),
        db.table(
          "v_event_date_sales_current_canonical",
          {
            workspace_id: "eq." + scope.workspaceId,
            select: "event_date_id,source_type,gross_revenue",
          },
          "event_date_id.asc",
        ),
        db.table("workspaces", {
          id: "eq." + scope.workspaceId,
          select: "id,organization_id",
        }),
        includeSections ? db
          .call("/functions/v1/workspace-billing-context", {
            workspaceId: scope.workspaceId,
          })
          .catch(() => ({ entitlements: {} })) : Promise.resolve({entitlements:{}}),
      ]);
      const economic = await db.table(
        "v_event_date_sales_economic_current",
        {
          workspace_id: "eq." + scope.workspaceId,
          select: "event_date_id,inherited_tickets,continuity_pending",
        },
        "event_date_id.asc",
      );
      const entitlements = billing.entitlements ?? {},
        workspace = workspaces[0] ?? {};
      const plateau = new Map<
        string,
        { get: (d: Row) => number; error?: string }
      >();
      for (const project of projects) {
        const pd = dates.filter((d) => d.project_id === project.id);
        const can = includeSections && authorized.some(
          (d) =>
            d.project_id === project.id &&
            canReadPlateau(
              caps.get(d.id) ?? {},
              project,
              workspace,
              entitlements,
            ),
        );
        if (!can) continue;
        if (!pd.every((d) => caps.get(d.id)?.canViewBordereau === true)) {
          plateau.set(project.id, {
            get: () => NaN,
            error:
              "Plateau indisponible : accès incomplet au périmètre de répartition.",
          });
          continue;
        }
        try {
          plateau.set(project.id, {
            get: await plateauForProject(db, project, pd),
          });
        } catch {
          plateau.set(project.id, {
            get: () => NaN,
            error:
              "Le plateau ne peut pas être calculé : une de ses sources est indisponible.",
          });
        }
      }
      const eIds = includeSections ? authorized
        .filter((d) =>
          canReadPlateau(
            caps.get(d.id) ?? {},
            projects.find((p) => p.id === d.project_id)!,
            workspace,
            entitlements,
          ),
        )
        .map((d) => d.id) : [];
      const digital = eIds.length
        ? await db.forDates(
            "digital_campaigns",
            eIds,
            "event_date_id,amount_ttc",
          )
        : [];
      const result = authorized.map((d) => {
        const project = projects.find((p) => p.id === d.project_id)!;
        const own = (r: Row) => r.event_date_id === d.id;
        const canPlateau = includeSections && canReadPlateau(
          caps.get(d.id) ?? {},
          project,
          workspace,
          entitlements,
        );
        const pool = plateau.get(d.project_id);
        const amount = canPlateau ? pool?.get(d) : null;
        const summary = buildPublicFinance({
          date: d,
          project,
          source: economic.some(
            (e) =>
              own(e) &&
              (Number(e.inherited_tickets) > 0 ||
                e.continuity_pending === true),
          )
            ? undefined
            : sources.find(own),
          sales: sales.filter(own),
          prices: prices.filter(own),
          costs: costs.filter(own),
          taxes: taxes.filter(own),
          communication: communication.filter(own),
          digital: digital.filter(own),
          canPlateau,
          allocation: Number.isFinite(amount) ? amount! : null,
          plateauWarning: pool?.error,
        });
        if (!includeSections) summary.sections = [];
        return summary;
      });
      return reply({
        schema_version: "1.0",
        generated_at: new Date().toISOString(),
        dates: result,
      });
    } catch (error) {
      if (error instanceof SafeError)
        return reply({ code: error.code }, error.status);
      return reply({ code: "SOURCE_UNAVAILABLE" }, 503);
    }
  };
}
