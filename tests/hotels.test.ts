import { expect, it } from "vitest";
import {
  receptionPayment,
  stayPosition,
  groupRooms,
  type HotelPayment,
  type HotelCommitment,
} from "../src/hotels";
const day = "2026-11-20";
const base: HotelPayment = {
  id: "b",
  hotel_stay_id: "s",
  payment_type: "balance",
  label: "Solde",
  amount: 800,
  paid_amount: 0,
  status: "pending",
  due_date: day,
  settlement_id: null,
  paid_on: null,
};
const parent: HotelCommitment = {
  id: "p",
  source_id: "s",
  expected_amount: 1000,
  received_amount: 200,
  due_date: day,
  received_date: "2026-11-01",
};
const deposit: HotelPayment = {
  ...base,
  id: "d",
  payment_type: "deposit",
  amount: 200,
  paid_amount: 200,
  status: "paid",
  settlement_id: "real",
  paid_on: "2026-11-01",
};
it("shows exact remainder of plan, real deposits and amount due today without double counting", () => {
  expect(receptionPayment([deposit, base], parent, day)).toMatchObject({
    reliable: true,
    remaining: 800,
    due: 800,
    depositPaid: 200,
    paid: 200,
    hasBalance: true,
  });
  expect(
    receptionPayment(
      [deposit, { ...base, paid_amount: 100, settlement_id: "partial" }],
      { ...parent, received_amount: 300 },
      day,
    ),
  ).toMatchObject({ remaining: 700, paid: 300 });
});
it("never reports paid or zero for missing, denied, historical, invalid or inconsistent finance", () => {
  for (const [lines, p] of [
    [[], null],
    [[base], null],
    [[{ ...base, amount: null }], parent],
    [[{ ...base, status: "paid", paid_at: "2020-01-01" }], parent],
    [[{ ...base, paid_amount: 801 }], parent],
    [[base], parent],
  ] as const) {
    const result = receptionPayment(lines, p, day);
    expect(result.reliable).toBe(false);
    expect(result.remaining).toBeNull();
  }
});
it("keeps future deadlines distinct and flags an absent balance instead of claiming a settled stay", () => {
  const future = receptionPayment(
    [deposit, { ...base, due_date: "2026-12-01" }],
    parent,
    day,
  );
  expect(future.remaining).toBe(800);
  expect(future.due).toBe(0);
  const result = receptionPayment(
    [deposit],
    { ...parent, expected_amount: 200 },
    day,
  );
  expect(result.hasBalance).toBe(false);
  expect(result.reason).toContain("solde");
});
it("handles cents, cancelled lines, and a fully settled plan", () => {
  expect(
    receptionPayment(
      [{ ...base, amount: 0.3, paid_amount: 0.1 }],
      { ...parent, expected_amount: 0.3, received_amount: 0.1 },
      day,
    ).remaining,
  ).toBe(0.2);
  expect(
    receptionPayment(
      [
        deposit,
        { ...base, paid_amount: 800, settlement_id: "paid", status: "paid" },
        { ...base, id: "cancelled", amount: 999, status: "cancelled" },
      ],
      { ...parent, received_amount: 1000 },
      day,
    ),
  ).toMatchObject({ remaining: 0, paid: 1000, reliable: true });
});
it("separates departure from nights still occupied and groups by room identity rather than room type", () => {
  expect(
    stayPosition({ check_in_date: "2026-11-19", check_out_date: day }, day),
  ).toBe("departure");
  expect(
    stayPosition({ check_in_date: day, check_out_date: "2026-11-21" }, day),
  ).toBe("current");
  const rooms = groupRooms([
    { id: "a", roomId: "r", roomType: "twin", roomNumber: "12", name: "A" },
    { id: "b", roomId: "r", roomType: "twin", roomNumber: "12", name: "B" },
    { id: "c", roomId: "s", roomType: "twin", roomNumber: null, name: "C" },
  ]);
  expect(rooms).toHaveLength(2);
  expect(rooms[0]?.guests).toEqual(["A", "B"]);
});

it("ne présente pas un échéancier à zéro comme un séjour réglé", () => {
  const result = receptionPayment(
    [{ ...base, amount: 0, paid_amount: 0 }],
    { ...parent, expected_amount: 0, received_amount: 0 },
    day,
  );
  expect(result.reliable).toBe(false);
  expect(result.remaining).toBeNull();
});

it("keeps exact total, already paid and remaining together, and uses the recorded invoice when available", () => {
  const plan = receptionPayment([deposit, base], parent, day);
  expect(plan).toMatchObject({
    total: 1000,
    paid: 200,
    remaining: 800,
    totalIsInvoice: false,
  });
  const invoice = receptionPayment([deposit, base], parent, day, 900);
  expect(invoice).toMatchObject({
    total: 900,
    paid: 200,
    remaining: 700,
    totalIsInvoice: true,
    planMismatch: true,
  });
  expect(receptionPayment([deposit, base], parent, day, 100)).toMatchObject({
    reliable: false,
    remaining: null,
  });
});
