import { describe, it, expect } from "vitest";
import {
  compact,
  exact,
  sumKnown,
  filterDates,
  type DateSummary,
} from "../src/domain";
describe("KPI compacts sans modification de la valeur source", () => {
  it.each([
    [153687.13, "153k €"],
    [999999, "999k €"],
    [1000000, "1M €"],
    [3456789012, "3Md €"],
    [-153687.13, "-153k €"],
  ])("%s → %s", (v, expected) =>
    expect(compact(Number(v), true)).toBe(expected),
  );
  it("préserve les cents, valeurs nulles, vrais zéros et billets entiers", () => {
    expect(exact(153687.13, true).replace(/\s/g, " ")).toBe("153 687,13 €");
    expect(compact(null)).toBe("—");
    expect(compact(0)).toBe("0");
    expect(compact(153687)).toBe("153k");
  });
  it("additionne en centimes et ne certifie pas un total incomplet", () => {
    expect(sumKnown([0.1, 0.2])).toBe(0.3);
    expect(sumKnown([1, null])).toBeNull();
    expect(sumKnown([])).toBeNull();
  });
});
describe("périmètres", () => {
  const rows = [
    { id: "a", projectId: "p", tourId: null, day: "2026-11-01" },
    { id: "b", projectId: "p", tourId: "t", day: "2026-11-15" },
    { id: "c", projectId: "q", tourId: "z", day: "2026-12-01" },
  ] as DateSummary[];
  it("ne replie pas hors tournée sur toutes les tournées", () =>
    expect(
      filterDates(rows, { workspaceId: "w", projectId: "p", tourId: null }).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]));
  it("applique simultanément projet, tournée et bornes", () =>
    expect(
      filterDates(rows, {
        workspaceId: "w",
        projectId: "p",
        tourId: "t",
        from: "2026-11-10",
        to: "2026-11-20",
      }).map((r) => r.id),
    ).toEqual(["b"]));
});

import {observedWeek} from '../src/domain';
describe('dynamique globale observée',()=>{
 const days=Array.from({length:7},(_,i)=>({day:`2026-11-${String(i+1).padStart(2,'0')}`,tickets:i===3?-2:10,gross_revenue_ttc:100,span_days:1,status:'observed'}));
 it('préserve les corrections négatives et additionne seulement la fenêtre complète',()=>expect(observedWeek({sales:{days}},'2026-11-01','2026-11-07')).toEqual({tickets:58,gross:700}));
 it('ne fabrique pas un total sur une période ou un intervalle incomplet',()=>{expect(observedWeek({sales:{days:days.slice(1)}},'2026-11-01','2026-11-07')).toBeNull();expect(observedWeek({sales:{days:days.map((d,i)=>i===0?{...d,span_days:2}:d)}},'2026-11-01','2026-11-07')).toBeNull();});
});
