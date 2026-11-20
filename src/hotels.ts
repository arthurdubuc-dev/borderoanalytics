import {
  hotelLineState,
  type HotelPaymentLike,
  summarizeHotelPlan,
} from "./canonical/hotels/hotelPaymentPlan";
export interface HotelStay {
  id: string;
  workspace_id: string;
  project_id: string;
  tour_id: string | null;
  hotel_id: string | null;
  check_in_date: string;
  check_out_date: string;
  pax_count: number | null;
  status: string | null;
  roadbook_entry_id: string | null;
  hotel: {
    name: string;
    city: string | null;
    address: string | null;
    contact_phone: string | null;
    phone: string | null;
  } | null;
}
export interface HotelPayment extends HotelPaymentLike {
  id: string;
  hotel_stay_id: string;
  payment_type: string;
  label: string | null;
  amount: number | string | null;
  paid_amount: number | string | null;
}
export interface HotelCommitment {
  id: string;
  source_id: string;
  expected_amount: number | string | null;
  received_amount: number | string | null;
  due_date: string | null;
  received_date: string | null;
}
export interface RoomingGuest {
  id: string;
  roomId: string;
  roomType: string;
  roomNumber: string | null;
  name: string;
}
const cents = (n: unknown): number | null => {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  return Number.isFinite(v) &&
    v >= 0 &&
    Number.isSafeInteger(Math.round(v * 100))
    ? Math.round(v * 100)
    : null;
};
/** The plan is a payment schedule, never inferred to be the final hotel invoice. */
export function receptionPayment(
  payments: readonly HotelPayment[],
  commitment: HotelCommitment | null,
  day: string,
  invoiceTotal: number | null = null,
) {
  const active = payments.filter((p) => p.status !== "cancelled");
  const unknown = active.some((p) => {
    const amount = cents(p.amount),
      paidAmount = cents(p.paid_amount);
    return (
      amount === null ||
      paidAmount === null ||
      paidAmount > amount ||
      !["deposit", "balance"].includes(p.payment_type)
    );
  });
  const now = new Date(day + "T12:00:00+01:00");
  const lines = active.map((p) => ({ payment: p, ...hotelLineState(p, now) }));
  const historical = lines.some((l) => l.state === "historical");
  const planned = lines
    .filter((l) => l.state !== "historical")
    .reduce((sum, l) => sum + Math.round(l.amount * 100), 0);
  const paid = lines.reduce(
    (sum, l) => sum + Math.round(l.paidAmount * 100),
    0,
  );
  const parentExpected = commitment ? cents(commitment.expected_amount) : null;
  const parentPaid = commitment ? cents(commitment.received_amount) : null;
  const reconciled = parentExpected === planned && parentPaid === paid;
  const invoiceValid =
    invoiceTotal !== null && cents(invoiceTotal) !== null && invoiceTotal > 0;
  const overpaid = invoiceValid && cents(invoiceTotal)! < paid;
  const reliable =
    !!commitment &&
    !!active.length &&
    planned > 0 &&
    !unknown &&
    !historical &&
    !overpaid &&
    reconciled;
  const remaining = invoiceValid
    ? summarizeHotelPlan(invoiceTotal!, [...active], now).remaining
    : lines.reduce((sum, l) => sum + Math.round(l.remaining * 100), 0) / 100;
  const due =
    lines
      .filter((l) => l.payment.due_date !== null && l.payment.due_date <= day)
      .reduce((sum, l) => sum + Math.round(l.remaining * 100), 0) / 100;
  const depositPaid =
    lines
      .filter((l) => l.payment.payment_type === "deposit")
      .reduce((sum, l) => sum + Math.round(l.paidAmount * 100), 0) / 100;
  const hasBalance = active.some((p) => p.payment_type === "balance");
  const reason = !commitment
    ? "Échéancier non préparé ou accès financier indisponible."
    : !active.length
      ? "Aucune échéance renseignée."
      : historical
        ? "Ancien paiement déclaré payé : règlement à confirmer dans Bordero Web."
        : unknown
          ? "Montants incomplets ou incohérents à vérifier."
          : overpaid
            ? "Le montant réglé dépasse le total enregistré : vérification nécessaire."
            : planned <= 0
              ? "Échéancier sans montant confirmé. Vérifie le coût du séjour dans Bordero Web."
              : !reconciled
                ? "Le suivi financier et l’échéancier ne concordent pas. Actualise avant de régler."
                : !hasBalance
                  ? "Le solde n’est pas renseigné dans l’échéancier."
                  : null;
  return {
    lines,
    reliable,
    reason,
    hasBalance: hasBalance || invoiceValid,
    total: reliable
      ? invoiceValid
        ? invoiceTotal
        : hasBalance
          ? planned / 100
          : null
      : null,
    totalIsInvoice: invoiceValid,
    planMismatch: invoiceValid && Math.abs(invoiceTotal! * 100 - planned) > 1,
    remaining: reliable ? remaining : null,
    due: reliable ? due : null,
    depositPaid: reliable ? depositPaid : null,
    paid: reliable ? paid / 100 : null,
  };
}
export function stayPosition(
  stay: Pick<HotelStay, "check_in_date" | "check_out_date">,
  day: string,
) {
  if (stay.check_in_date <= day && stay.check_out_date > day) return "current";
  if (stay.check_out_date === day) return "departure";
  return stay.check_in_date > day ? "upcoming" : "past";
}
export function groupRooms(guests: readonly RoomingGuest[]) {
  const map = new Map<
    string,
    {
      id: string;
      number: string | null;
      type: string;
      guests: string[];
      conflict: boolean;
    }
  >();
  for (const guest of guests) {
    const current = map.get(guest.roomId);
    if (current) {
      current.guests.push(guest.name);
      current.conflict ||=
        current.number !== guest.roomNumber || current.type !== guest.roomType;
    } else
      map.set(guest.roomId, {
        id: guest.roomId,
        number: guest.roomNumber,
        type: guest.roomType,
        guests: [guest.name],
        conflict: false,
      });
  }
  return [...map.values()];
}
