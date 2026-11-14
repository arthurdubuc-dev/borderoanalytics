import { it, expect } from "vitest";
import { mapCurrentSales } from "../src/salesMapping";
const meta = [
  {
    id: "event",
    project_id: "project",
    name: "Date",
    date: "2026-11-14",
    status: "confirmed",
    deal_type: "ticketing",
  },
];
const economic = {
  event_date_id: "event",
  economic_tickets: 100,
  economic_gross_ttc: 5000,
  economic_revenue_ht: 4600,
  inherited_tickets: 0,
  revenue_visible: true,
  continuity_state: "none",
};
it("affiche les chiffres économiques Web sans confondre Hors DL TTC et HT", () => {
  expect(mapCurrentSales(meta, [economic])[0]).toMatchObject({
    tickets: 100,
    gross: 5000,
    horsDl: 4600,
  });
});
it("ne remplace pas une source absente ou masquée par des zéros", () => {
  expect(mapCurrentSales(meta, [])[0]).toMatchObject({
    tickets: null,
    gross: null,
    horsDl: null,
  });
  expect(
    mapCurrentSales(meta, [{ ...economic, revenue_visible: false }])[0],
  ).toMatchObject({ tickets: 100, gross: null, horsDl: null });
});
it("ne montre pas de recette attribuée sur une continuité non résolue", () => {
  for (const override of [
    { continuity_state: "pending_decision" },
    { attribution_status: "inherited_ambiguous" },
  ])
    expect(
      mapCurrentSales(meta, [{ ...economic, ...override }])[0],
    ).toMatchObject({ tickets: null, gross: null, horsDl: null });
});
it("préserve le stock économique hérité sans inventer ses DL", () => {
  expect(
    mapCurrentSales(meta, [{ ...economic, inherited_tickets: 20 }])[0],
  ).toMatchObject({ tickets: 100, gross: 5000, horsDl: null, inherited: 20 });
});
it("ne confond pas une fréquentation de cession avec les billets vendus", () => {
  expect(
    mapCurrentSales([{ ...meta[0], deal_type: "cession" }], [economic])[0],
  ).toMatchObject({ tickets: null, gross: null, horsDl: null });
});
