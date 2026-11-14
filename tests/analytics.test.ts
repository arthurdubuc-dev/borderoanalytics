import { describe, it, expect } from "vitest";
import { eventTimeline, chartWindow, periodStats } from "../src/analytics";
import type { TimelinePoint } from "../src/domain";
describe("graphiques commerciaux", () => {
  it("distingue le cumul et les nouvelles ventes par jour, y compris les corrections", () => {
    const p = eventTimeline([
      { day: "2026-11-01", gross: 100, tickets: 10 },
      { day: "2026-11-02", gross: 140, tickets: 14 },
      { day: "2026-11-03", gross: 130, tickets: 13 },
    ]);
    expect(chartWindow(p, 0, "gross", "daily").map((p) => p.value)).toEqual([
      null,
      40,
      -10,
    ]);
    expect(
      chartWindow(p, 0, "gross", "cumulative").map((p) => p.value),
    ).toEqual([100, 140, 130]);
    expect(periodStats(chartWindow(p, 0, "gross", "daily")).total).toBe(30);
  });
  it("ne répartit pas une remontée groupée et garde les trous", () => {
    const p = eventTimeline([
      { day: "2026-11-01", gross: 100, tickets: 10 },
      { day: "2026-11-04", gross: 160, tickets: 16 },
    ]);
    expect(chartWindow(p, 0, "gross", "daily").map((p) => p.value)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(
      chartWindow(p, 0, "gross", "cumulative").map((p) => p.value),
    ).toEqual([100, null, null, 160]);
  });
  it("calcule la variation avant de couper la fenêtre", () => {
    const p = eventTimeline([
      { day: "2026-11-01", gross: 100, tickets: 10 },
      { day: "2026-11-02", gross: 140, tickets: 14 },
      { day: "2026-11-03", gross: 140, tickets: 14 },
    ]);
    expect(chartWindow(p, 2, "gross", "daily").map((p) => p.value)).toEqual([
      40, 0,
    ]);
    expect(
      chartWindow(p, 2, "gross", "cumulative").map((p) => p.value),
    ).toEqual([140, 140]);
  });
  it("utilise le flux quotidien canonique projet et exclut les ancres", () => {
    const p = [
      {
        day: "2026-11-01",
        tickets: 100,
        gross: 1000,
        dailyGross: 1000,
        dailyTickets: 100,
        status: "anchor",
        span: null,
      },
      {
        day: "2026-11-02",
        tickets: 115,
        gross: 1150,
        dailyGross: 150,
        dailyTickets: 15,
        status: "observed",
        span: 1,
      },
    ] as TimelinePoint[];
    expect(chartWindow(p, 0, "gross", "daily").map((p) => p.value)).toEqual([
      null,
      150,
    ]);
    expect(chartWindow(p, 0, "tickets", "daily").map((p) => p.value)).toEqual([
      null,
      15,
    ]);
  });
  it("ne transforme pas une recette inconnue en zéro", () => {
    const p = eventTimeline([
      { day: "2026-11-01", gross: null, tickets: 10 },
      { day: "2026-11-02", gross: 140, tickets: 14 },
    ]);
    expect(periodStats(chartWindow(p, 0, "gross", "daily")).total).toBeNull();
    expect(periodStats([]).average).toBeNull();
  });
});

import { ReadQueue } from "../src/readQueue";
it("limite les lectures coûteuses et retire les demandes annulées de la file", async () => {
  const queue = new ReadQueue(1);
  const signal = new AbortController();
  let unblock!: () => void;
  const first = queue.run(
    signal.signal,
    () =>
      new Promise<void>((r) => {
        unblock = r;
      }),
  );
  await Promise.resolve();
  const cancelled = new AbortController();
  let ran = false;
  const second = queue.run(cancelled.signal, async () => {
    ran = true;
  });
  const rejection = expect(second).rejects.toMatchObject({
    name: "AbortError",
  });
  cancelled.abort();
  await rejection;
  expect(ran).toBe(false);
  unblock();
  await first;
  expect(await queue.run(signal.signal, async () => 42)).toBe(42);
});
