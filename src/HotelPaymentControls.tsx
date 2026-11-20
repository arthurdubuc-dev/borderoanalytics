import { PaymentDateField } from "./PaymentDateField";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { useResource } from "./useResource";
import {
  loadHotelPaymentAccess,
  loadHotelSettlements,
  pendingHotelPayments,
  hotelPaymentWriter,
} from "./hotelPaymentApi";
import {
  frenchPaymentDate,
  parsePaymentDate,
  parsePaymentAmount,
  paymentCap,
  validatePaymentInput,
  HotelPaymentOperationError,
  type PaymentInput,
  type PendingHotelPayment,
  type PaymentScope,
  type HotelSettlement,
} from "./hotelPaymentOperations";
import { hotelLineState } from "./canonical/hotels/hotelPaymentPlan";
import { exact, parisDay, dayLabel } from "./domain";
import {
  useTheme,
  Txt,
  Card,
  Heading,
  Button,
  Field,
  Notice,
  Loading,
} from "./ui";
import type { HotelStay, HotelPayment } from "./hotels";
import type { HotelFinanceSnapshot } from "./hotelApi";
let pendingReaderSequence = 0;
type Editor = {
  line: HotelPayment;
  settlement: HotelSettlement | null;
  amount: string;
  date: string;
  method: string;
  reason: string;
};
export function HotelPaymentControls({
  stay,
  finance,
  loading,
  error,
  onChanged,
  onBusyChange,
}: {
  stay: HotelStay;
  finance: HotelFinanceSnapshot | undefined;
  loading: boolean;
  error: unknown;
  onChanged: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const c = useTheme();
  const [pendingReaderId] = useState(() => ++pendingReaderSequence);
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<PendingHotelPayment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const sawRead = useRef(false);
  const alive = useRef(true);
  const controller = useRef(new AbortController());
  const inFlight = useRef(false);
  const writer = useMemo(() => hotelPaymentWriter(), []);
  useEffect(
    () => () => {
      alive.current = false;
      controller.current.abort();
    },
    [],
  );
  const access = useResource("hotel-payment-access:" + stay.workspace_id, (s) =>
    loadHotelPaymentAccess(stay.workspace_id, s),
  );
  const scope: PaymentScope | null = access.data?.canWrite
    ? {
        userId: access.data.userId,
        workspaceId: stay.workspace_id,
        projectId: stay.project_id,
        stayId: stay.id,
      }
    : null;
  const pendingRead = useResource(
    scope
      ? "hotel-payment-pending:" +
          scope.userId +
          ":" +
          stay.workspace_id +
          ":" +
          stay.id +
          ":" +
          pendingReaderId
      : null,
    () => pendingHotelPayments.read(scope!),
  );
  useEffect(() => {
    if (pendingRead.data !== undefined) setPending(pendingRead.data);
  }, [pendingRead.data]);
  const sourceSignature = JSON.stringify(
    finance?.payments.map((p) => [
      p.id,
      p.status,
      p.amount,
      p.paid_amount,
      p.paid_on,
      p.payment_method,
      p.settlement_id,
    ]) ?? [],
  );
  const ledger = useResource(
    open && scope && finance?.commitment && !loading && !error
      ? "hotel-settlements:" +
          stay.workspace_id +
          ":" +
          stay.id +
          ":" +
          sourceSignature
      : null,
    (s) => loadHotelSettlements(stay, finance!, s),
  );
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    if (!syncing) return;
    if (loading) sawRead.current = true;
    else if (sawRead.current && !error) {
      setSyncing(false);
      sawRead.current = false;
    }
  }, [loading, error, syncing]);
  const disabled =
    busy ||
    syncing ||
    loading ||
    !!error ||
    access.loading ||
    !!access.error ||
    !access.data?.canWrite ||
    !!pendingRead.error ||
    pendingRead.loading;
  const refresh = () => {
    access.retry();
    pendingRead.retry();
    ledger.retry();
    onChanged();
  };
  function openEditor(line: HotelPayment, settlement: HotelSettlement | null) {
    setMessage(null);
    setFormError(null);
    const cap = settlement ? settlement.amount : paymentCap(line);
    setEditor({
      line,
      settlement,
      amount: String(cap).replace(".", ","),
      date: frenchPaymentDate(settlement?.paid_at.slice(0, 10) ?? parisDay()),
      method: settlement?.payment_method ?? "",
      reason: "",
    });
  }
  async function save(recover = false) {
    if (!scope || disabled || inFlight.current) return;
    let input: PaymentInput | null = null;
    if (!recover) {
      if (!editor || pending) return;
      const amount = parsePaymentAmount(editor.amount),
        paidOn = parsePaymentDate(editor.date);
      if (amount === null) {
        setFormError(
          "Renseigne un montant positif avec deux décimales au maximum.",
        );
        return;
      }
      if (!paidOn) {
        setFormError("Renseigne une date valide au format JJ/MM/AAAA.");
        return;
      }
      input = {
        kind: editor.settlement ? "correct" : "record",
        scheduleId: editor.line.id,
        settlementId: editor.settlement?.id ?? null,
        amount,
        paidOn,
        method: editor.method.trim(),
        reason: editor.reason.trim(),
      };
      const latestLine = finance?.payments.find(
        (line) => line.id === editor.line.id,
      );
      const latestSettlement = editor.settlement
        ? (ledger.data ?? []).find((s) => s.id === editor.settlement!.id)
        : null;
      if (
        !latestLine ||
        latestLine.status === "cancelled" ||
        (editor.settlement && !latestSettlement)
      ) {
        setFormError(
          "Cette échéance ou ce règlement a changé. Actualise les règlements.",
        );
        return;
      }
      const invalid = validatePaymentInput(
        input,
        paymentCap(latestLine, latestSettlement),
      );
      if (invalid) {
        setFormError(invalid);
        return;
      }
    }
    inFlight.current = true;
    setBusy(true);
    setFormError(null);
    try {
      const result = await writer.submit(
        scope,
        input,
        controller.current.signal,
      );
      if (!alive.current) return;
      setPending(null);
      setEditor(null);
      setMessage(
        result.replayed
          ? "Opération déjà enregistrée : aucun doublon."
          : "Règlement " +
              (input?.kind === "correct" ? "corrigé" : "enregistré") +
              ". Actualisation des montants…",
      );
      setSyncing(true);
      sawRead.current = false;
      pendingRead.retry();
      ledger.retry();
      onChanged();
    } catch (e) {
      if (!alive.current) return;
      const failure = e as HotelPaymentOperationError;
      setFormError(failure.message ?? "Enregistrement impossible.");
      if (failure.uncertain && failure.pending) {
        setPending(failure.pending);
        setEditor(null);
        pendingRead.retry();
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (access.loading && !access.data) return null;
  if (access.error && !access.data)
    return (
      <Card>
        <Notice>
          Les actions de paiement sont momentanément indisponibles.
        </Notice>
        <Button secondary title="Vérifier les droits" onPress={access.retry} />
      </Card>
    );
  if (!access.data?.canWrite) return null;
  const lines = finance?.payments.filter((p) => p.status !== "cancelled") ?? [];
  return (
    <Card>
      <Heading
        title="Règlements"
        subtitle="Acomptes et soldes · mêmes droits que Bordero Web"
      />
      {message && <Notice>{message}</Notice>}
      {!!pendingRead.error && (
        <Notice warning>
          Une tentative de paiement ne peut pas être vérifiée. Vérifie
          l’historique dans Bordero Web avant un nouvel enregistrement.
        </Notice>
      )}
      {pending && (
        <>
          <Notice warning>
            Une tentative est à vérifier avant toute nouvelle saisie.
          </Notice>
          <Txt>
            {pending.kind === "correct" ? "Correction" : "Règlement"} ·{" "}
            {exact(pending.amount, true)} · {dayLabel(pending.paidOn)} ·{" "}
            {pending.method}
          </Txt>
          <Button
            title={busy ? "Vérification…" : "Vérifier cette tentative"}
            disabled={disabled}
            onPress={() => void save(true)}
          />
        </>
      )}
      {formError && <Notice warning>{formError}</Notice>}
      {!pending && !open && (
        <Button
          icon="wallet-outline"
          title="Enregistrer ou corriger un règlement"
          disabled={disabled}
          onPress={() => setOpen(true)}
        />
      )}
      {open && !pending && (
        <>
          {loading || ledger.loading ? (
            <Loading />
          ) : error || ledger.error ? (
            <>
              <Notice warning>
                Les règlements doivent être actualisés avant de modifier un
                paiement.
              </Notice>
              <Button
                secondary
                title="Actualiser les règlements"
                disabled={busy}
                onPress={refresh}
              />
            </>
          ) : (
            <>
              {!lines.length && (
                <Notice>
                  Prépare l’échéancier dans Bordero Web pour enregistrer un
                  acompte ou un solde.
                </Notice>
              )}
              {!editor &&
                lines.map((line) => {
                  const state = hotelLineState(line),
                    settlements = (ledger.data ?? []).filter(
                      (s) => s.source_id === line.id,
                    );
                  return (
                    <View
                      key={line.id}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        backgroundColor: c.secondary,
                        gap: 10,
                      }}
                    >
                      <Txt style={{ fontWeight: "700" }}>
                        {line.label ||
                          (line.payment_type === "deposit"
                            ? "Acompte"
                            : "Solde")}{" "}
                        · {exact(state.amount, true)}
                      </Txt>
                      <Txt muted>
                        Restant sur cette échéance :{" "}
                        {exact(state.remaining, true)}
                      </Txt>
                      {state.state === "historical" ? (
                        <Notice warning>
                          Ancien paiement à régulariser dans Bordero Web.
                        </Notice>
                      ) : (
                        state.remaining > 0 && (
                          <Button
                            title="Enregistrer un règlement"
                            disabled={disabled}
                            onPress={() => openEditor(line, null)}
                          />
                        )
                      )}
                      {settlements.map((settlement) => (
                        <View
                          key={settlement.id}
                          style={{
                            gap: 5,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: c.line,
                          }}
                        >
                          <Txt>
                            {exact(settlement.amount, true)} ·{" "}
                            {dayLabel(settlement.paid_at.slice(0, 10))}
                          </Txt>
                          <Txt muted>
                            {settlement.payment_method || "Moyen non renseigné"}
                          </Txt>
                          <Button
                            secondary
                            title="Corriger ce règlement"
                            disabled={disabled}
                            onPress={() => openEditor(line, settlement)}
                          />
                        </View>
                      ))}
                    </View>
                  );
                })}
              {editor && (
                <HotelPaymentEditor
                  editor={editor}
                  cap={paymentCap(
                    finance?.payments.find((p) => p.id === editor.line.id) ??
                      editor.line,
                    editor.settlement,
                  )}
                  disabled={disabled}
                  busy={busy}
                  onChange={setEditor}
                  onSave={() => void save()}
                  onCancel={() => {
                    setEditor(null);
                    setFormError(null);
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}

export function HotelPaymentEditor({
  editor,
  cap,
  disabled,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  editor: Editor;
  cap: number;
  disabled: boolean;
  busy: boolean;
  onChange: (value: Editor) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <Heading
        title={
          editor.settlement
            ? "Corriger le règlement"
            : "Enregistrer un règlement"
        }
        subtitle={
          editor.line.label ||
          (editor.line.payment_type === "deposit" ? "Acompte" : "Solde")
        }
      />
      {editor.settlement && (
        <Notice>
          La correction sera historisée. L’ancien règlement restera traçable.
        </Notice>
      )}
      {editor.settlement &&
        parsePaymentAmount(editor.amount) !== null &&
        parsePaymentAmount(editor.amount) !== editor.settlement.amount && (
          <Notice>
            Après une modification du montant, vérifie les justificatifs liés
            dans Bordero Web.
          </Notice>
        )}
      <Field
        label="Montant réglé (€)"
        keyboardType="decimal-pad"
        value={editor.amount}
        editable={!disabled}
        onChangeText={(amount) => onChange({ ...editor, amount })}
        maxLength={18}
      />
      <Txt muted style={{ fontSize: 12 }}>
        Maximum sur cette échéance : {exact(cap, true)}
      </Txt>
      <PaymentDateField
        value={editor.date}
        disabled={disabled}
        onChange={(date) => onChange({ ...editor, date })}
      />
      <Field
        label="Moyen de paiement"
        placeholder="Carte, virement, chèque…"
        value={editor.method}
        editable={!disabled}
        maxLength={120}
        onChangeText={(method) => onChange({ ...editor, method })}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["Carte", "Virement", "Chèque", "Espèces"].map((method) => (
          <Pressable
            key={method}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => onChange({ ...editor, method })}
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: c.secondary,
            }}
          >
            <Txt>{method}</Txt>
          </Pressable>
        ))}
      </View>
      {editor.settlement && (
        <Field
          label="Motif de la correction"
          placeholder="Explique la correction"
          value={editor.reason}
          editable={!disabled}
          maxLength={500}
          multiline
          onChangeText={(reason) => onChange({ ...editor, reason })}
        />
      )}
      <Button
        title={
          busy
            ? "Enregistrement…"
            : (editor.settlement ? "Confirmer la correction" : "Enregistrer") +
              (parsePaymentAmount(editor.amount) !== null
                ? " · " + exact(parsePaymentAmount(editor.amount), true)
                : "")
        }
        disabled={disabled}
        onPress={onSave}
      />
      <Button
        secondary
        title="Annuler la saisie"
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}
