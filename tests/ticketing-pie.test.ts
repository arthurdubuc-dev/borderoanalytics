import { expect, it } from "vitest";
import { ticketingSlices, ringPath, sliceAt } from "../src/ticketingGeometry";
it("uses all attributed ticket counts and ranks the volume leader", () => {
  const m = ticketingSlices([
    { key: "a", label: "A", tickets: 25 },
    { key: "b", label: "B", tickets: 75 },
    { key: "z", label: "Zero", tickets: 0 },
  ])!;
  expect(m.total).toBe(100);
  expect(m.slices.map((s) => s.key)).toEqual(["b", "a"]);
  expect(m.slices[0]!.share).toBe(0.75);
  expect(m.slices.at(-1)!.end).toBeCloseTo(1.5 * Math.PI);
  expect(sliceAt(m.slices, 220, 120)?.key).toBe("b");
  expect(sliceAt(m.slices, 120, 120)).toBeNull();
  expect(sliceAt(m.slices, 240, 240)).toBeNull();
});
it("rejects negative, fractional, duplicate and overflowing aggregates", () => {
  for (const tickets of [-1, 0.5, NaN, Infinity])
    expect(ticketingSlices([{ key: "a", label: "A", tickets }])).toBeNull();
  expect(
    ticketingSlices([
      { key: "a", label: "A", tickets: 2 },
      { key: "a", label: "A", tickets: 3 },
    ]),
  ).toBeNull();
  expect(
    ticketingSlices([
      { key: "a", label: "A", tickets: Number.MAX_SAFE_INTEGER },
      { key: "b", label: "B", tickets: 1 },
    ]),
  ).toBeNull();
});
it("handles empty, zero, full circle and boundary hit without invalid paths", () => {
  expect(ticketingSlices([])?.total).toBe(0);
  expect(
    ticketingSlices([{ key: "z", label: "Z", tickets: 0 }])?.slices,
  ).toEqual([]);
  const m = ticketingSlices([{ key: "a", label: "A", tickets: 1 }])!;
  expect(sliceAt(m.slices, 120, 20)?.key).toBe("a");
  expect(ringPath(0, Math.PI * 2).match(/ A/g)).toHaveLength(4);
  expect(ringPath(1, 0)).toBe("");
});
