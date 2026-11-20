// Generated from Bordero Web (trailing whitespace normalized) src/domain/hotels/invoiceCalc.ts. Do not edit formulas here.
// SHA256 0b293a371420b872c5bba6ae6cd8814439c1eb5adaee7d8eeddb7f0f9460ec94
/**
 * Centralized hotel invoice calculations
 *
 * Single source of truth for:
 * - HotelEditDialog (UI)
 * - HotelRoomRatesEditor (UI)
 * - PDF/XLSX exports
 * - Bordereau integration
 *
 * NO React dependencies - pure business logic
 */

export type RoomType = 'SINGLE' | 'TWIN' | 'DOUBLE' | 'SUPERIOR' | 'SUITE' | 'TRIPLE' | 'OTHER';

export interface RoomRate {
  id: string;
  room_type: RoomType;
  qty: number;
  price_ttc_per_room: number;
  vat_rate: number; // Percentage, e.g., 10 for 10%
  is_comped: boolean;
}

export interface HotelInvoiceDetails {
  room_rates: RoomRate[];
  city_tax_rate_pppn: number | null; // Tax per person per night
  occupants: number; // Number of people staying
  city_tax_total: number; // Calculated or legacy total
  invoice_note: string;
  ops_note?: string;
  rooming_list: string;
  // Optional extras - Meals
  has_breakfast?: boolean;
  breakfast_ttc_per_person?: number;
  breakfast_people?: number;
  has_lunch?: boolean;
  lunch_ttc_per_person?: number;
  lunch_people?: number;
  has_dinner?: boolean;
  dinner_ttc_per_person?: number;
  dinner_people?: number;
  // Parking
  has_parking?: boolean;
  parking_ttc_per_unit?: number;
  parking_qty?: number;
  // Bus parking
  has_bus_parking?: boolean;
  bus_parking_ttc?: number; // Total TTC (flat fee typically)
  bus_parking_spots?: number; // Number of bus spots
  // Check-in/out options
  has_early_checkin?: boolean;
  early_checkin_ttc?: number; // Unit price TTC for early check-in
  early_checkin_qty?: number; // Number of early check-ins
  has_late_checkout?: boolean;
  late_checkout_ttc?: number; // Unit price TTC for late check-out
  late_checkout_qty?: number; // Number of late check-outs
}

export interface InvoiceSummary {
  roomsTTC: number;
  roomsHT: number;
  breakfastTTC: number;
  breakfastHT: number;
  lunchTTC: number;
  lunchHT: number;
  dinnerTTC: number;
  dinnerHT: number;
  parkingTTC: number;
  parkingHT: number;
  busParkingTTC: number;
  busParkingHT: number;
  earlyCheckinTTC: number;
  earlyCheckinHT: number;
  lateCheckoutTTC: number;
  lateCheckoutHT: number;
  cityTax: number;
  totalTTC: number;
  totalHT: number;
  totalRooms: number;
  billedRooms: number;
}

export interface HotelTotals {
  rooms_total: number;
  rooms_billed: number;
  room_ttc: number;
  room_ht: number;
  tva: number;
  breakfast_ttc: number;
  breakfast_ht: number;
  lunch_ttc: number;
  lunch_ht: number;
  dinner_ttc: number;
  dinner_ht: number;
  parking_ttc: number;
  parking_ht: number;
  bus_parking_ttc: number;
  bus_parking_ht: number;
  early_checkin_ttc: number;
  early_checkin_ht: number;
  late_checkout_ttc: number;
  late_checkout_ht: number;
  city_tax: number;
  total_ttc: number;
  sejour_ht: number;
}

export interface RoomingSummary {
  single: number;
  double: number;
  twin: number;
  triple?: number;
  suite?: number;
  total: number;
}

const DEFAULT_VAT_RATE = 10;
const MEAL_VAT_RATE = 10; // TVA restauration
const PARKING_VAT_RATE = 20;
const SERVICE_VAT_RATE = 20; // TVA prestations (early check-in, late check-out)

/**
 * Safe number parser - protects against NaN
 * Number(x) ?? 0 does NOT protect against NaN, this helper does
 */
