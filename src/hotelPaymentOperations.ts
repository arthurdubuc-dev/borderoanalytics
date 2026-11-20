import {
  hotelLineState,
  validateSettlementForm,
} from "./canonical/hotels/hotelPaymentPlan";
import { fromCents, toCents } from "./canonical/hotels/settlementJustification";
import { parisDay } from "./domain";
import type { HotelPayment } from "./hotels";
import { PaymentRejected } from "./paymentErrors";
export interface HotelSettlement {
  id: string;
  source_id: string;
  payment_tracking_id: string;
  workspace_id: string;
  amount: number;
  paid_at: string;
  payment_method: string | null;
  status: string;
}
export interface PaymentScope {
  userId: string;
  workspaceId: string;
  projectId: string;
  stayId: string;
}
export interface PaymentInput {
  kind: "record" | "correct";
  scheduleId: string;
  settlementId: string | null;
  amount: number;
  paidOn: string;
  method: string;
  reason: string;
}
export interface PendingHotelPayment extends PaymentInput, PaymentScope {
  version: 1;
  requestKey: string;
  sent: boolean;
}
export interface PendingPaymentStore {
  read(scope: PaymentScope): Promise<PendingHotelPayment | null>;
  write(operation: PendingHotelPayment): Promise<void>;
  clear(scope: PaymentScope): Promise<void>;
}
export interface PaymentAck {
  schedule: Record<string, unknown>;
  settlement_id: string;
  parent_id: string;
  replayed: boolean;
}
export class HotelPaymentOperationError extends Error {
  constructor(
    message: string,
    public uncertain: boolean,
    public pending: PendingHotelPayment | null,
  ) {
    super(message);
  }
}
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function frenchPaymentDate(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4)
    : iso;
}
export function parsePaymentDate(value: string): string | null {
  const input = value.trim(),
    m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/),
    iso = m ? `${m[3]}-${m[2]}-${m[1]}` : input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(iso + "T12:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function parsePaymentAmount(value: string): number | null {
  const clean = value.trim().replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(clean)) return null;
  const amount = Number(clean.replace(",", "."));
  return Number.isFinite(amount) &&
    amount > 0 &&
    Number.isSafeInteger(toCents(amount))
    ? amount
    : null;
}
export function paymentCap(
  line: HotelPayment,
  settlement?: HotelSettlement | null,
) {
  return fromCents(
    toCents(hotelLineState(line).remaining) +
      (settlement ? toCents(settlement.amount) : 0),
  );
}
export function validatePaymentInput(
  input: PaymentInput,
  cap: number,
  day = parisDay(),
): string | null {
  if (!Number.isFinite(cap) || cap < 0)
    return "Le montant de l’échéance doit être vérifié avant l’enregistrement.";
  const parsed = parsePaymentDate(input.paidOn);
  if (!parsed) return "Renseigne une date réelle valide au format JJ/MM/AAAA.";
  const [y, m, d] = day.split("-").map(Number);
  const error = validateSettlementForm(
    { paidOn: parsed, method: input.method, amount: input.amount },
    new Date(y!, m! - 1, d!, 12),
    cap,
  );
  if (error) return error;
  if (input.kind === "correct" && (!input.settlementId || !input.reason.trim()))
    return "Le règlement à corriger et le motif de correction sont obligatoires.";
  return null;
}
export function assertPendingScope(
  operation: PendingHotelPayment,
  scope: PaymentScope,
) {
  if (!operation || typeof operation !== "object")
    throw new PaymentRejected("Tentative de règlement invalide.");
  if (
    operation.version !== 1 ||
    operation.userId !== scope.userId ||
    operation.workspaceId !== scope.workspaceId ||
    operation.projectId !== scope.projectId ||
    operation.stayId !== scope.stayId ||
    !uuidPattern.test(operation.requestKey) ||
    !uuidPattern.test(operation.scheduleId) ||
    !["record", "correct"].includes(operation.kind) ||
    typeof operation.sent !== "boolean" ||
    !Number.isFinite(operation.amount) ||
    operation.amount <= 0 ||
    !Number.isSafeInteger(toCents(operation.amount)) ||
    Math.abs(operation.amount * 100 - toCents(operation.amount)) > 1e-6 ||
    !parsePaymentDate(operation.paidOn) ||
    typeof operation.method !== "string" ||
    !operation.method.trim() ||
    operation.method.length > 120 ||
    typeof operation.reason !== "string" ||
    operation.reason.length > 500 ||
    (operation.kind === "correct" &&
      (!operation.settlementId ||
        !uuidPattern.test(operation.settlementId) ||
        !operation.reason.trim()))
  )
    throw new PaymentRejected(
      "La tentative conservée ne correspond pas à ce séjour. Vérifie les règlements dans Bordero Web.",
    );
}
const signature = (op: PaymentInput) =>
  JSON.stringify([
    op.kind,
    op.scheduleId,
    op.settlementId,
    op.amount,
    op.paidOn,
    op.method.trim(),
    op.reason.trim(),
  ]);
