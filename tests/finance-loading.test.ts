import { it, expect } from "vitest";
import { createHandler } from "../supabase/functions/mobile-dashboard/handler";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  workspace = "33333333-3333-4333-8333-333333333333";
it("une recette de date ne vérifie pas les autres dates et borne les vues aux dates autorisées", async () => {
  const calls: URL[] = [];
  let capabilityCount = 0;
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
        data = [{ id, workspace_id: workspace, tax_profile: [] }];
      else if (url.pathname.endsWith("/event_dates"))
        data = [
          { id, project_id: id, date: "2026-11-14" },
          { id: other, project_id: id, date: "2026-11-15" },
        ];
      else if (url.pathname.endsWith("/get_date_capabilities")) {
        capabilityCount++;
        expect(JSON.parse(String(init?.body))._event_date_id).toBe(id);
        data = { canViewBordereau: true, role: "viewer" };
      } else if (url.pathname.endsWith("/sales"))
        data = [{ ticket_price_id: id, event_date_id: id, quantity: 10 }];
      else if (url.pathname.endsWith("/ticket_prices"))
        data = [
          {
            id,
            event_date_id: id,
            price_ht: 100,
            dl_producer: 5,
            dl_venue: 2,
            dl_distribution: 3,
          },
        ];
      else if (url.pathname.endsWith("/v_event_date_sales_current_canonical"))
        data = [
          {
            event_date_id: id,
            source_type: "bordero_sales",
            gross_revenue: 1100,
          },
        ];
      return new Response(JSON.stringify(data));
    },
  );
  const response = await handler(
    new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-session" },
      body: JSON.stringify({
        action: "finance",
        sections: false,
        scope: { workspaceId: workspace, eventId: id },
      }),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.dates[0].producerDl).toBe(1035);
  expect(body.dates[0].sections).toEqual([]);
  expect(capabilityCount).toBe(1);
  for (const view of [
    "v_event_date_sales_current_canonical",
    "v_event_date_sales_economic_current",
  ]) {
    const call = calls.find((u) => u.pathname.endsWith("/" + view));
    expect(call?.searchParams.get("event_date_id")).toBe("in.(" + id + ")");
    expect(call?.searchParams.get("order")).toBe("event_date_id.asc");
  }
  expect(
    calls.some((u) =>
      /plateau|staff|hotel|billing|communication|bordereau_cost/.test(
        u.pathname,
      ),
    ),
  ).toBe(false);
});
