import { beforeEach, it, expect, vi } from "vitest";
const calls = vi.hoisted(() => ({
  rpc: vi.fn(),
  table: vi.fn(),
  request: vi.fn(),
}));
vi.mock("../src/client", () => calls);
import { loadDates, financials } from "../src/api";
const signal = new AbortController().signal;
beforeEach(() => vi.resetAllMocks());
it("la première ouverture lit les métadonnées puis la lecture économique Web, sans lancer les vues lourdes", async () => {
  calls.table.mockResolvedValue([
    {
      id: "date",
      project_id: "project",
      date: "2026-11-14",
      status: "confirmed",
      deal_type: "ticketing",
    },
  ]);
  calls.rpc.mockResolvedValue([
    {
      event_date_id: "date",
      economic_tickets: 10,
      economic_gross_ttc: 1100,
      economic_revenue_ht: 1000,
      inherited_tickets: 0,
      revenue_visible: true,
      continuity_state: "none",
    },
  ]);
  const rows = await loadDates(
    "workspace",
    [
      {
        id: "project",
        workspace_id: "workspace",
        name: "Projet",
        season: null,
      },
    ],
    signal,
  );
  expect(rows[0]).toMatchObject({ tickets: 10, gross: 1100, horsDl: 1000 });
  expect(calls.table).toHaveBeenCalledTimes(1);
  expect(calls.table.mock.calls[0]?.[0]).toBe("event_dates");
  expect(calls.rpc).toHaveBeenCalledExactlyOnceWith(
    "get_event_dates_economic_sales",
    { p_event_date_ids: ["date"] },
    signal,
  );
});
it("une réponse économique invalide ne devient pas une liste de zéros", async () => {
  calls.table.mockResolvedValue([{ id: "date", project_id: "project" }]);
  calls.rpc.mockResolvedValue({ error: "unavailable" });
  await expect(
    loadDates(
      "workspace",
      [
        {
          id: "project",
          workspace_id: "workspace",
          name: "Projet",
          season: null,
        },
      ],
      signal,
    ),
  ).rejects.toThrow("CONTRACT");
});
it("la préparation des quatre recettes demande explicitement un résumé sans plateau", async () => {
  calls.request.mockResolvedValue({ schema_version: "1.0", dates: [] });
  await financials({ workspaceId: "workspace" }, signal, false);
  expect(calls.request).toHaveBeenCalledExactlyOnceWith(
    "/functions/v1/mobile-dashboard",
    signal,
    { action: "finance", scope: { workspaceId: "workspace" }, sections: false },
  );
});
