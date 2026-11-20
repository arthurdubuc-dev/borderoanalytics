import {
  calculateInvoiceSummary,
  parseHotelDetails,
  type InvoiceSummary,
  type HotelInvoiceDetails,
} from "./canonical/hotels/invoiceCalc";
import { numberOrNull } from "./domain";
export interface HotelInvoice {
  total: number | null;
  summary: InvoiceSummary | null;
  details: HotelInvoiceDetails | null;
  nights: number | null;
  warning: string | null;
}
/** Only monetary fields are selected. No legacy rooming text or private notes. */
export const HOTEL_INVOICE_FIELDS = [
  "total_ttc",
  "room_rates",
  "nights",
  "occupants",
  "city_tax_rate_pppn",
  "city_tax_per_person_per_night",
  "city_tax_rate",
  "city_tax_total",
  "has_breakfast",
  "breakfast_ttc_per_person",
  "breakfast_people",
  "has_lunch",
  "lunch_ttc_per_person",
  "lunch_people",
  "has_dinner",
  "dinner_ttc_per_person",
  "dinner_people",
  "has_parking",
  "parking_ttc_per_unit",
  "parking_qty",
  "has_bus_parking",
  "bus_parking_ttc",
  "bus_parking_spots",
  "has_early_checkin",
  "early_checkin_ttc",
  "early_checkin_qty",
  "has_late_checkout",
  "late_checkout_ttc",
  "late_checkout_qty",
] as const;
export function projectHotelInvoice(
  row: Record<string, unknown> | null,
): HotelInvoice {
  const missing = {
    total: null,
    summary: null,
    details: null,
    nights: null,
    warning:
      "Les montants détaillés de la facture ne sont pas renseignés ou ne sont pas accessibles.",
  };
  if (!row || !row.financials_updated_at) return missing;
  const total = numberOrNull(row.total_ttc);
  if (total === null || total < 0) return missing;
  if (
    Array.isArray(row.room_rates) &&
    row.room_rates.some(
      (rate) => !rate || typeof rate !== "object" || Array.isArray(rate),
    )
  )
    return {
      ...missing,
      total,
      warning: "Des lignes de chambres sont invalides.",
    };
  const nights = numberOrNull(row.nights),
    details = parseHotelDetails(row);
  if (!details || nights === null || !Number.isInteger(nights) || nights <= 0)
    return {
      ...missing,
      total,
      warning:
        "Le total est enregistré, mais le détail tarifaire est incomplet.",
    };
  const numericKeys = HOTEL_INVOICE_FIELDS.filter(
    (k) => !k.startsWith("has_") && !["room_rates"].includes(k),
  );
  const invalid =
    numericKeys.some(
      (k) =>
        row[k] !== undefined &&
        row[k] !== null &&
        (numberOrNull(row[k]) === null || Number(row[k]) < 0),
    ) ||
    (Array.isArray(row.room_rates) &&
      row.room_rates.some(
        (rate: Record<string, unknown>) =>
          !rate ||
          ["qty", "price_ttc_per_room"].some(
            (k) => numberOrNull(rate[k]) === null || Number(rate[k]) < 0,
          ),
      ));
  if (invalid)
    return {
      ...missing,
      total,
      warning:
        "Des quantités ou des prix du détail sont incomplets ou invalides.",
    };
  const summary = calculateInvoiceSummary(details, nights);
  if (Math.abs(summary.totalTTC - total) > 0.01)
    return {
      ...missing,
      total,
      warning:
        "Le détail tarifaire ne correspond pas au total enregistré dans Bordero Web.",
    };
  return { total, summary, details, nights, warning: null };
}
