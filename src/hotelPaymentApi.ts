import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { supabase, rpc, table, mutateHotelPayment } from "./client";
import { ReadError } from "./readPolicy";
import { PaymentRejected } from "./paymentErrors";
import {
  assertPendingScope,
  createHotelPaymentWriter,
  type PaymentScope,
  type PendingHotelPayment,
  type PendingPaymentStore,
  type HotelSettlement,
} from "./hotelPaymentOperations";
import { toCents } from "./canonical/hotels/settlementJustification";
import { isHistoricalPaid } from "./canonical/hotels/hotelPaymentPlan";
import type { HotelStay } from "./hotels";
import type { HotelFinanceSnapshot } from "./hotelApi";
export async function loadHotelPaymentAccess(
  workspaceId: string,
  signal: AbortSignal,
) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ReadError("SESSION");
  const allowed = await rpc<boolean>(
    "workspace_has_internal_permission",
    {
      _user_id: data.user.id,
      _workspace_id: workspaceId,
      _domain: "finance",
      _section: "budget_global",
      _action: "write",
    },
    signal,
  );
  return { userId: data.user.id, canWrite: allowed === true };
}
export async function loadHotelSettlements(
  stay: HotelStay,
  finance: HotelFinanceSnapshot,
  signal: AbortSignal,
): Promise<HotelSettlement[]> {
  if (!finance.commitment || finance.commitment.source_id !== stay.id)
    return [];
  for (const line of finance.payments) {
    if (line.status === "cancelled") continue;
    const amount = Number(line.amount),
      paid = Number(line.paid_amount);
    if (
      line.amount === null ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (!isHistoricalPaid(line) &&
        (line.paid_amount === null ||
          !Number.isFinite(paid) ||
          paid < 0 ||
          paid > amount))
    )
      throw new ReadError("CONTRACT");
  }
  const ids = finance.payments
    .filter((p) => p.status !== "cancelled")
    .map((p) => p.id);
  if (!ids.length) return [];
  const rows = await table<HotelSettlement & { source_type: string }>(
    "payment_settlements",
    {
      select:
        "id,workspace_id,payment_tracking_id,source_type,source_id,amount,paid_at,payment_method,status",
      workspace_id: `eq.${stay.workspace_id}`,
      payment_tracking_id: `eq.${finance.commitment.id}`,
      source_type: "eq.hotel_payment_schedule",
      source_id: `in.(${ids.join(",")})`,
      status: "eq.posted",
      order: "paid_at.desc,id.asc",
    },
    signal,
  );
  const sums = new Map<string, number>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (
      row.workspace_id !== stay.workspace_id ||
      row.payment_tracking_id !== finance.commitment.id ||
      row.source_type !== "hotel_payment_schedule" ||
      !ids.includes(row.source_id) ||
      row.status !== "posted" ||
      !Number.isFinite(Number(row.amount)) ||
      Number(row.amount) <= 0 ||
      seen.has(row.id)
    )
      throw new ReadError("CONTRACT");
    seen.add(row.id);
    sums.set(
      row.source_id,
      (sums.get(row.source_id) ?? 0) + toCents(row.amount),
    );
  }
  for (const line of finance.payments) {
    if (line.status === "cancelled" || isHistoricalPaid(line)) continue;
    if (
      line.paid_amount === null ||
      toCents(line.paid_amount) !== (sums.get(line.id) ?? 0)
    )
      throw new ReadError("SOURCE_UNAVAILABLE");
  }
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}
function storageKey(scope: PaymentScope) {
  return `bordero-hotel-payment-${scope.userId}.${scope.workspaceId}.${scope.stayId}`;
}
export const pendingHotelPayments: PendingPaymentStore = {
  async read(scope) {
    const raw = await SecureStore.getItemAsync(storageKey(scope));
    if (!raw) return null;
    let data: PendingHotelPayment;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new PaymentRejected(
        "Une tentative conservée est illisible. Vérifie les règlements dans Bordero Web.",
      );
    }
    assertPendingScope(data, scope);
    return data;
  },
  async write(operation) {
    await SecureStore.setItemAsync(
      storageKey(operation),
      JSON.stringify(operation),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  },
  async clear(scope) {
    await SecureStore.deleteItemAsync(storageKey(scope));
  },
};
export function hotelPaymentWriter() {
  return createHotelPaymentWriter({
    store: pendingHotelPayments,
    uuid: () => Crypto.randomUUID(),
    mutate: (name, signal, body, userId) =>
      mutateHotelPayment(name, signal, body, userId),
  });
}