function n(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Calculate invoice summary from hotel invoice details
 * @param details - The hotel invoice details
 * @param nights - Number of nights (default 1)
 * @returns Complete invoice summary with all calculated values
 */
export function calculateInvoiceSummary(details: HotelInvoiceDetails, nights: number = 1): InvoiceSummary {
  let roomsTTC = 0;
  let roomsHT = 0;
  let totalRooms = 0;
  let billedRooms = 0;

  const rates = details.room_rates || [];

  rates.forEach(rate => {
    const qty = rate.qty || 0;
    totalRooms += qty;

    if (!rate.is_comped && qty > 0 && rate.price_ttc_per_room > 0) {
      billedRooms += qty;
      const lineTTC = qty * rate.price_ttc_per_room;
      const vatRate = rate.vat_rate ?? DEFAULT_VAT_RATE;
      const lineHT = lineTTC / (1 + vatRate / 100);
      roomsTTC += lineTTC;
      roomsHT += lineHT;
    }
  });

  // Breakfast calculation (TVA 10%)
  let breakfastTTC = 0;
  let breakfastHT = 0;
  if (details.has_breakfast) {
    const bfPeople = (details.breakfast_people != null && details.breakfast_people > 0)
      ? details.breakfast_people
      : (details.occupants > 0 ? details.occupants : 0);
    if (details.breakfast_ttc_per_person && details.breakfast_ttc_per_person > 0) {
      breakfastTTC = details.breakfast_ttc_per_person * bfPeople * nights;
      breakfastHT = breakfastTTC / (1 + MEAL_VAT_RATE / 100);
    }
  }

  // Lunch calculation (TVA 10%)
  let lunchTTC = 0;
  let lunchHT = 0;
  if (details.has_lunch) {
    const lPeople = (details.lunch_people != null && details.lunch_people > 0)
      ? details.lunch_people
      : (details.occupants > 0 ? details.occupants : 0);
    if (details.lunch_ttc_per_person && details.lunch_ttc_per_person > 0) {
      lunchTTC = details.lunch_ttc_per_person * lPeople * nights;
      lunchHT = lunchTTC / (1 + MEAL_VAT_RATE / 100);
    }
  }

  // Dinner calculation (TVA 10%)
  let dinnerTTC = 0;
  let dinnerHT = 0;
  if (details.has_dinner) {
    const dPeople = (details.dinner_people != null && details.dinner_people > 0)
      ? details.dinner_people
      : (details.occupants > 0 ? details.occupants : 0);
    if (details.dinner_ttc_per_person && details.dinner_ttc_per_person > 0) {
      dinnerTTC = details.dinner_ttc_per_person * dPeople * nights;
      dinnerHT = dinnerTTC / (1 + MEAL_VAT_RATE / 100);
    }
  }

  // Parking calculation (TVA 20%)
  let parkingTTC = 0;
  let parkingHT = 0;
  if (details.has_parking && details.parking_ttc_per_unit && details.parking_ttc_per_unit > 0) {
    const pkQty = details.parking_qty ?? 0;
    parkingTTC = details.parking_ttc_per_unit * pkQty * nights;
    parkingHT = parkingTTC / (1 + PARKING_VAT_RATE / 100);
  }

  // Bus parking calculation (TVA 20%)
  let busParkingTTC = 0;
  let busParkingHT = 0;
  if (details.has_bus_parking) {
    const busTTC = details.bus_parking_ttc ?? 0;
    const busSpots = details.bus_parking_spots ?? 0;
    busParkingTTC = busTTC * busSpots * nights;
    busParkingHT = busParkingTTC / (1 + PARKING_VAT_RATE / 100);
  }

  // Early check-in calculation (TVA 20% - service) — unit price × qty
  let earlyCheckinTTC = 0;
  let earlyCheckinHT = 0;
  if (details.has_early_checkin && details.early_checkin_ttc && details.early_checkin_ttc > 0) {
    const ecQty = details.early_checkin_qty ?? 1;
    earlyCheckinTTC = details.early_checkin_ttc * ecQty;
    earlyCheckinHT = earlyCheckinTTC / (1 + SERVICE_VAT_RATE / 100);
  }

  // Late check-out calculation (TVA 20% - service) — unit price × qty
  let lateCheckoutTTC = 0;
  let lateCheckoutHT = 0;
  if (details.has_late_checkout && details.late_checkout_ttc && details.late_checkout_ttc > 0) {
    const lcQty = details.late_checkout_qty ?? 1;
    lateCheckoutTTC = details.late_checkout_ttc * lcQty;
    lateCheckoutHT = lateCheckoutTTC / (1 + SERVICE_VAT_RATE / 100);
  }

  // City tax calculation
  let cityTax = 0;
  if (details.city_tax_rate_pppn != null) {
    // An explicit zero must never resurrect a previously calculated total.
    cityTax = n(details.city_tax_rate_pppn) * n(details.occupants) * nights;
  } else if (details.city_tax_total != null && details.city_tax_total > 0) {
    cityTax = details.city_tax_total;
  }

  const totalTTC = roomsTTC + breakfastTTC + lunchTTC + dinnerTTC + parkingTTC + busParkingTTC + earlyCheckinTTC + lateCheckoutTTC + cityTax;
  const totalHT = roomsHT + breakfastHT + lunchHT + dinnerHT + parkingHT + busParkingHT + earlyCheckinHT + lateCheckoutHT + cityTax; // city tax is not subject to VAT

  return {
    roomsTTC: Math.round(roomsTTC * 100) / 100,
    roomsHT: Math.round(roomsHT * 100) / 100,
    breakfastTTC: Math.round(breakfastTTC * 100) / 100,
    breakfastHT: Math.round(breakfastHT * 100) / 100,
    lunchTTC: Math.round(lunchTTC * 100) / 100,
    lunchHT: Math.round(lunchHT * 100) / 100,
    dinnerTTC: Math.round(dinnerTTC * 100) / 100,
    dinnerHT: Math.round(dinnerHT * 100) / 100,
    parkingTTC: Math.round(parkingTTC * 100) / 100,
    parkingHT: Math.round(parkingHT * 100) / 100,
    busParkingTTC: Math.round(busParkingTTC * 100) / 100,
    busParkingHT: Math.round(busParkingHT * 100) / 100,
    earlyCheckinTTC: Math.round(earlyCheckinTTC * 100) / 100,
    earlyCheckinHT: Math.round(earlyCheckinHT * 100) / 100,
    lateCheckoutTTC: Math.round(lateCheckoutTTC * 100) / 100,
    lateCheckoutHT: Math.round(lateCheckoutHT * 100) / 100,
    cityTax: Math.round(cityTax * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100,
    totalHT: Math.round(totalHT * 100) / 100,
    totalRooms,
    billedRooms,
  };
}

/**
 * Compute hotel totals in the format expected by UI components
 * @param invoice - The hotel invoice details
 * @param nights - Number of nights (default 1)
 * @returns Hotel totals object for UI consumption
 */
export function computeHotelTotals(invoice: HotelInvoiceDetails, nights: number = 1): HotelTotals {
  const summary = calculateInvoiceSummary(invoice, nights);

  return {
    rooms_total: summary.totalRooms,
    rooms_billed: summary.billedRooms,
    room_ttc: summary.roomsTTC,
    room_ht: summary.roomsHT,
    tva: Math.round((summary.roomsTTC - summary.roomsHT) * 100) / 100,
    breakfast_ttc: summary.breakfastTTC,
    breakfast_ht: summary.breakfastHT,
    lunch_ttc: summary.lunchTTC,
    lunch_ht: summary.lunchHT,
    dinner_ttc: summary.dinnerTTC,
    dinner_ht: summary.dinnerHT,
    parking_ttc: summary.parkingTTC,
    parking_ht: summary.parkingHT,
    bus_parking_ttc: summary.busParkingTTC,
    bus_parking_ht: summary.busParkingHT,
    early_checkin_ttc: summary.earlyCheckinTTC,
    early_checkin_ht: summary.earlyCheckinHT,
    late_checkout_ttc: summary.lateCheckoutTTC,
    late_checkout_ht: summary.lateCheckoutHT,
    city_tax: summary.cityTax,
    total_ttc: summary.totalTTC,
    sejour_ht: summary.totalHT,
  };
}

/** Canonical form rate wins, including explicit zero/null (cleared to zero).
 * Older names are read only when the canonical key is absent.
 * null means no rate was recorded: legacy total-only invoices keep their fallback.
 */
export function resolveHotelCityTaxRate(details: { city_tax_rate_pppn?: unknown; city_tax_per_person_per_night?: unknown; city_tax_rate?: unknown }): number | null {
  for (const key of ['city_tax_rate_pppn', 'city_tax_per_person_per_night', 'city_tax_rate'] as const) {
    if (details[key] !== undefined) return n(details[key]);
  }
  return null;
}

/**
 * Parse hotel invoice details from raw JSON (e.g., from roadbook entry)
 * @param details - Raw JSON object from database
 * @returns Parsed HotelInvoiceDetails or null if invalid
 */
export function parseHotelDetails(details: Record<string, unknown> | null): HotelInvoiceDetails | null {
  if (!details) return null;

  const roomRates = details.room_rates;
  if (!Array.isArray(roomRates)) return null;

  return {
    room_rates: roomRates.map((rate: Record<string, unknown>) => ({
      id: String(rate.id || ''),
      room_type: (rate.room_type || 'DOUBLE') as RoomType,
      qty: n(rate.qty),
      price_ttc_per_room: n(rate.price_ttc_per_room),
      vat_rate: n(rate.vat_rate, DEFAULT_VAT_RATE),
      is_comped: Boolean(rate.is_comped),
    })),
    city_tax_rate_pppn: resolveHotelCityTaxRate(details),
    occupants: n(details.occupants),
    city_tax_total: n(details.city_tax_total),
    invoice_note: String(details.invoice_note || ''),
    rooming_list: String(details.rooming_list || ''),
    // Meals
    has_breakfast: Boolean(details.has_breakfast),
    breakfast_ttc_per_person: n(details.breakfast_ttc_per_person),
    breakfast_people: n(details.breakfast_people),
    has_lunch: Boolean(details.has_lunch),
    lunch_ttc_per_person: n(details.lunch_ttc_per_person),
    lunch_people: n(details.lunch_people),
    has_dinner: Boolean(details.has_dinner),
    dinner_ttc_per_person: n(details.dinner_ttc_per_person),
    dinner_people: n(details.dinner_people),
    // Parking
    has_parking: Boolean(details.has_parking),
    parking_ttc_per_unit: n(details.parking_ttc_per_unit),
    parking_qty: n(details.parking_qty),
    has_bus_parking: Boolean(details.has_bus_parking),
    bus_parking_ttc: n(details.bus_parking_ttc),
    bus_parking_spots: n(details.bus_parking_spots),
    // Check-in/out
    has_early_checkin: Boolean(details.has_early_checkin),
    early_checkin_ttc: n(details.early_checkin_ttc),
    early_checkin_qty: n(details.early_checkin_qty, 1),
    has_late_checkout: Boolean(details.has_late_checkout),
    late_checkout_ttc: n(details.late_checkout_ttc),
    late_checkout_qty: n(details.late_checkout_qty, 1),
  };
}

/**
 * Create an empty/default hotel invoice
 */
export function createEmptyInvoice(): HotelInvoiceDetails {
  return {
    room_rates: [],
    city_tax_rate_pppn: 0,
    occupants: 0,
    city_tax_total: 0,
    invoice_note: '',
    rooming_list: '',
    // Meals
    has_breakfast: false,
    breakfast_ttc_per_person: 0,
    breakfast_people: 0,
    has_lunch: false,
    lunch_ttc_per_person: 0,
    lunch_people: 0,
    has_dinner: false,
    dinner_ttc_per_person: 0,
    dinner_people: 0,
    // Parking
    has_parking: false,
    parking_ttc_per_unit: 0,
    parking_qty: 0,
    has_bus_parking: false,
    bus_parking_ttc: 0,
    bus_parking_spots: 0,
    // Check-in/out
    has_early_checkin: false,
    early_checkin_ttc: 0,
    early_checkin_qty: 1,
    has_late_checkout: false,
    late_checkout_ttc: 0,
    late_checkout_qty: 1,
  };
}