const activePaymentScopes = new Set<string>();
/** One reviewable command; exact request persisted before dispatch, same key on recovery. */
export function createHotelPaymentWriter(deps: {
  store: PendingPaymentStore;
  uuid: () => string;
  mutate: (
    name: "mark_hotel_payment_paid" | "correct_hotel_payment_paid",
    signal: AbortSignal,
    body: Record<string, unknown>,
    userId: string,
  ) => Promise<unknown>;
}) {
  let busy = false;
  async function submit(
    scope: PaymentScope,
    input: PaymentInput | null,
    signal: AbortSignal,
  ): Promise<PaymentAck> {
    const scopeKey = [scope.userId, scope.workspaceId, scope.stayId].join(":");
    if (busy || activePaymentScopes.has(scopeKey))
      throw new HotelPaymentOperationError(
        "Un enregistrement est déjà en cours.",
        false,
        null,
      );
    busy = true;
    activePaymentScopes.add(scopeKey);
    let operation: PendingHotelPayment | null = null,
      previouslySent = false,
      dispatching = false;
    try {
      operation = await deps.store.read(scope);
      if (operation) {
        assertPendingScope(operation, scope);
        previouslySent = operation.sent;
        if (input && signature(input) !== signature(operation))
          throw new HotelPaymentOperationError(
            "Une tentative est à vérifier. Reprends cette tentative avant une nouvelle saisie.",
            operation.sent,
            operation,
          );
      } else {
        if (!input) throw new PaymentRejected("Aucune tentative à reprendre.");
        operation = {
          ...input,
          method: input.method.trim(),
          reason: input.reason.trim(),
          ...scope,
          version: 1,
          requestKey: deps.uuid(),
          sent: false,
        };
        assertPendingScope(operation, scope);
        await deps.store.write(operation);
      }
      if (signal.aborted)
        throw new PaymentRejected("Enregistrement interrompu avant l’envoi.");
      operation = { ...operation, sent: true };
      await deps.store.write(operation);
      dispatching = true;
      const args: Record<string, unknown> = {
        p_workspace_id: scope.workspaceId,
        p_schedule_id: operation.scheduleId,
        p_paid_on: operation.paidOn,
        p_method: operation.method,
        p_request_key: operation.requestKey,
        p_amount: operation.amount,
      };
      if (operation.kind === "correct") {
        args.p_reason = operation.reason;
        args.p_settlement_id = operation.settlementId;
      }
      const data = (await deps.mutate(
        operation.kind === "record"
          ? "mark_hotel_payment_paid"
          : "correct_hotel_payment_paid",
        signal,
        args,
        scope.userId,
      )) as PaymentAck;
      if (
        !data ||
        typeof data !== "object" ||
        !data.schedule ||
        data.schedule.id !== operation.scheduleId ||
        data.schedule.hotel_stay_id !== scope.stayId ||
        data.schedule.workspace_id !== scope.workspaceId ||
        data.schedule.project_id !== scope.projectId ||
        !uuidPattern.test(data.settlement_id ?? "") ||
        !uuidPattern.test(data.parent_id ?? "") ||
        typeof data.replayed !== "boolean"
      )
        throw new Error("UNCERTAIN_RESPONSE");
      await deps.store.clear(scope);
      return data;
    } catch (error) {
      if (error instanceof HotelPaymentOperationError) throw error;
      const uncertain =
        previouslySent || (dispatching && !(error instanceof PaymentRejected));
      if (operation && !uncertain) {
        try {
          await deps.store.clear(scope);
        } catch {
          throw new HotelPaymentOperationError(
            "Impossible de confirmer l’état local. Vérifie les règlements avant de reprendre.",
            true,
            operation,
          );
        }
      }
      throw new HotelPaymentOperationError(
        uncertain
          ? "La confirmation n’a pas été reçue. Ne crée pas un second règlement : utilise « Vérifier cette tentative »."
          : error instanceof PaymentRejected
            ? error.message
            : "Enregistrement impossible avant l’envoi. Réessaie sans modifier la saisie.",
        uncertain,
        uncertain ? operation : null,
      );
    } finally {
      busy = false;
      activePaymentScopes.delete(scopeKey);
    }
  }
  return { submit };
}
