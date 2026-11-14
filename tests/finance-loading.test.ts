import { it, expect } from "vitest";
import { createHandler } from "../supabase/functions/mobile-dashboard/handler";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  workspace = "33333333-3333-4333-8333-333333333333";
function fixture(
  options: { allow?: boolean; missingEconomic?: boolean; moved?: boolean } = {},
) {
  const calls: URL[] = [];
  const allow = options.allow !== false;
  const handler = createHandler(
    { url: "https://example.supabase.co", anonKey: "public" },
    async (input, init) => {
      const url = new URL(String(input));
      calls.push(url);
      let data: unknown = [];
      if (url.pathname === "/auth/v1/user") data = { id };
      else if (url.pathname.endsWith("/get_my_account_lifecycle"))
        data = { success: true, account_status: "active" };
      else if (url.pathname.endsWith("/projects"))
        data = [{ id, workspace_id: workspace, vat_rate: 20, tax_profile: [] }];
      else if (url.pathname.endsWith("/event_dates"))
        data = [
          { id, workspace_id: workspace, project_id: id, date: "2026-11-14" },
          {
            id: other,
            workspace_id: workspace,
            project_id: id,
            date: "2026-11-15",
          },
        ];
      else if (url.pathname.endsWith("/mobile_dashboard_finance_inputs")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          p_workspace_id: workspace,
          p_event_date_ids: [id],
        });
        data = {
          capabilities: [
            {
              event_date_id: id,
              capabilities: { canViewBordereau: allow, role: "viewer" },
            },
          ],
          dates: allow
            ? [
                {
                  id,
                  workspace_id: workspace,
                  project_id: options.moved ? other : id,
                  date: "2026-11-14",
                  tour_id: null,
                  vat_rate: 5.5,
                  deal_type: "ticketing",
                  dl_promoter_pct: 30,
                  status: "confirmed",
                },
              ]
            : [],
          projects: allow
            ? [{ id, workspace_id: workspace, vat_rate: 5.5, tax_profile: [] }]
            : [],
          sales: allow
            ? [{ ticket_price_id: id, event_date_id: id, quantity: 10 }]
            : [],
          prices: allow
            ? [
                {
                  id,
                  event_date_id: id,
                  price_ht: 100,
                  dl_producer: 5,
                  dl_venue: 2,
                  dl_distribution: 3,
                },
              ]
            : [],
          taxes: [],
          sources: allow
            ? [
                {
                  event_date_id: id,
                  source_type: "bordero_sales",
                  gross_revenue: 1100,
                },
              ]
            : [],
          economic:
            allow && !options.missingEconomic
              ? [
                  {
                    event_date_id: id,
                    inherited_tickets: 0,
                    revenue_visible: true,
                    continuity_state: "none",
                  },
                ]
              : [],
        };
      }
      return new Response(JSON.stringify(data));
    },
  );
  const request = () =>
    handler(
      new Request("https://example.test", {
        method: "POST",
        headers: { Authorization: "Bearer test-session" },
        body: JSON.stringify({
          action: "finance",
          sections: false,
          scope: { workspaceId: workspace, projectId: id, eventId: id },
        }),
      }),
    );
  return { request, calls };
}
it("charge les quatre recettes dès le premier appel avec une seule lecture atomique", async () => {
  const { request, calls } = fixture();
  const response = await request();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.dates[0]).toMatchObject({
    gross: 1100,
    horsDl: 1000,
    producerDl: 1035,
    net: 947.87,
    sections: [],
  });
  expect(calls).toHaveLength(5);
  expect(
    calls.filter((u) =>
      u.pathname.endsWith("/mobile_dashboard_finance_inputs"),
    ),
  ).toHaveLength(1);
  expect(
    calls.some((u) =>
      /get_date_capabilities|plateau|staff|hotel|billing|communication|bordereau_cost|v_event_date_sales_/.test(
        u.pathname,
      ),
    ),
  ).toBe(false);
});
it("ne mélange pas le taux initial avec les données du snapshot", async () => {
  const { request } = fixture();
  const body = await (await request()).json();
  expect(body.dates[0].net).toBe(947.87);
});
it("ne transforme pas une continuité indisponible en recette calculable", async () => {
  const { request } = fixture({ missingEconomic: true });
  const body = await (await request()).json();
  expect(body.dates[0].producerDl).toBeNull();
  expect(body.dates[0].net).toBeNull();
});
it("respecte les refus d’accès du snapshot sans réutiliser des lignes antérieures", async () => {
  const { request } = fixture({ allow: false });
  expect((await (await request()).json()).dates).toEqual([]);
});
it("exclut une date déplacée hors du projet pendant le chargement", async () => {
  const { request } = fixture({ moved: true });
  expect((await (await request()).json()).dates).toEqual([]);
});

it("borne les lectures de nombreuses dates à 20 par lot et deux lots simultanés", async () => {
  const makeId = (i: number) =>
    "00000000-0000-4000-8000-" + (i + 1).toString(16).padStart(12, "0");
  const dates = Array.from({ length: 41 }, (_, i) => ({
    id: makeId(i),
    workspace_id: workspace,
    project_id: id,
    date: "2026-11-14",
  }));
  const batches: string[][] = [];
  let active = 0,
    max = 0;
  const handler = createHandler(
    { url: "https://example.supabase.co", anonKey: "public" },
    async (input, init) => {
      const path = new URL(String(input)).pathname;
      let value: unknown = [];
      if (path === "/auth/v1/user") value = { id };
      else if (path.endsWith("/get_my_account_lifecycle"))
        value = { success: true, account_status: "active" };
      else if (path.endsWith("/projects"))
        value = [{ id, workspace_id: workspace }];
      else if (path.endsWith("/event_dates")) value = dates;
      else if (path.endsWith("/mobile_dashboard_finance_inputs")) {
        const ids = JSON.parse(String(init?.body)).p_event_date_ids as string[];
        batches.push(ids);
        max = Math.max(max, ++active);
        await new Promise((r) => setTimeout(r, 1));
        active--;
        value = {
          capabilities: [],
          sales: [],
          prices: [],
          taxes: [],
          sources: [],
          economic: [],
          dates: [],
          projects: [],
        };
      }
      return new Response(JSON.stringify(value));
    },
  );
  const response = await handler(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-session" },
      body: JSON.stringify({
        action: "finance",
        sections: false,
        scope: { workspaceId: workspace },
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(batches.map((b) => b.length)).toEqual([20, 20, 1]);
  expect(max).toBe(2);
  expect(new Set(batches.flat()).size).toBe(41);
});
