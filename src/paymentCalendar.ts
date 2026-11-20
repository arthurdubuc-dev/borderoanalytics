import { parisDay } from "./domain";
import { parsePaymentDate, frenchPaymentDate } from "./hotelPaymentOperations";
/** Native pickers and the server use Europe/Paris business dates, without UTC day shifts. */
export function paymentCalendarMaximum(now = new Date()) {
  return new Date(parisDay(now) + "T12:00:00Z");
}
export function paymentCalendarValue(value: string, now = new Date()) {
  const today = parisDay(now),
    parsed = parsePaymentDate(value);
  return new Date((parsed && parsed <= today ? parsed : today) + "T12:00:00Z");
}
export function paymentCalendarSelection(
  value: Date,
  now = new Date(),
): string | null {
  if (!Number.isFinite(+value)) return null;
  const day = parisDay(value);
  return day <= parisDay(now) ? frenchPaymentDate(day) : null;
}
