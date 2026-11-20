import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ table: vi.fn(), rpc: vi.fn() }));
vi.mock("../src/client", () => calls);
import { loadHotelFinance, loadHotelRooming } from "../src/hotelApi";
import type { HotelStay } from "../src/hotels";
const stay = {
  id: "s",
  workspace_id: "w",
  project_id: "p",
  roadbook_entry_id: "e",
} as HotelStay;
const signal = new AbortController().signal;
beforeEach(() => vi.resetAllMocks());
it("does not read schedule amounts without an authorized accounting parent", async () => {
  calls.table.mockResolvedValue([]);
  expect(await loadHotelFinance(stay, signal)).toMatchObject({
    commitment: null,
    payments: [],
  });
  expect(calls.table).toHaveBeenCalledTimes(1);
});
it("bounds every amount read to workspace, project and persistent stay identity", async () => {
  calls.table
    .mockResolvedValueOnce([{ id: "parent", source_id: "s" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  await loadHotelFinance(stay, signal);
  expect(calls.table.mock.calls[1]?.[1]).toMatchObject({
    workspace_id: "eq.w",
    project_id: "eq.p",
    hotel_stay_id: "eq.s",
  });
});
it("does not fall back to a broader rooming read after server refusal", async () => {
  calls.table.mockResolvedValue([
    { id: "e", tour_day_id: "d", event_date_id: null },
  ]);
  calls.rpc.mockResolvedValue({ code: "FORBIDDEN" });
  await expect(loadHotelRooming(stay, signal)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(calls.rpc).toHaveBeenCalledTimes(1);
  expect(calls.table).toHaveBeenCalledTimes(1);
});
it("rejects ambiguous day linkage and a response for another hotel", async () => {
  calls.table
    .mockResolvedValueOnce([
      { id: "e", tour_day_id: null, event_date_id: "date" },
    ])
    .mockResolvedValueOnce([{ id: "d1" }, { id: "d2" }]);
  await expect(loadHotelRooming(stay, signal)).rejects.toMatchObject({
    code: "NOT_AVAILABLE",
  });
  expect(calls.rpc).not.toHaveBeenCalled();
  calls.table.mockResolvedValue([{ id: "e", tour_day_id: "d" }]);
  calls.rpc.mockResolvedValue({ code: "OK", entry_id: "other", rooms: [] });
  await expect(loadHotelRooming(stay, signal)).rejects.toMatchObject({
    code: "CONTRACT",
  });
});

it("reads only the monetary invoice projection from the protected view", async () => {
  calls.table
    .mockResolvedValueOnce([{ id: "parent", source_id: "s" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  await loadHotelFinance(stay, signal);
  const [name, params] = calls.table.mock.calls[2]!;
  expect(name).toBe("roadbook_entries_with_financials");
  expect(params).toMatchObject({
    id: "eq.e",
    workspace_id: "eq.w",
    type: "eq.hotel",
  });
  expect(params.select).toContain("room_rates:details->room_rates");
  expect(params.select).not.toContain("rooming_list");
  expect(params.select).not.toContain("invoice_note");
  expect(params.select).not.toContain("ops_note");
});
