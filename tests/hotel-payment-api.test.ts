import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  table: vi.fn(),
  mutateHotelPayment: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  deleteItem: vi.fn(),
}));
vi.mock("../src/client", () => ({
  supabase: { auth: { getUser: calls.getUser } },
  rpc: calls.rpc,
  table: calls.table,
  mutateHotelPayment: calls.mutateHotelPayment,
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: calls.getItem,
  setItemAsync: calls.setItem,
  deleteItemAsync: calls.deleteItem,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));
import {
  loadHotelPaymentAccess,
  loadHotelSettlements,
  pendingHotelPayments,
} from "../src/hotelPaymentApi";
import type { HotelStay } from "../src/hotels";
import type { HotelFinanceSnapshot } from "../src/hotelApi";
import type { PendingHotelPayment } from "../src/hotelPaymentOperations";
const signal = new AbortController().signal;
beforeEach(() => vi.resetAllMocks());
it("uses the real current auth identity and exactly the Finance write permission used on the Web", async () => {
  calls.getUser.mockResolvedValue({
    data: { user: { id: "current-user" } },
    error: null,
  });
  calls.rpc.mockResolvedValue(false);
  expect(await loadHotelPaymentAccess("workspace", signal)).toEqual({
    userId: "current-user",
    canWrite: false,
  });
  expect(calls.rpc).toHaveBeenCalledExactlyOnceWith(
    "workspace_has_internal_permission",
    {
      _user_id: "current-user",
      _workspace_id: "workspace",
      _domain: "finance",
      _section: "budget_global",
      _action: "write",
    },
    signal,
  );
});
it("never probes permissions for an invented user when no session is available", async () => {
  calls.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(
    loadHotelPaymentAccess("workspace", signal),
  ).rejects.toMatchObject({ code: "SESSION" });
  expect(calls.rpc).not.toHaveBeenCalled();
});
it("reads individual active settlements within the same authorized accounting parent and validates their total", async () => {
  const stay = { id: "s", workspace_id: "w" } as HotelStay;
  const finance = {
    commitment: { id: "p", source_id: "s" },
    payments: [{ id: "l", amount: 100, paid_amount: 30, status: "pending" }],
  } as HotelFinanceSnapshot;
  const row = {
    id: "real",
    workspace_id: "w",
    payment_tracking_id: "p",
    source_type: "hotel_payment_schedule",
    source_id: "l",
    amount: 30,
    paid_at: "2026-11-20",
    payment_method: "Carte",
    status: "posted",
  };
  calls.table.mockResolvedValue([row]);
  expect(await loadHotelSettlements(stay, finance, signal)).toHaveLength(1);
  expect(calls.table.mock.calls[0]?.[1]).toMatchObject({
    workspace_id: "eq.w",
    payment_tracking_id: "eq.p",
    source_type: "eq.hotel_payment_schedule",
    status: "eq.posted",
  });
  calls.table.mockResolvedValue([{ ...row, amount: 20 }]);
  await expect(
    loadHotelSettlements(stay, finance, signal),
  ).rejects.toMatchObject({ code: "SOURCE_UNAVAILABLE" });
  calls.table.mockResolvedValue([{ ...row, payment_tracking_id: "another" }]);
  await expect(
    loadHotelSettlements(stay, finance, signal),
  ).rejects.toMatchObject({ code: "CONTRACT" });
});
it("stores only the unresolved command under the same account and stay with device-only keychain protection", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const operation: PendingHotelPayment = {
    version: 1,
    userId: id,
    workspaceId: id,
    projectId: id,
    stayId: id,
    scheduleId: id,
    requestKey: id,
    kind: "record",
    settlementId: null,
    amount: 100,
    paidOn: "2026-11-20",
    method: "Carte",
    reason: "",
    sent: true,
  };
  await pendingHotelPayments.write(operation);
  expect(calls.setItem).toHaveBeenCalledWith(
    expect.stringContaining("bordero-hotel-payment-"),
    JSON.stringify(operation),
    { keychainAccessible: "device-only" },
  );
  calls.getItem.mockResolvedValue(JSON.stringify(operation));
  expect(await pendingHotelPayments.read(operation)).toEqual(operation);
  await expect(
    pendingHotelPayments.read({ ...operation, stayId: "other" }),
  ).rejects.toThrow("séjour");
  await pendingHotelPayments.clear(operation);
  expect(calls.deleteItem).toHaveBeenCalledTimes(1);
});

it("blocks editing when the schedule amount is invalid even if the settlement cache is zero", async () => {
  const stay = { id: "s", workspace_id: "w" } as HotelStay;
  const finance = {
    commitment: { id: "p", source_id: "s" },
    payments: [{ id: "l", amount: "NaN", paid_amount: 0, status: "pending" }],
  } as unknown as HotelFinanceSnapshot;
  await expect(
    loadHotelSettlements(stay, finance, signal),
  ).rejects.toMatchObject({ code: "CONTRACT" });
  expect(calls.table).not.toHaveBeenCalled();
});
