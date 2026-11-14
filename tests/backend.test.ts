import { describe, it, expect } from "vitest";
import {
  createHandler,
  validateScope,
  canReadPlateau,
  buildPublicFinance,
} from "../supabase/functions/mobile-dashboard/handler";
const id = "11111111-1111-4111-8111-111111111111";
const base = {
  date: {
    id,
    vat_rate: 5.5,
    deal_type: "ticketing",
    dl_promoter_pct: 30,
    status: "confirmed",
  },
  project: { vat_rate: 5.5, tax_profile: [] },
  source: { source_type: "bordero_sales", gross_revenue: 1100 },
  sales: [{ ticket_price_id: "price", quantity: 10 }],
  prices: [
    {
      id: "price",
      price_ht: 100,
      dl_producer: 5,
      dl_venue: 2,
      dl_distribution: 3,
    },
  ],
  taxes: [],
  costs: [],
  communication: [],
  digital: [],
  canPlateau: false,
  allocation: null,
};
describe("finance issue du moteur Web", () => {
  it("définit TTC, Hors DL, part producteur et vraie nette", () => {
    const r = buildPublicFinance(base);
    expect(r.gross).toBe(1100);
    expect(r.horsDl).toBe(1000);
    expect(r.producerDl).toBe(1035);
    expect(r.net).toBe(947.87);
    expect(r.sections.some((s) => s.key === "E")).toBe(false);
    expect(r).not.toHaveProperty("total");
    expect(r).not.toHaveProperty("result");
  });
  it("ne transforme pas une autre source officielle en zéro financier", () => {
    const r = buildPublicFinance({
      ...base,
      source: { source_type: "sales_observations", gross_revenue: 1500 },
    });
    expect(r.net).toBeNull();
    expect(r.producerDl).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("ne retranche pas la commission promoteur de la Recette Nette", () => {
    const r = buildPublicFinance({
      ...base,
      taxes: [
        {
          code: "PROMOTEUR_LOCAL",
          label: "Promoteur",
          mode: "percent",
          value: 10,
          apply_to: "RECIPE_HT",
        },
      ],
    });
    expect(r.net).toBe(947.87);
  });
  it("le plateau indisponible n’est pas nul", () => {
    const r = buildPublicFinance({
      ...base,
      canPlateau: true,
      allocation: null,
      plateauWarning: "Source indisponible",
    });
    expect(r.sections.find((s) => s.key === "E")?.amount).toBeNull();
  });
  it("ne compte pas la communication deux fois", () => {
    const r = buildPublicFinance({
      ...base,
      communication: [{ total_cost: 100 }],
    });
    expect(r.sections.find((s) => s.key === "D")?.amount).toBe(115);
    expect(r.sections.find((s) => s.key === "P")?.amount).toBe(100);
  });
});
it("ne certifie pas une recette à zéro lorsqu’un tarif utilisé est manquant", () => {
  const result = buildPublicFinance({
    ...base,
    source: { source_type: "bordero_sales", gross_revenue: 0 },
    prices: [],
  });
  expect(result.producerDl).toBeNull();
  expect(result.net).toBeNull();
});
describe("droits et validation serveur", () => {
  it("refuse tout accès sans JWT avant de lire la base", async () => {
    let calls = 0;
    const handler = createHandler(
      { url: "https://example.supabase.co", anonKey: "public" },
      async () => {
        calls++;
        throw Error();
      },
    );
    const r = await handler(
      new Request("https://example.test", { method: "POST", body: "{}" }),
    );
    expect(r.status).toBe(401);
    expect(calls).toBe(0);
  });
  it("valide les UUID et périodes avant les requêtes", () => {
    expect(() => validateScope({ workspaceId: "elsewhere" })).toThrow();
    expect(() =>
      validateScope({ workspaceId: id, from: "2026-02-31" }),
    ).toThrow();
    expect(() =>
      validateScope({ workspaceId: id, from: "2026-12-01", to: "2026-11-01" }),
    ).toThrow();
  });
  it("un lecteur ou partenaire ne reçoit jamais le plateau du producteur", () => {
    expect(
      canReadPlateau(
        { role: "viewer", canViewBordereau: true },
        { owner_org_id: "o" },
        { organization_id: "o" },
        { orgKind: "producer" },
      ),
    ).toBe(false);
    expect(
      canReadPlateau(
        { role: "workspace_admin", canViewBordereau: true },
        { owner_org_id: "other" },
        { organization_id: "o" },
        { orgKind: "promoter", canViewPlateauOwn: true },
      ),
    ).toBe(false);
  });
  it("un promoteur doit posséder le projet et le droit dédié", () => {
    const args = [
      { role: "workspace_admin", canViewBordereau: true },
      { owner_org_id: "o" },
      { organization_id: "o" },
    ] as const;
    expect(
      canReadPlateau(...args, { orgKind: "promoter", canViewPlateauOwn: true }),
    ).toBe(true);
    expect(
      canReadPlateau(...args, {
        orgKind: "promoter",
        canViewPlateauOwn: false,
      }),
    ).toBe(false);
  });
});

describe("contrat serveur complet avec sources simulées", () => {
  const workspaceId = "22222222-2222-4222-8222-222222222222";
  const projectId = "33333333-3333-4333-8333-333333333333";
  function fixture(allow = true) {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer caller-session",
      );
      expect(new Headers(init?.headers).get("apikey")).toBe("public-key");
      let payload: unknown = [];
      if (url.pathname === "/auth/v1/user") payload = { id };
      else if (url.pathname.endsWith("get_my_account_lifecycle"))
        payload = { success: true, account_status: "active" };
      else if (url.pathname.endsWith("mobile_dashboard_date_capabilities"))
        payload = [
          {
            event_date_id: id,
            capabilities: { role: "viewer", canViewBordereau: allow },
          },
        ];
      else if (url.pathname.endsWith("mobile_dashboard_finance_inputs"))
        payload = {
          capabilities: [
            {
              event_date_id: id,
              capabilities: { role: "viewer", canViewBordereau: allow },
            },
          ],
          sales: allow
            ? base.sales.map((s) => ({ ...s, event_date_id: id }))
            : [],
          prices: allow
            ? base.prices.map((p) => ({ ...p, event_date_id: id }))
            : [],
          taxes: [],
          sources: allow ? [{ ...base.source, event_date_id: id }] : [],
          economic: allow
            ? [
                {
                  event_date_id: id,
                  inherited_tickets: 0,
                  revenue_visible: true,
                  continuity_state: "none",
                },
              ]
            : [],
          dates: allow
            ? [
                {
                  ...base.date,
                  workspace_id: workspaceId,
                  project_id: projectId,
                  tour_id: null,
                  date: "2026-11-14",
                },
              ]
            : [],
          projects: allow
            ? [
                {
                  id: projectId,
                  workspace_id: workspaceId,
                  vat_rate: 5.5,
                  tax_profile: [],
                },
              ]
            : [],
        };
      else if (url.pathname.endsWith("/projects")) {
        expect(url.searchParams.get("workspace_id")).toBe("eq." + workspaceId);
        payload = [
          {
            id: projectId,
            workspace_id: workspaceId,
            vat_rate: 5.5,
            tax_profile: [],
          },
        ];
      } else if (url.pathname.endsWith("/event_dates"))
        payload = [
          {
            ...base.date,
            workspace_id: workspaceId,
            project_id: projectId,
            tour_id: null,
            date: "2026-11-14",
          },
        ];
      else if (url.pathname.endsWith("/sales"))
        payload = base.sales.map((s) => ({ ...s, event_date_id: id }));
      else if (url.pathname.endsWith("/ticket_prices"))
        payload = base.prices.map((p) => ({ ...p, event_date_id: id }));
      else if (url.pathname.endsWith("/v_event_date_sales_current_canonical"))
        payload = [{ ...base.source, event_date_id: id }];
      else if (url.pathname.endsWith("/workspaces"))
        payload = [{ id: workspaceId, organization_id: "org" }];
      else if (url.pathname.endsWith("/workspace-billing-context"))
        payload = { entitlements: { orgKind: "producer" } };
      else if (url.pathname.endsWith("/bordereau_cost_items"))
        payload = [
          {
            event_date_id: id,
            group_code: "E",
            cell_code: "E01",
            quantity: 1,
            total: 999,
          },
        ];
      return new Response(JSON.stringify(payload), { status: 200 });
    };
    return {
      handler: createHandler(
        { url: "https://example.supabase.co", anonKey: "public-key" },
        fetcher,
      ),
      calls,
    };
  }
  function req(event = false) {
    return new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer caller-session" },
      body: JSON.stringify({
        action: "finance",
        scope: { workspaceId, ...(event ? { eventId: id } : {}) },
      }),
    });
  }
  it("un résumé global ne lit aucune source de plateau ou de personnel", async () => {
    const { handler, calls } = fixture();
    const r = await handler(req());
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.dates[0].net).toBe(947.87);
    expect(body.dates[0].sections).toEqual([]);
    expect(
      calls.some((s) =>
        /staff|hotel|tour_cost|bordereau_cost|communication_actions/.test(s),
      ),
    ).toBe(false);
  });
  it("une date lisible ne révèle pas E à un viewer, même si une source lui renvoie E", async () => {
    const { handler, calls } = fixture();
    const r = await handler(req(true));
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(
      body.dates[0].sections.some((s: { key: string }) => s.key === "E"),
    ).toBe(false);
    expect(body.dates[0]).not.toHaveProperty("result");
    expect(calls.some((s) => /staff|hotel|tour_cost/.test(s))).toBe(false);
  });
  it("les droits sont vérifiés avant toute lecture financière brute", async () => {
    const { handler, calls } = fixture(false);
    const r = await handler(req(true));
    expect((await r.json()).dates).toEqual([]);
    expect(
      calls.some(
        (s) =>
          s.endsWith("/sales") ||
          s.endsWith("/ticket_prices") ||
          s.endsWith("/bordereau_cost_items"),
      ),
    ).toBe(false);
  });
});
