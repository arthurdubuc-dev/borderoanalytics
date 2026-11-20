import { expect, it } from "vitest";
import { projectHotelInvoice } from "../src/hotelInvoice";
const invoice = {
  financials_updated_at: "2026-11-20T12:00:00Z",
  total_ttc: 224,
  nights: 1,
  room_rates: [
    {
      id: "r",
      room_type: "DOUBLE",
      qty: 2,
      price_ttc_per_room: 100,
      vat_rate: 10,
      is_comped: false,
    },
  ],
  occupants: 2,
  city_tax_rate_pppn: 2,
  has_breakfast: true,
  breakfast_ttc_per_person: 10,
  breakfast_people: 2,
};
it("reuses the Web invoice calculator for rooms, breakfast, city tax and VAT", () => {
  const result = projectHotelInvoice(invoice);
  expect(result.total).toBe(224);
  expect(result.summary).toMatchObject({
    roomsTTC: 200,
    breakfastTTC: 20,
    cityTax: 4,
    totalTTC: 224,
    totalHT: 204,
  });
  expect(result.warning).toBeNull();
});
it("does not reveal amounts when the protected financial row is absent", () => {
  expect(
    projectHotelInvoice({ ...invoice, financials_updated_at: null }),
  ).toMatchObject({ total: null, summary: null });
});
it("keeps a recorded invoice total without inventing missing item prices", () => {
  expect(
    projectHotelInvoice({ financials_updated_at: "now", total_ttc: 224 }),
  ).toMatchObject({ total: 224, summary: null });
});
it("rejects contradictory detail, missing quantities and malformed rate rows without zero substitution", () => {
  expect(projectHotelInvoice({ ...invoice, total_ttc: 999 })).toMatchObject({
    total: 999,
    summary: null,
  });
  expect(
    projectHotelInvoice({
      ...invoice,
      room_rates: [{ qty: 2, price_ttc_per_room: null }],
    }).summary,
  ).toBeNull();
  expect(
    projectHotelInvoice({ ...invoice, room_rates: [null] }).summary,
  ).toBeNull();
});
