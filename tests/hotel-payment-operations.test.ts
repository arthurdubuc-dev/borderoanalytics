import { beforeEach, expect, it, vi } from "vitest";
import {
  createHotelPaymentWriter,
  HotelPaymentOperationError,
  parsePaymentAmount,
  parsePaymentDate,
  validatePaymentInput,
  paymentCap,
  type PendingHotelPayment,
  type PaymentScope,
  type PaymentInput,
  type PendingPaymentStore,
  type HotelSettlement,
} from "../src/hotelPaymentOperations";
import { PaymentRejected } from "../src/paymentErrors";
import { ReadError } from "../src/readPolicy";
import type { HotelPayment } from "../src/hotels";
const id = (n: number) =>
  `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const scope: PaymentScope = {
  userId: id(1),
  workspaceId: id(2),
  projectId: id(3),
  stayId: id(4),
};
const input: PaymentInput = {
  kind: "record",
  scheduleId: id(5),
  settlementId: null,
  amount: 123.45,
  paidOn: "2026-11-20",
  method: "Carte",
  reason: "",
};
function ack(replayed = false) {
  return {
    schedule: {
      id: id(5),
      hotel_stay_id: id(4),
      workspace_id: id(2),
      project_id: id(3),
    },
    settlement_id: id(7),
    parent_id: id(8),
    replayed,
  };
}
function setup() {
  let saved: PendingHotelPayment | null = null;
  const store: PendingPaymentStore = {
    read: vi.fn(async () => saved),
    write: vi.fn(async (value) => {
      saved = { ...value };
    }),
    clear: vi.fn(async () => {
      saved = null;
    }),
  };
  const mutate = vi.fn<
    (
      name: string,
      signal: AbortSignal,
      body: Record<string, unknown>,
      userId: string,
    ) => Promise<ReturnType<typeof ack>>
  >(async () => ack());
  const uuid = vi.fn(() => id(6));
  const deps = { store, mutate, uuid };
  return {
    store,
    mutate,
    uuid,
    deps,
    writer: createHotelPaymentWriter(deps),
    pending: () => saved,
  };
}
const signal = () => new AbortController().signal;
it("records with the Web RPC, real date, method, explicit amount and a persisted idempotency key", async () => {
  const s = setup();
  await s.writer.submit(scope, input, signal());
  expect(s.mutate).toHaveBeenCalledExactlyOnceWith(
    "mark_hotel_payment_paid",
    expect.any(AbortSignal),
    {
      p_workspace_id: id(2),
      p_schedule_id: id(5),
      p_paid_on: "2026-11-20",
      p_method: "Carte",
      p_request_key: id(6),
      p_amount: 123.45,
    },
    id(1),
  );
  expect(s.pending()).toBeNull();
  expect(s.store.write).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ sent: false }),
  );
  expect(s.store.write).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ sent: true }),
  );
});
it("corrects a specifically selected settlement atomically with a mandatory reason", async () => {
  const s = setup();
  await s.writer.submit(
    scope,
    {
      ...input,
      kind: "correct",
      settlementId: id(9),
      reason: "Moyen de paiement corrigé",
    },
    signal(),
  );
  expect(s.mutate.mock.calls[0]?.[0]).toBe("correct_hotel_payment_paid");
  expect(s.mutate.mock.calls[0]?.[2]).toMatchObject({
    p_settlement_id: id(9),
    p_reason: "Moyen de paiement corrigé",
    p_amount: 123.45,
  });
});
it("recovers the same request after a lost response and simulated app restart without a second settlement", async () => {
  const s = setup();
  let recorded = false,
    count = 0;
  s.mutate.mockImplementation(async () => {
    if (!recorded) {
      recorded = true;
      count++;
      throw new ReadError("NETWORK");
    }
    return ack(true);
  });
  await expect(s.writer.submit(scope, input, signal())).rejects.toMatchObject({
    uncertain: true,
  });
  expect(s.pending()?.sent).toBe(true);
  const restored = createHotelPaymentWriter(s.deps);
  expect((await restored.submit(scope, null, signal())).replayed).toBe(true);
  expect(s.mutate.mock.calls[1]?.[2]).toEqual(s.mutate.mock.calls[0]?.[2]);
  expect(count).toBe(1);
  expect(s.uuid).toHaveBeenCalledTimes(1);
  expect(s.pending()).toBeNull();
});
it("does not allow a different amount or method while a sent request is unresolved", async () => {
  const s = setup();
  s.mutate.mockRejectedValue(new ReadError("NETWORK"));
  await expect(s.writer.submit(scope, input, signal())).rejects.toBeInstanceOf(
    HotelPaymentOperationError,
  );
  await expect(
    s.writer.submit(scope, { ...input, amount: 99 }, signal()),
  ).rejects.toMatchObject({ uncertain: true });
  expect(s.mutate).toHaveBeenCalledTimes(1);
  expect(s.pending()?.amount).toBe(123.45);
});
it("retains an uncertain request even if a later recovery attempt loses finance permissions", async () => {
  const s = setup();
  s.mutate
    .mockRejectedValueOnce(new ReadError("NETWORK"))
    .mockRejectedValueOnce(new PaymentRejected("Accès refusé"));
  await expect(s.writer.submit(scope, input, signal())).rejects.toMatchObject({
    uncertain: true,
  });
  await expect(s.writer.submit(scope, null, signal())).rejects.toMatchObject({
    uncertain: true,
  });
  expect(s.pending()?.requestKey).toBe(id(6));
});
it("clears a first definitive server refusal, but never sends when durable storage fails", async () => {
  const s = setup();
  s.mutate.mockRejectedValue(new PaymentRejected("Montant refusé"));
  await expect(s.writer.submit(scope, input, signal())).rejects.toMatchObject({
    uncertain: false,
    message: "Montant refusé",
  });
  expect(s.pending()).toBeNull();
  const other = setup();
  vi.mocked(other.store.write).mockRejectedValue(new Error("locked"));
  await expect(
    other.writer.submit(scope, input, signal()),
  ).rejects.toMatchObject({ uncertain: false });
  expect(other.mutate).not.toHaveBeenCalled();
});
it("rejects a simultaneous duplicate and a response for another stay", async () => {
  const s = setup();
  let resolve!: (v: ReturnType<typeof ack>) => void;
  s.mutate.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const first = s.writer.submit(scope, input, signal());
  await vi.waitFor(() => expect(s.mutate).toHaveBeenCalledTimes(1));
  await expect(s.writer.submit(scope, input, signal())).rejects.toMatchObject({
    uncertain: false,
  });
  await expect(
    createHotelPaymentWriter(s.deps).submit(scope, input, signal()),
  ).rejects.toMatchObject({ uncertain: false });
  expect(s.mutate).toHaveBeenCalledTimes(1);
  resolve(ack());
  await first;
  const other = setup();
  other.mutate.mockResolvedValue({
    ...ack(),
    schedule: { ...ack().schedule, hotel_stay_id: id(99) },
  });
  await expect(
    other.writer.submit(scope, input, signal()),
  ).rejects.toMatchObject({ uncertain: true });
  expect(other.pending()).not.toBeNull();
});
it("keeps unresolved commands isolated to the same account, workspace, project and stay", async () => {
  const s = setup();
  s.mutate.mockRejectedValue(new ReadError("NETWORK"));
  await expect(s.writer.submit(scope, input, signal())).rejects.toMatchObject({
    uncertain: true,
  });
  s.mutate.mockClear();
  await expect(
    s.writer.submit({ ...scope, userId: id(99) }, null, signal()),
  ).rejects.toMatchObject({ uncertain: false });
  expect(s.mutate).not.toHaveBeenCalled();
});
it("validates French amounts, exact cents, real calendar dates and future payments", () => {
  expect(parsePaymentAmount("1 007,44")).toBe(1007.44);
  for (const value of ["", "-1", "1,234", "1e3", "NaN", "0"])
    expect(parsePaymentAmount(value)).toBeNull();
  expect(parsePaymentDate("20/11/2026")).toBe("2026-11-20");
  expect(parsePaymentDate("29/02/2024")).toBe("2024-02-29");
  for (const day of ["30/02/2026", "31/04/2026", "2026-02-30", "xx"])
    expect(parsePaymentDate(day)).toBeNull();
  expect(validatePaymentInput(input, 200, "2026-11-20")).toBeNull();
  expect(validatePaymentInput(input, NaN, "2026-11-20")).toContain("vérifié");
  expect(
    validatePaymentInput({ ...input, paidOn: "2026-11-21" }, 200, "2026-11-20"),
  ).toContain("futur");
  expect(validatePaymentInput(input, 100, "2026-11-20")).toContain("dépasse");
  expect(
    validatePaymentInput(
      { ...input, kind: "correct", settlementId: id(9), reason: "" },
      200,
      "2026-11-20",
    ),
  ).toContain("motif");
});
it("caps a correction to the current remaining amount plus the exact selected settlement", () => {
  const line = {
    amount: 100,
    paid_amount: 70,
    status: "pending",
    due_date: null,
  } as HotelPayment;
  expect(paymentCap(line)).toBe(30);
  expect(paymentCap(line, { amount: 20 } as HotelSettlement)).toBe(50);
});
