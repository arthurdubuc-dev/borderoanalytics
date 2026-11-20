import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ table: vi.fn(), rpc: vi.fn() }));
vi.mock("../src/client", () => calls);
import {
  loadHotelFinanceBatch,
  HOTEL_FINANCE_BATCH_SIZE,
} from "../src/hotelApi";
import {
  receptionPayment,
  hotelBalanceStatus,
  type HotelStay,
  type HotelPayment,
  type HotelCommitment,
} from "../src/hotels";
const stays = [
  { id: "a", workspace_id: "w", project_id: "p1", roadbook_entry_id: "ea" },
  { id: "b", workspace_id: "w", project_id: "p2", roadbook_entry_id: "eb" },
  { id: "c", workspace_id: "w", project_id: "p2", roadbook_entry_id: null },
] as HotelStay[];
const signal = new AbortController().signal;
const parents = [
  {
    id: "pa",
    source_id: "a",
    workspace_id: "w",
    project_id: "p1",
    expected_amount: 100,
    received_amount: 40,
  },
  {
    id: "pb",
    source_id: "b",
    workspace_id: "w",
    project_id: "p2",
    expected_amount: 200,
    received_amount: 200,
  },
];
const payments = [
  {
    id: "la",
    hotel_stay_id: "a",
    workspace_id: "w",
    project_id: "p1",
    payment_type: "balance",
    amount: 100,
    paid_amount: 40,
    status: "pending",
    due_date: "2026-11-20",
    settlement_id: "partial",
  },
  {
    id: "lb",
    hotel_stay_id: "b",
    workspace_id: "w",
    project_id: "p2",
    payment_type: "balance",
    amount: 200,
    paid_amount: 200,
    status: "paid",
    due_date: "2026-11-20",
    settlement_id: "paid",
  },
];
const invoices = [
  { id: "ea", financials_updated_at: "now", total_ttc: 100 },
  { id: "eb", financials_updated_at: "now", total_ttc: 200 },
];
beforeEach(() => vi.resetAllMocks());
it("reads the visible hotels in three grouped calls and uses the same financial rules as the detail", async () => {
  calls.table
    .mockResolvedValueOnce(parents)
    .mockResolvedValueOnce(payments)
    .mockResolvedValueOnce(invoices);
  const result = await loadHotelFinanceBatch(stays, signal);
  expect(calls.table).toHaveBeenCalledTimes(3);
  expect(calls.table.mock.calls[0]?.[1]).toMatchObject({
    workspace_id: "eq.w",
    project_id: "in.(p1,p2)",
    source_id: "in.(a,b,c)",
  });
  expect(calls.table.mock.calls[1]?.[1].hotel_stay_id).toBe("in.(a,b)");
  expect(calls.table.mock.calls[2]?.[1].select).toBe(
    "id,financials_updated_at,total_ttc:details->total_ttc",
  );
  const statuses = result.map((r) =>
    hotelBalanceStatus(
      receptionPayment(
        r.finance.payments,
        r.finance.commitment,
        "2026-11-20",
        r.finance.invoice.total,
      ),
    ),
  );
  expect(statuses[0]).toMatchObject({
    status: "due",
    label: "À régler",
    remaining: 60,
  });
  expect(statuses[1]).toMatchObject({
    status: "paid",
    label: "Réglé",
    remaining: 0,
  });
  expect(statuses[2]).toMatchObject({ status: "unknown", remaining: null });
});
it("never requests hidden financial schedules when accounting parents are absent", async () => {
  calls.table.mockResolvedValue([]);
  const result = await loadHotelFinanceBatch(stays, signal);
  expect(calls.table).toHaveBeenCalledTimes(1);
  expect(result.every((r) => r.finance.commitment === null)).toBe(true);
});
it("does not label a settled schedule paid when the invoice total cannot be read", async () => {
  calls.table
    .mockResolvedValueOnce(parents)
    .mockResolvedValueOnce(payments)
    .mockRejectedValueOnce(new TypeError("network"));
  const result = await loadHotelFinanceBatch(stays, signal),
    paid = result.find((r) => r.stayId === "b")!;
  expect(
    hotelBalanceStatus(
      receptionPayment(
        paid.finance.payments,
        paid.finance.commitment,
        "2026-11-20",
        paid.finance.invoice.total,
      ),
    ),
  ).toMatchObject({ status: "unknown", remaining: null });
});
it("rejects mixed workspaces, duplicate stays and oversized groups before making requests", async () => {
  for (const input of [
    [stays[0]!, { ...stays[1]!, workspace_id: "other" }],
    [stays[0]!, stays[0]!],
    Array.from({ length: HOTEL_FINANCE_BATCH_SIZE + 1 }, (_, i) => ({
      ...stays[0]!,
      id: String(i),
    })),
  ])
    await expect(loadHotelFinanceBatch(input, signal)).rejects.toMatchObject({
      code: "CONTRACT",
    });
  expect(calls.table).not.toHaveBeenCalled();
});
it("rejects an accounting parent for the wrong project and duplicate accounting parents", async () => {
  for (const rows of [
    [{ ...parents[0]!, project_id: "wrong" }],
    [parents[0]!, parents[0]!],
  ]) {
    calls.table.mockResolvedValueOnce(rows);
    await expect(loadHotelFinanceBatch(stays, signal)).rejects.toMatchObject({
      code: "CONTRACT",
    });
  }
});
it("rejects a schedule for an unauthorized stay or another workspace", async () => {
  for (const row of [
    { ...payments[0]!, hotel_stay_id: "c", project_id: "p2" },
    { ...payments[0]!, workspace_id: "other" },
  ]) {
    calls.table
      .mockResolvedValueOnce(parents)
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce(invoices);
    await expect(loadHotelFinanceBatch(stays, signal)).rejects.toMatchObject({
      code: "CONTRACT",
    });
  }
});
it("keeps incomplete, historical or contradictory figures unconfirmed", () => {
  expect(hotelBalanceStatus(null).status).toBe("unknown");
  const parent = {
    id: "p",
    source_id: "s",
    expected_amount: 100,
    received_amount: 100,
  } as HotelCommitment;
  const line = {
    id: "l",
    hotel_stay_id: "s",
    payment_type: "deposit",
    amount: 100,
    paid_amount: 100,
    status: "paid",
    settlement_id: "real",
  } as HotelPayment;
  expect(
    hotelBalanceStatus(receptionPayment([line], parent, "2026-11-20")),
  ).toMatchObject({ status: "unknown", remaining: null });
  expect(
    hotelBalanceStatus(
      receptionPayment(
        [
          {
            ...line,
            payment_type: "balance",
            paid_amount: 0,
            settlement_id: null,
            paid_at: "2020-01-01",
          },
        ],
        parent,
        "2026-11-20",
        100,
      ),
    ).status,
  ).toBe("unknown");
  expect(
    hotelBalanceStatus(
      receptionPayment(
        [{ ...line, payment_type: "balance" }],
        { ...parent, received_amount: 99 },
        "2026-11-20",
        100,
      ),
    ).status,
  ).toBe("unknown");
});
