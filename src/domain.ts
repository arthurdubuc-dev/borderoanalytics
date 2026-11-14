export type RevenueMode = "gross" | "horsDl" | "producerDl" | "net";
export const REVENUE_MODES: ReadonlyArray<{
  key: RevenueMode;
  label: string;
  short: string;
}> = [
  { key: "gross", label: "Recette publique TTC", short: "Publique TTC" },
  { key: "horsDl", label: "Recette Hors DL TTC", short: "Hors DL TTC" },
  {
    key: "producerDl",
    label: "Hors DL + part producteur des DL",
    short: "Hors DL + DL producteur",
  },
  { key: "net", label: "Recette Nette · après TVA et taxes", short: "Nette" },
];
export function exact(value: number | null, money = false): string {
  if (value === null || !Number.isFinite(value)) return "Indisponible";
  return new Intl.NumberFormat(
    "fr-FR",
    money
      ? { style: "currency", currency: "EUR", minimumFractionDigits: 2 }
      : { maximumFractionDigits: 0 },
  ).format(value);
}
export function compact(value: number | null, money = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const [div, suffix] =
    abs >= 1e9
      ? [1e9, "Md"]
      : abs >= 1e6
        ? [1e6, "M"]
        : abs >= 1000
          ? [1000, "k"]
          : [1, ""];
  return suffix
    ? `${Math.trunc(value / Number(div))}${suffix}${money ? " €" : ""}`
    : exact(value, money);
}
export function parisDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function dayLabel(value: string, short = false): string {
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(+d)
    ? new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        day: "numeric",
        month: short ? "short" : "long",
        ...(short ? {} : { year: "numeric" }),
      }).format(d)
    : value;
}
export function sumKnown(values: ReadonlyArray<number | null>): number | null {
  if (!values.length || values.some((v) => v === null)) return null;
  return values.reduce<number>((s, v) => s + Math.round(v! * 100), 0) / 100;
}
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function errorMessage(error: unknown): string {
  const s = error instanceof Error ? error.message : "";
  if (s === "SESSION") return "Ta session a expiré. Reconnecte-toi.";
  if (s === "FORBIDDEN")
    return "Ces données ne sont pas accessibles avec tes droits actuels.";
  if (["BACKEND_UNAVAILABLE", "SOURCE_UNAVAILABLE", "TIMEOUT"].includes(s))
    return "Le service est momentanément indisponible. Réessaie dans un instant.";
  return "Impossible de charger les données. Vérifie ta connexion puis réessaie.";
}
export interface Workspace {
  id: string;
  name: string;
}
export interface Project {
  id: string;
  name: string;
  season: string | null;
  workspace_id: string;
  poster_file_id?: string | null;
  poster_url?: string | null;
}
export interface Tour {
  id: string;
  project_id: string;
  name: string;
  season: string | null;
}
export interface DateSummary {
  id: string;
  projectId: string;
  tourId: string | null;
  name: string;
  day: string;
  time: string | null;
  venue: string | null;
  city: string | null;
  status: string;
  dealType: string;
  tickets: number | null;
  gross: number | null;
  horsDl: number | null;
  inherited: number | null;
  updatedAt: string | null;
  source: string | null;
  capacity: number | null;
}
export interface Scope {
  workspaceId: string;
  projectId?: string;
  tourId?: string | null;
  eventId?: string;
  from?: string;
  to?: string;
}
export interface FinanceSummary {
  eventId: string;
  gross: number | null;
  horsDl: number | null;
  producerDl: number | null;
  net: number | null;
  sections: Array<{
    key: string;
    label: string;
    amount: number | null;
    basis: string;
    note?: string;
  }>;
  warnings: string[];
}
export interface Dimension {
  key: string;
  label: string;
  category: string | null;
  tickets: number;
  gross: number | null;
  horsDl: number | null;
  variants: number;
  dateCount: number | null;
  priceIds: string[];
  priceMin: number | null;
  priceMax: number | null;
}
export interface Breakdown {
  items: Dimension[];
  officialTickets: number | null;
  detailTickets: number | null;
  status: string;
  truncated: boolean;
  notes: string[];
}
export interface TimelinePoint {
  dailyTickets?: number | null;
  dailyGross?: number | null;
  day: string;
  tickets: number | null;
  gross: number | null;
  span: number | null;
  status: string;
}
export interface Timeline {
  points: TimelinePoint[];
  through: string | null;
  lag: number | null;
}
export function filterDates(dates: DateSummary[], scope: Scope): DateSummary[] {
  return dates.filter(
    (d) =>
      (!scope.projectId || d.projectId === scope.projectId) &&
      (scope.tourId === undefined || d.tourId === scope.tourId) &&
      (!scope.eventId || d.id === scope.eventId) &&
      (!scope.from || d.day >= scope.from) &&
      (!scope.to || d.day <= scope.to),
  );
}

export function observedWeek(
  raw: unknown,
  start: string,
  end: string,
): { tickets: number; gross: number | null } | null {
  const value = raw as {
    sales?: {
      days?: Array<{
        day: string;
        tickets: number | null;
        gross_revenue_ttc?: number | null;
        span_days: number | null;
        status: string;
      }>;
    };
  };
  const days =
    value?.sales?.days?.filter((d) => d.day >= start && d.day <= end) ?? [];
  // A partial interval crossing the window is not assigned entirely to these seven days.
  if (
    days.length !== 7 ||
    days.some(
      (d) =>
        typeof d.tickets !== "number" ||
        d.span_days !== 1 ||
        d.status === "anchor",
    )
  )
    return null;
  return {
    tickets: days.reduce((sum, d) => sum + d.tickets!, 0),
    gross: sumKnown(days.map((d) => numberOrNull(d.gross_revenue_ttc))),
  };
}

export function averagePublicPrice(dates: DateSummary[]): {
  value: number | null;
  covered: number;
} {
  const covered = dates.filter((d) => d.gross !== null && d.tickets !== null);
  const tickets = covered.reduce((sum, d) => sum + d.tickets!, 0);
  return {
    value:
      tickets > 0 ? sumKnown(covered.map((d) => d.gross))! / tickets : null,
    covered: covered.length,
  };
}
