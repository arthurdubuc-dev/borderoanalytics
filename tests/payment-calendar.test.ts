import { expect, it } from "vitest";
import {
  paymentCalendarValue,
  paymentCalendarMaximum,
  paymentCalendarSelection,
} from "../src/paymentCalendar";
it("opens the calendar on the current payment date, clamps invalid/future initial values, and caps at Paris today", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  expect(paymentCalendarValue("19/11/2026", now).toISOString()).toBe(
    "2026-11-19T12:00:00.000Z",
  );
  for (const value of ["21/11/2026", "30/02/2026", ""])
    expect(paymentCalendarValue(value, now).toISOString()).toBe(
      "2026-11-20T12:00:00.000Z",
    );
  expect(paymentCalendarMaximum(now).toISOString()).toBe(
    "2026-11-20T12:00:00.000Z",
  );
});
it("keeps the Paris business date across midnight and daylight-saving boundaries", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  expect(paymentCalendarSelection(new Date("2026-11-19T23:30:00Z"), now)).toBe(
    "20/11/2026",
  );
  expect(paymentCalendarSelection(new Date("2026-03-28T23:30:00Z"), now)).toBe(
    "29/03/2026",
  );
  expect(paymentCalendarSelection(new Date("2026-07-01T22:30:00Z"), now)).toBe(
    "02/07/2026",
  );
});
it("never writes a future or invalid native date back into the form", () => {
  const now = new Date("2026-11-20T10:00:00Z");
  expect(
    paymentCalendarSelection(new Date("2026-11-21T12:00:00Z"), now),
  ).toBeNull();
  expect(paymentCalendarSelection(new Date(NaN), now)).toBeNull();
});
