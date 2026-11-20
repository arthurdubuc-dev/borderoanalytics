import { HotelPaymentControls } from "./HotelPaymentControls";
import { HotelInvoiceDetails } from "./HotelInvoiceDetails";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReadContext, useResource } from "./useResource";
import {
  loadHotelStays,
  loadHotelFinance,
  loadHotelRooming,
  loadHotelFinanceBatch,
  HOTEL_FINANCE_BATCH_SIZE,
} from "./hotelApi";
import {
  receptionPayment,
  stayPosition,
  groupRooms,
  hotelBalanceStatus,
  type HotelStay,
} from "./hotels";
import { dayLabel, exact, parisDay, type Project } from "./domain";
import {
  useTheme,
  Txt,
  Card,
  Heading,
  Button,
  Field,
  Notice,
  Loading,
  Empty,
  ErrorState,
  Icon,
  UpdatedNote,
} from "./ui";
function dayShift(day: string, n: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
const roomTypes: Record<string, string> = {
  single: "Single",
  double: "Double",
  twin: "Twin",
  triple: "Triple",
  suite: "Suite",
  tourbus: "Tourbus",
};
export function HotelsScreen({
  workspaceId,
  projects,
}: {
  workspaceId: string;
  projects: Project[];
}) {
  const c = useTheme();
  const [day, setDay] = useState(parisDay());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HotelStay | null>(null);
  const [period, setPeriod] = useState<"near" | "all">("near");
  const [limit, setLimit] = useState(30);
  const [financeEpoch, setFinanceEpoch] = useState(0);
  const reads = useContext(ReadContext);
  function paymentConfirmed() {
    // Invalidate only this workspace, including keys reused when the tab remounts.
    reads?.cache.invalidate((key) =>
      ["hotel-finance", "hotel-list-finance", "hotel-settlements"].some(
        (kind) => key.startsWith(`${reads.revision}:${kind}:${workspaceId}:`),
      ),
    );
    setFinanceEpoch((v) => v + 1);
  }
  const from = period === "near" ? day : dayShift(day, -90),
    to = dayShift(day, 180);
  const data = useResource(`hotels:${workspaceId}:${from}:${to}`, (s) =>
    loadHotelStays(workspaceId, from, to, s),
  );
  const financeVersion = `${data.updatedAt ?? 0}:${financeEpoch}`;
  useEffect(() => {
    const timer = setInterval(() => setDay(parisDay()), 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setDay(parisDay());
        data.retry();
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [data.retry]);
  const projectNames = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );
  const hotels = (data.data ?? [])
    .filter(
      (s) =>
        projectNames.has(s.project_id) &&
        `${s.hotel?.name ?? ""} ${s.hotel?.city ?? ""} ${projectNames.get(s.project_id)}`
          .toLocaleLowerCase("fr")
          .includes(query.toLocaleLowerCase("fr")),
    )
    .sort((a, b) => {
      const rank = (s: HotelStay) =>
        ({ current: 0, departure: 1, upcoming: 2, past: 3 })[
          stayPosition(s, day)
        ];
      return (
        rank(a) - rank(b) ||
        a.check_in_date.localeCompare(b.check_in_date) ||
        a.id.localeCompare(b.id)
      );
    });
  return (
    <>
      <Card>
        <Heading
          title="À la réception"
          subtitle="Le bon séjour, son échéancier et les chambres — en quelques gestes."
        />
        <Txt muted>
          Les séjours en cours et les départs du jour apparaissent en premier.
        </Txt>
        <Button
          secondary
          icon="refresh-outline"
          title={data.loading ? "Actualisation…" : "Actualiser les séjours"}
          disabled={data.loading}
          onPress={data.retry}
        />
      </Card>
      <Field
        label="Trouver un hôtel ou un projet"
        placeholder="Hôtel, ville, spectacle…"
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          setLimit(30);
        }}
      />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {(
          [
            { key: "near", label: "En cours et à venir" },
            { key: "all", label: "Avec les séjours récents" },
          ] as const
        ).map((p) => (
          <Pressable
            key={p.key}
            accessibilityRole="button"
            accessibilityState={{ selected: period === p.key }}
            onPress={() => {
              setPeriod(p.key);
              setLimit(30);
            }}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: period === p.key ? c.secondary : c.surface,
              borderWidth: 1,
              borderColor: c.line,
            }}
          >
            <Txt style={{ fontSize: 13, fontWeight: "600" }}>{p.label}</Txt>
          </Pressable>
        ))}
      </View>
      <Txt muted style={{ fontSize: 12 }}>
        Du {dayLabel(from)} au {dayLabel(to)} · séjours enregistrés dans Bordero
      </Txt>
      {data.data && (
        <UpdatedNote
          loading={data.loading}
          error={data.error}
          updatedAt={data.updatedAt}
        />
      )}
      {!data.data && data.loading ? (
        <Loading />
      ) : !data.data && data.error ? (
        <ErrorState error={data.error} retry={data.retry} />
      ) : !hotels.length ? (
        <Empty
          title="Aucun séjour sur cette période"
          detail="Essaie un autre nom ou inclus les séjours récents."
        />
      ) : (
        Array.from(
          {
            length: Math.ceil(
              Math.min(hotels.length, limit) / HOTEL_FINANCE_BATCH_SIZE,
            ),
          },
          (_, index) => {
            const stays = hotels.slice(
              index * HOTEL_FINANCE_BATCH_SIZE,
              Math.min((index + 1) * HOTEL_FINANCE_BATCH_SIZE, limit),
            );
            return (
              <HotelCardsBatch
                key={stays.map((s) => s.id).join(":")}
                stays={stays}
                day={day}
                projectNames={projectNames}
                readVersion={financeVersion}
                rechecking={data.loading}
                unavailable={!!data.error}
                onSelect={setSelected}
              />
            );
          },
        )
      )}
      {hotels.length > limit && (
        <Button
          secondary
          title="Afficher plus de séjours"
          onPress={() => setLimit((v) => v + 30)}
        />
      )}
      {selected && (
        <HotelReception
          key={selected.id}
          stay={selected}
          project={projectNames.get(selected.project_id) ?? "Projet"}
          day={day}
          financeVersion={financeVersion}
          onPaymentConfirmed={paymentConfirmed}
          close={() => setSelected(null)}
        />
      )}
    </>
  );
}

