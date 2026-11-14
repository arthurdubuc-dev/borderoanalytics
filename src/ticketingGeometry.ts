export type TicketingInput = { key: string; label: string; tickets: number };
export type TicketingSlice = TicketingInput & {
  start: number;
  end: number;
  share: number;
  color: string;
};
const colors = [
  "#4885FF",
  "#AB83F6",
  "#22B3A2",
  "#F59E42",
  "#EB729E",
  "#67A7C7",
  "#A6AA42",
  "#D77B52",
  "#7984CF",
  "#55AE79",
  "#B779AC",
  "#81959C",
];
export function ticketingSlices(items: readonly TicketingInput[]) {
  const keys = new Set<string>();
  for (const item of items) {
    if (
      !Number.isSafeInteger(item.tickets) ||
      item.tickets < 0 ||
      keys.has(item.key)
    )
      return null;
    keys.add(item.key);
  }
  const total = items.reduce((n, i) => n + i.tickets, 0);
  if (!Number.isSafeInteger(total)) return null;
  let angle = -Math.PI / 2;
  const slices: TicketingSlice[] = [...items]
    .filter((i) => i.tickets > 0)
    .sort((a, b) => b.tickets - a.tickets || a.key.localeCompare(b.key))
    .map((i, index) => {
      const start = angle;
      angle += (i.tickets / total) * Math.PI * 2;
      return {
        ...i,
        start,
        end: angle,
        share: i.tickets / total,
        color: colors[index % colors.length]!,
      };
    });
  return { total, slices };
}
const point = (r: number, a: number) =>
  `${120 + r * Math.cos(a)},${120 + r * Math.sin(a)}`;
export function ringPath(start: number, end: number, outer = 100, inner = 66) {
  if (end - start <= 0.00001) return "";
  if (end - start >= Math.PI * 2 - 0.00001) {
    const mid = start + Math.PI;
    return `M${point(outer, start)} A${outer},${outer} 0 1 1 ${point(outer, mid)} A${outer},${outer} 0 1 1 ${point(outer, end)} L${point(inner, end)} A${inner},${inner} 0 1 0 ${point(inner, mid)} A${inner},${inner} 0 1 0 ${point(inner, start)} Z`;
  }
  const large = end - start > Math.PI ? 1 : 0;
  return `M${point(outer, start)} A${outer},${outer} 0 ${large} 1 ${point(outer, end)} L${point(inner, end)} A${inner},${inner} 0 ${large} 0 ${point(inner, start)} Z`;
}
export function sliceAt(
  slices: readonly TicketingSlice[],
  x: number,
  y: number,
) {
  const dx = x - 120,
    dy = y - 120,
    r = Math.hypot(dx, dy);
  if (r < 66 || r > 108) return null;
  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += 2 * Math.PI;
  return slices.find((s) => angle >= s.start && angle < s.end) ?? null;
}
