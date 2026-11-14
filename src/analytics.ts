import type { TimelinePoint } from "./domain";
export type ChartMetric = "gross" | "tickets";
export type ChartMode = "daily" | "cumulative";
const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
  );
/** Never distribute a grouped observation over invented daily sales. */
export function eventTimeline(
  rows: Array<{ day: string; tickets: number | null; gross: number | null }>,
): TimelinePoint[] {
  return rows.map((p, i) => {
    const previous = rows[i - 1];
    const span = previous ? daysBetween(previous.day, p.day) : null;
    const daily = (metric: ChartMetric) =>
      span === 1 &&
      previous?.[metric] !== null &&
      previous?.[metric] !== undefined &&
      p[metric] !== null
        ? Math.round((p[metric]! - previous[metric]!) * 100) / 100
        : null;
    return {
      ...p,
      span,
      status: previous ? (span === 1 ? "observed" : "grouped") : "anchor",
      dailyGross: daily("gross"),
      dailyTickets: daily("tickets"),
    };
  });
}
export function chartWindow(
  points: TimelinePoint[],
  period: number,
  metric: ChartMetric,
  mode: ChartMode,
) {
  const last = points.at(-1)?.day;
  const start =
    last && period
      ? new Date(Date.parse(last + "T12:00:00Z") - (period - 1) * 86400000)
          .toISOString()
          .slice(0, 10)
      : points[0]?.day;
  const selected = points
    .filter((p) => !start || p.day >= start)
    .map((p) => ({
      day: p.day,
      value:
        mode === "cumulative"
          ? p[metric]
          : p.status === "anchor" || p.span !== 1
            ? null
            : ((metric === "gross" ? p.dailyGross : p.dailyTickets) ?? null),
      status: p.status,
      span: p.span,
    }));
  if (!start || !last) return [];
  const byDay = new Map(selected.map((p) => [p.day, p]));
  const result: typeof selected = [];
  for (
    let day = start;
    day <= last;
    day = new Date(Date.parse(day + "T12:00:00Z") + 86400000)
      .toISOString()
      .slice(0, 10)
  )
    result.push(
      byDay.get(day) ?? { day, value: null, status: "missing", span: null },
    );
  return result;
}
export function periodStats(points: ReturnType<typeof chartWindow>) {
  const known = points.filter(
    (p): p is typeof p & { value: number } => p.value !== null,
  );
  const total = known.length
    ? Math.round(known.reduce((s, p) => s + p.value, 0) * 100) / 100
    : null;
  const best = known.reduce<(typeof known)[number] | null>(
    (best, p) => (!best || p.value > best.value ? p : best),
    null,
  );
  return {
    total,
    average: total === null ? null : total / known.length,
    best,
    covered: known.length,
  };
}