function HotelListBalance({
  summary,
  loading,
  failed,
}: {
  summary: ReturnType<typeof receptionPayment> | null;
  loading: boolean;
  failed: boolean;
}) {
  const c = useTheme();
  const state = hotelBalanceStatus(failed ? null : summary);
  const color =
    state.status === "paid"
      ? c.bg === "#0B0D10"
        ? "#4DD3A0"
        : "#067647"
      : state.status === "due"
        ? c.danger
        : c.muted;
  return (
    <View
      style={{
        gap: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderRadius: 10,
            paddingHorizontal: 9,
            paddingVertical: 5,
            backgroundColor: color + "16",
          }}
        >
          <Icon
            name={
              state.status === "paid"
                ? "checkmark-circle-outline"
                : state.status === "due"
                  ? "alert-circle-outline"
                  : "help-circle-outline"
            }
            size={16}
            color={color}
          />
          <Txt style={{ fontSize: 13, fontWeight: "700", color }}>
            {loading ? "Vérification…" : state.label}
          </Txt>
        </View>
        {!loading && state.remaining !== null && (
          <Txt
            style={{ fontSize: 21, lineHeight: 28, fontWeight: "700", color }}
          >
            {exact(state.remaining, true)}
          </Txt>
        )}
      </View>
      <Txt muted style={{ fontSize: 11 }}>
        {loading
          ? "Chargement du reste à régler"
          : state.remaining === null
            ? "Solde non confirmé · ouvre la fiche pour vérifier"
            : state.basis === "schedule"
              ? "Reste à régler selon l’échéancier"
              : "Reste à régler sur la facture enregistrée"}
      </Txt>
    </View>
  );
}
export function HotelCardsBatch({
  stays,
  day,
  projectNames,
  readVersion,
  rechecking,
  unavailable = false,
  onSelect,
}: {
  stays: HotelStay[];
  day: string;
  projectNames: Map<string, string>;
  readVersion: string;
  rechecking: boolean;
  unavailable?: boolean;
  onSelect: (stay: HotelStay) => void;
}) {
  const c = useTheme();
  const key = `hotel-list-finance:${stays[0]!.workspace_id}:${[...stays]
    .map((s) => s.id)
    .sort()
    .join(",")}:${readVersion}`;
  const finance = useResource(key, (signal) =>
    loadHotelFinanceBatch(stays, signal),
  );
  const busy = finance.loading || rechecking;
  const summaries = new Map(
    (finance.data ?? []).map((row) => [
      row.stayId,
      receptionPayment(
        row.finance.payments,
        row.finance.commitment,
        day,
        row.finance.invoice.total,
      ),
    ]),
  );
  return (
    <>
      {stays.map((stay) => {
        const position = stayPosition(stay, day),
          label = {
            current: "Sur place",
            departure: "Départ aujourd’hui",
            upcoming: "À venir",
            past: "Séjour passé",
          }[position];
        const balance = hotelBalanceStatus(
          !busy && !finance.error && !unavailable
            ? (summaries.get(stay.id) ?? null)
            : null,
        );
        return (
          <Pressable
            key={stay.id}
            accessibilityRole="button"
            accessibilityLabel={`${stay.hotel?.name ?? "Hôtel"}, ${label}, ${busy ? "Vérification du solde" : balance.label}${balance.remaining !== null ? ", reste à régler " + exact(balance.remaining, true) : ""}, ouvrir la fiche réception`}
            onPress={() => onSelect(stay)}
          >
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: c.secondary,
                  }}
                >
                  <Icon name="bed-outline" />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt
                    style={{
                      fontSize: 18,
                      lineHeight: 24,
                      fontWeight: "700",
                    }}
                  >
                    {stay.hotel?.name ?? "Hôtel non renseigné"}
                  </Txt>
                  <Txt muted style={{ fontSize: 12 }}>
                    {[stay.hotel?.city, projectNames.get(stay.project_id)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Txt>
                </View>
                <Icon name="chevron-forward" size={18} />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Txt
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: position === "current" ? "#178478" : c.muted,
                  }}
                >
                  {label}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {dayLabel(stay.check_in_date)} →{" "}
                  {dayLabel(stay.check_out_date)}
                </Txt>
              </View>
              <HotelListBalance
                summary={busy ? null : (summaries.get(stay.id) ?? null)}
                loading={busy}
                failed={!!finance.error || unavailable}
              />
            </Card>
          </Pressable>
        );
      })}
      {!!finance.error && (
        <Button
          secondary
          title="Réessayer les soldes"
          onPress={finance.retry}
        />
      )}
    </>
  );
}
export function HotelReception({
  stay,
  project,
  day,
  financeVersion,
  onPaymentConfirmed,
  close,
}: {
  stay: HotelStay;
  project: string;
  day: string;
  financeVersion: string;
  onPaymentConfirmed: () => void;
  close: () => void;
}) {
  const c = useTheme();
  const [showRooms, setShowRooms] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const financeReadKey = `hotel-finance:${stay.workspace_id}:${stay.project_id}:${stay.id}:${financeVersion}`;
  const finance = useResource(financeReadKey, (s) => loadHotelFinance(stay, s));
  const rooming = useResource(
    showRooms ? `hotel-rooming:${stay.workspace_id}:${stay.id}` : null,
    (s) => loadHotelRooming(stay, s),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        finance.retry();
        if (showRooms) rooming.retry();
      }
    });
    return () => sub.remove();
  }, [finance.retry, rooming.retry, showRooms]);
  const summary = finance.data
    ? receptionPayment(
        finance.data.payments,
        finance.data.commitment,
        day,
        finance.data.invoice?.total ?? null,
      )
    : null;
  const current = !!summary && !finance.loading && !finance.error;
  const rooms = groupRooms(rooming.data?.guests ?? []);
  const phone = stay.hotel?.contact_phone ?? stay.hotel?.phone;
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={() => {
        if (!paymentBusy) close();
      }}
      allowSwipeDismissal={false}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            padding: 20,
            gap: 18,
            paddingBottom: 40,
            maxWidth: 1000,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              justifyContent: "space-between",
            }}
          >
            <Button
              secondary
              icon="close-outline"
              title="Fermer"
              disabled={paymentBusy}
              onPress={close}
            />
            <Button
              secondary
              icon="refresh-outline"
              title="Actualiser"
              disabled={paymentBusy || finance.loading || rooming.loading}
              onPress={() => {
                finance.retry();
                if (showRooms) rooming.retry();
              }}
            />
          </View>
          <Heading
            title={stay.hotel?.name ?? "Hôtel"}
            subtitle={`${project} · ${stay.hotel?.city ?? ""}`}
          />
          <Txt>
            {dayLabel(stay.check_in_date, true)} →{" "}
            {dayLabel(stay.check_out_date, true)}
          </Txt>
          <Card>
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              <Icon name="wallet-outline" />
              <Txt style={{ fontWeight: "700" }}>Paiements du séjour</Txt>
            </View>
            {finance.loading ? (
              <Loading />
            ) : finance.error ? (
              <ErrorState error={finance.error} retry={finance.retry} />
            ) : summary?.reliable && !summary.hasBalance ? (
              <>
                <Txt
                  style={{ fontSize: 24, lineHeight: 30, fontWeight: "700" }}
                >
                  Solde à confirmer
                </Txt>
                <Notice warning>Le solde du séjour n’est pas renseigné.</Notice>
                <Txt>
                  Acomptes restant à régler : {exact(summary.remaining, true)}
                </Txt>
              </>
            ) : summary?.reliable ? (
              <>
                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <Txt style={{ flex: 1, fontSize: 15, fontWeight: "700" }}>
                      {summary.totalIsInvoice
                        ? "Total facture TTC"
                        : "Total prévu du séjour"}
                    </Txt>
                    <Txt
                      style={{
                        fontSize: 23,
                        lineHeight: 30,
                        fontWeight: "800",
                        textAlign: "right",
                      }}
                    >
                      {exact(summary.total, true)}
                    </Txt>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <Txt
                      style={{
                        flex: 1,
                        fontSize: 15,
                        color: c.bg === "#0B0D10" ? "#4DD3A0" : "#067647",
                        fontWeight: "600",
                      }}
                    >
                      Déjà réglé
                    </Txt>
                    <Txt
                      style={{
                        fontSize: 23,
                        lineHeight: 30,
                        fontWeight: "700",
                        color: c.bg === "#0B0D10" ? "#4DD3A0" : "#067647",
                        textAlign: "right",
                      }}
                    >
                      {exact(summary.paid, true)}
                    </Txt>
                  </View>
                  <Txt muted style={{ fontSize: 11, marginTop: -8 }}>
                    Acompte inclus
                  </Txt>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: c.line,
                      marginVertical: 3,
                    }}
                  />
                  <Txt
                    style={{ fontSize: 15, fontWeight: "700", color: c.danger }}
                  >
                    Reste à régler
                  </Txt>
                  <Txt
                    style={{
                      fontSize: 38,
                      lineHeight: 46,
                      fontWeight: "800",
                      color: c.danger,
                    }}
                  >
                    {exact(summary.remaining, true)}
                  </Txt>
                </View>
                {summary.planMismatch && (
                  <Notice warning>
                    Le total facture diffère de l’échéancier. Le reste est
                    calculé sur la facture enregistrée ; vérifie les prochaines
                    échéances.
                  </Notice>
                )}
                {!!summary.reason && <Notice warning>{summary.reason}</Notice>}
                {!summary.planMismatch &&
                  summary.due !== null &&
                  (summary.due > 0 ? (
                    <Notice warning>
                      {summary.due === summary.remaining
                        ? "À échéance aujourd’hui ou en retard."
                        : `${exact(summary.due, true)} à échéance aujourd’hui ou en retard.`}
                    </Notice>
                  ) : (
                    <Txt muted>
                      Aucune échéance impayée prévue jusqu’à aujourd’hui.
                    </Txt>
                  ))}
                {!summary.planMismatch &&
                  summary.lines
                    .filter(
                      (l) =>
                        l.remaining > 0 &&
                        !!l.payment.due_date &&
                        l.payment.due_date > day,
                    )
                    .sort((a, b) =>
                      a.payment.due_date!.localeCompare(b.payment.due_date!),
                    )
                    .slice(0, 1)
                    .map((line) => (
                      <Txt muted key={line.payment.id}>
                        Prochaine échéance : {dayLabel(line.payment.due_date!)}
                      </Txt>
                    ))}
                {summary.remaining === 0 && summary.hasBalance && (
                  <Txt style={{ color: "#178478", fontWeight: "700" }}>
                    Échéancier intégralement réglé
                  </Txt>
                )}
              </>
            ) : (
              <>
                <Txt
                  style={{ fontSize: 24, lineHeight: 30, fontWeight: "700" }}
                >
                  Montant à confirmer
                </Txt>
                <Notice warning>
                  {summary?.reason ?? "Lecture financière indisponible."}
                </Notice>
              </>
            )}
            <Txt muted style={{ fontSize: 12 }}>
              Montants enregistrés dans Bordero · extras non saisis exclus.
            </Txt>
            <UpdatedNote
              loading={finance.loading}
              error={finance.error}
              updatedAt={finance.updatedAt}
            />
          </Card>
          <HotelPaymentControls
            stay={stay}
            finance={finance.data}
            loading={finance.loading}
            error={finance.error}
            readVersion={financeReadKey}
            onChanged={onPaymentConfirmed}
            onBusyChange={setPaymentBusy}
          />
          <Card>
            <Button
              secondary
              title="Détail"
              icon={showDetails ? "chevron-up-outline" : "chevron-down-outline"}
              onPress={() => setShowDetails((v) => !v)}
            />
            {showDetails && (
              <>
                <HotelInvoiceDetails invoice={finance.data?.invoice} />
                {current && summary?.reliable && !!summary.lines.length && (
                  <Card>
                    <Heading
                      title="Acomptes et solde"
                      subtitle="Règlements réels et prochaines échéances"
                    />
                    {summary.lines.map((line) => (
                      <View
                        key={line.payment.id}
                        style={{
                          paddingVertical: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: c.line,
                          gap: 5,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <Txt style={{ flex: 1, fontWeight: "700" }}>
                            {line.payment.label ||
                              ({ deposit: "Acompte", balance: "Solde" }[
                                line.payment.payment_type
                              ] ??
                                "Échéance")}
                          </Txt>
                          <Txt style={{ fontWeight: "700" }}>
                            {exact(line.amount, true)}
                          </Txt>
                        </View>
                        <Txt muted style={{ fontSize: 12 }}>
                          {line.payment.due_date
                            ? "Échéance : " + dayLabel(line.payment.due_date)
                            : "Échéance non renseignée"}
                        </Txt>
                        <Txt style={{ fontSize: 13 }}>
                          {line.state === "historical"
                            ? "Ancien paiement déclaré — à confirmer"
                            : `Réglé : ${exact(line.paidAmount, true)} · restant : ${exact(line.remaining, true)}`}
                        </Txt>
                        {line.payment.paid_on && (
                          <Txt muted style={{ fontSize: 12 }}>
                            Dernier règlement : {dayLabel(line.payment.paid_on)}
                            {line.payment.payment_method
                              ? " · " + line.payment.payment_method
                              : ""}
                          </Txt>
                        )}
                      </View>
                    ))}
                  </Card>
                )}
              </>
            )}
          </Card>
          <Card>
            <Heading
              title="Rooming list"
              subtitle="Voyageurs et chambres attribuées"
            />
            {!showRooms ? (
              <Button
                secondary
                icon="people-outline"
                title="Afficher les chambres"
                onPress={() => setShowRooms(true)}
              />
            ) : rooming.loading ? (
              <Loading />
            ) : rooming.error ? (
              <>
                <Notice warning>
                  La rooming list est indisponible ou non autorisée pour ce
                  séjour. Aucun autre accès n’est utilisé.
                </Notice>
                <Button secondary title="Réessayer" onPress={rooming.retry} />
              </>
            ) : (
              <>
                {rooming.data?.reference && (
                  <Txt style={{ fontWeight: "700" }}>
                    Réservation : {rooming.data.reference}
                  </Txt>
                )}
                {!rooms.length ? (
                  <Empty title="Aucune chambre renseignée" />
                ) : (
                  rooms.map((room, index) => (
                    <View
                      key={room.id}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        backgroundColor: c.secondary,
                        gap: 6,
                      }}
                    >
                      <Txt style={{ fontWeight: "700" }}>
                        {room.number
                          ? "Chambre " + room.number
                          : "Chambre " +
                            (index + 1) +
                            " · numéro non renseigné"}{" "}
                        · {roomTypes[room.type] ?? room.type}
                      </Txt>
                      {room.guests.map((name, i) => (
                        <Txt key={i}>{name}</Txt>
                      ))}
                      {room.conflict && (
                        <Notice warning>
                          Informations de chambre à vérifier.
                        </Notice>
                      )}
                    </View>
                  ))
                )}
                <UpdatedNote
                  loading={rooming.loading}
                  error={rooming.error}
                  updatedAt={rooming.updatedAt}
                />
              </>
            )}
          </Card>
          {stay.hotel?.address && <Txt muted>{stay.hotel.address}</Txt>}
          {!!phone && (
            <Button
              secondary
              icon="call-outline"
              title="Appeler l’hôtel"
              onPress={() =>
                void Linking.openURL(
                  "tel:" + phone.replace(/[^+\d]/g, ""),
                ).catch(() => {})
              }
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
