import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AppState,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  type RouteProp,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { supabase } from "./client";
import * as api from "./api";
import { useResource, ReadContext } from "./useResource";
import { ReadCache } from "./readPolicy";
import { release } from "./release";
import { ProjectArtwork } from "./ProjectArtwork";
import {
  averagePublicPrice,
  compact,
  dayLabel,
  exact,
  filterDates,
  REVENUE_MODES,
  sumKnown,
  parisDay,
  type Workspace,
  type Project,
  type Tour,
  type Scope,
  type DateSummary,
  type RevenueMode,
  type FinanceSummary,
  type TimelinePoint,
  type Dimension,
} from "./domain";
import {
  useTheme,
  Txt,
  Icon,
  Button,
  Card,
  Heading,
  Notice,
  Loading,
  ErrorState,
  Empty,
  Field,
  Kpi,
  KpiGrid,
  ProjectCard,
  UpdatedNote,
  RowButton,
  TrendChart,
  pageStyle,
} from "./ui";
type Routes = {
  Main: undefined;
  Project: { id: string; tourId?: string | null };
  Date: { id: string };
  Tariff: {
    projectId: string;
    tourId?: string | null;
    key: string;
    label: string;
    category: string | null;
  };
};
const Stack = createNativeStackNavigator<Routes>();
type Catalog = { projects: Project[]; tours: Tour[] };
type ContextValue = {
  workspace: Workspace;
  catalog: Catalog;
  dates: DateSummary[];
  mode: RevenueMode;
  setMode: (m: RevenueMode) => void;
  retry: () => void;
  refreshing: boolean;
  refreshedAt?: number;
  refreshError?: unknown;
  from: string;
  to: string;
  season: string;
  setFilters: (f: { from: string; to: string; season: string }) => void;
};
const Context = createContext<ContextValue | null>(null);
function useDashboard() {
  const v = useContext(Context);
  if (!v) throw new Error("Dashboard context");
  return v;
}
function datesInScope(scope: Scope, ctx: ContextValue) {
  return filterDates(ctx.dates, scope).filter(
    (d) =>
      !ctx.season ||
      ctx.catalog.projects.find((p) => p.id === d.projectId)?.season ===
        ctx.season,
  );
}
function scopeFor(ctx: ContextValue, extra: Partial<Scope> = {}): Scope {
  return {
    workspaceId: ctx.workspace.id,
    ...(ctx.from ? { from: ctx.from } : {}),
    ...(ctx.to ? { to: ctx.to } : {}),
    ...extra,
  };
}
function useScopedFinance(scope: Scope, enabled = true) {
  return useResource(
    enabled ? "finance:" + JSON.stringify(scope) : null,
    (signal) => api.financials(scope, signal),
  );
}
function displayedRevenue(
  d: DateSummary,
  mode: RevenueMode,
  finance?: FinanceSummary[],
): number | null {
  return mode === "gross"
    ? d.gross
    : mode === "horsDl"
      ? d.horsDl
      : (finance?.find((f) => f.eventId === d.id)?.[mode] ?? null);
}
function Sheet({
  visible,
  close,
  title,
  children,
}: {
  visible: boolean;
  close: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const c = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#00000088",
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          accessibilityLabel="Fermer"
          onPress={close}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: c.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: "85%",
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, gap: 14 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Txt
                accessibilityRole="header"
                style={{ fontSize: 22, fontWeight: "700", flex: 1 }}
              >
                {title}
              </Txt>
              <Pressable
                accessibilityLabel="Fermer"
                accessibilityRole="button"
                onPress={close}
                style={{ padding: 10 }}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
function ModeSelector() {
  const { mode, setMode } = useDashboard();
  const [open, setOpen] = useState(false);
  const c = useTheme();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: c.secondary,
          borderRadius: 14,
          padding: 13,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="options-outline" size={18} />
        <Txt style={{ flex: 1, fontSize: 13, fontWeight: "600" }}>
          {REVENUE_MODES.find((m) => m.key === mode)!.label}
        </Txt>
        <Icon name="chevron-down" size={16} />
      </Pressable>
      <Sheet
        visible={open}
        close={() => setOpen(false)}
        title="Lecture des recettes"
      >
        {REVENUE_MODES.map((m) => (
          <RowButton
            key={m.key}
            title={m.label}
            right={m.key === mode ? "✓" : undefined}
            onPress={() => {
              setMode(m.key);
              setOpen(false);
            }}
          />
        ))}
        <Notice>
          La Recette Nette retire TVA, taxes et retenues. Les coûts de salle,
          personnel, plateau et la commission promoteur ne sont pas déduits.
        </Notice>
      </Sheet>
    </>
  );
}
function Summary({
  scope,
  finance: providedFinance,
}: {
  scope: Scope;
  finance?: ReturnType<typeof useScopedFinance>;
}) {
  const ctx = useDashboard();
  const selected = datesInScope(scope, ctx);
  const valid = selected.filter(api.eligible);
  const ownFinance = useScopedFinance(
    scope,
    !providedFinance && (ctx.mode === "net" || ctx.mode === "producerDl"),
  );
  const finance = providedFinance ?? ownFinance;
  const revenues = valid.map((d) =>
    displayedRevenue(d, ctx.mode, finance.data),
  );
  const known = revenues.filter((v): v is number => v !== null);
  const sold = valid
    .map((d) => d.tickets)
    .filter((v): v is number => v !== null);
  const amount = sumKnown(known);
  const tickets = sold.length ? sold.reduce((s, v) => s + v, 0) : null;
  const missing = valid.length - known.length;
  const average = averagePublicPrice(valid);
  const last = valid
    .map((d) => d.updatedAt)
    .filter((s): s is string => !!s)
    .sort()
    .at(0);
  const sourceNote = last
    ? "Plus ancienne remontée : " +
      new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(last))
    : "Fraîcheur non renseignée";
  return (
    <>
      <ModeSelector />
      <KpiGrid>
        <Kpi
          hero
          label={REVENUE_MODES.find((m) => m.key === ctx.mode)!.short}
          value={amount}
          money
          note={
            missing
              ? `Sous-total · ${known.length}/${valid.length} dates renseignées`
              : "Appuyer pour le montant exact"
          }
        />
        <Kpi
          label="Billets vendus"
          value={tickets}
          note={`${sold.length}/${valid.length} dates renseignées · appuyer pour le détail`}
        />
        <Kpi
          label="Prix moyen public TTC"
          value={average.value}
          money
          note={`${average.covered}/${valid.length} dates comparables`}
          details="Recette publique TTC divisée par les billets du même périmètre. Les tarifs à prix nul sont inclus."
        />
        <Kpi
          label="Dates billetterie"
          value={valid.length}
          note={`${selected.length - valid.length} dates exclues du résumé`}
          details="Les dates annulées, reportées, options et cessions restent exclues des indicateurs commerciaux."
        />
      </KpiGrid>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Txt muted style={{ fontSize: 12 }}>
          {valid.length} dates billetterie · {selected.length - valid.length}{" "}
          exclues
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          · {sourceNote}
        </Txt>
      </View>
      {(ctx.mode === "net" || ctx.mode === "producerDl") &&
        finance.loading &&
        !finance.data && <Loading />}
      {(ctx.mode === "net" || ctx.mode === "producerDl") &&
        finance.error &&
        !finance.data && (
          <ErrorState error={finance.error} retry={finance.retry} />
        )}
      {(ctx.mode === "net" || ctx.mode === "producerDl") &&
        finance.data &&
        !!finance.error && (
          <UpdatedNote
            loading={false}
            error={finance.error}
            updatedAt={finance.updatedAt}
          />
        )}
      <Notice>
        Les dates annulées, reportées, options et cessions sont exclues des
        totaux. Les billets transférés lors d’un report ne sont jamais comptés
        comme de nouvelles ventes.
      </Notice>
    </>
  );
}
function Evolution({ scope }: { scope: Scope }) {
  const { mode } = useDashboard();
  const [period, setPeriod] = useState(30);
  const timeline = useResource(
    scope.projectId && !scope.from && !scope.to && scope.tourId !== null
      ? "timeline:" + JSON.stringify(scope)
      : null,
    (s) => api.timeline(scope, s),
  );
  const c = useTheme();
  const available = mode === "gross";
  let points = timeline.data?.points ?? [];
  if (period && points.length) {
    const end = new Date(points.at(-1)!.day + "T12:00:00Z");
    end.setUTCDate(end.getUTCDate() - period + 1);
    points = points.filter((p) => p.day >= end.toISOString().slice(0, 10));
  }
  return (
    <Card>
      <Heading
        title="Évolution des ventes"
        subtitle={
          available
            ? "Recette publique TTC · cumul observé"
            : "Billets · cumul observé"
        }
      />
      {!scope.projectId ? (
        <Notice>
          Ouvre un projet ou une tournée pour consulter son historique.
        </Notice>
      ) : scope.from || scope.to || scope.tourId === null ? (
        <Notice>
          Retire le filtre de représentations pour consulter l’historique
          complet du projet ou de la tournée.
        </Notice>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[7, 30, 0].map((p) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: p === period }}
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  backgroundColor: p === period ? c.accent : c.secondary,
                }}
              >
                <Txt
                  style={{
                    color: p === period ? "#171B22" : c.text,
                    fontSize: 13,
                  }}
                >
                  {p ? p + " jours" : "Tout"}
                </Txt>
              </Pressable>
            ))}
          </View>
          {timeline.data && !!timeline.error && (
            <UpdatedNote
              loading={false}
              error={timeline.error}
              updatedAt={timeline.updatedAt}
            />
          )}
          {timeline.loading && !timeline.data ? (
            <Loading />
          ) : timeline.error && !timeline.data ? (
            <ErrorState error={timeline.error} retry={timeline.retry} />
          ) : (
            <>
              <TrendChart points={points} money={available} />
              {mode !== "gross" && (
                <Notice>
                  Cette courbe montre les billets. L’historique certifié de la
                  recette sélectionnée n’est pas disponible.
                </Notice>
              )}
              {timeline.data?.through && (
                <Txt muted style={{ fontSize: 12 }}>
                  Observations jusqu’au {dayLabel(timeline.data.through)}.
                </Txt>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
function DatesList({
  scope,
  navigate,
  limit,
}: {
  scope: Scope;
  navigate: (id: string) => void;
  limit?: number;
}) {
  const ctx = useDashboard();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"date" | "sales">("date");
  const [when, setWhen] = useState<"all" | "upcoming">("all");
  const selected = datesInScope(scope, ctx)
    .filter((d) => when === "all" || d.day >= parisDay())
    .filter((d) =>
      `${d.name} ${d.city ?? ""} ${d.venue ?? ""}`
        .toLocaleLowerCase("fr")
        .includes(query.toLocaleLowerCase("fr")),
    )
    .sort((a, b) =>
      sort === "sales"
        ? (b.tickets ?? -1) - (a.tickets ?? -1)
        : a.day.localeCompare(b.day),
    );
  const count = limit ?? 50;
  const [more, setMore] = useState(count);
  return (
    <>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Rechercher une date"
            placeholder="Ville, salle, spectacle…"
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Changer le tri"
          onPress={() => setSort((v) => (v === "date" ? "sales" : "date"))}
          style={{ padding: 13, marginTop: 23 }}
        >
          <Icon
            name={sort === "sales" ? "trending-up-outline" : "calendar-outline"}
          />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          title="Toutes les dates"
          secondary={when !== "all"}
          onPress={() => setWhen("all")}
        />
        <Button
          title="À venir"
          secondary={when !== "upcoming"}
          onPress={() => setWhen("upcoming")}
        />
      </View>
      {selected.length === 0 ? (
        <Empty />
      ) : (
        selected
          .slice(0, more)
          .map((d) => (
            <RowButton
              key={d.id}
              title={d.city ?? d.name}
              subtitle={`${dayLabel(d.day, true)}${d.time ? " · " + d.time.slice(0, 5) : ""} · ${d.venue ?? d.name}${api.eligible(d) ? "" : " · " + d.status}${d.dealType === "cession" ? " · Cession" : ""}`}
              right={d.tickets === null ? "—" : compact(d.tickets) + " billets"}
              onPress={() => navigate(d.id)}
            />
          ))
      )}
      {selected.length > more && (
        <Button
          secondary
          title={`Voir plus (${selected.length - more})`}
          onPress={() => setMore((n) => n + 50)}
        />
      )}
    </>
  );
}
function Tariffs({
  scope,
  kind = "tariff",
  navigate,
}: {
  scope: Scope;
  kind?: "tariff" | "distributor";
  navigate?: (d: Dimension) => void;
}) {
  const ctx = useDashboard();
  const data = useResource(
    scope.projectId && scope.tourId !== null
      ? "breakdown:" + kind + JSON.stringify(scope)
      : null,
    (s) =>
      api.breakdown(
        scope,
        kind,
        s,
        ctx.dates.find((d) => d.id === scope.eventId)?.day,
      ),
  );
  const [sort, setSort] = useState<"tickets" | "gross">("tickets");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(20);
  const c = useTheme();
  const items = (data.data?.items ?? [])
    .filter(
      (i) =>
        (!category || i.category === category) &&
        `${i.label} ${i.category ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "tickets"
        ? b.tickets - a.tickets
        : (b.gross ?? 0) - (a.gross ?? 0),
    );
  const max = Math.max(
    ...items.map((i) => (sort === "tickets" ? i.tickets : (i.gross ?? 0))),
    1,
  );
  const categories = [
    ...new Set(
      data.data?.items.map((i) => i.category).filter((s): s is string => !!s) ??
        [],
    ),
  ];
  return (
    <Card>
      <Heading
        title={
          kind === "tariff" ? "Performance des tarifs" : "Réseaux de vente"
        }
        subtitle={
          kind === "tariff"
            ? "Volumes, recettes et contribution à la tournée"
            : "Répartition des ventes enregistrées"
        }
      />
      {data.data && !!data.error && (
        <UpdatedNote
          loading={false}
          error={data.error}
          updatedAt={data.updatedAt}
        />
      )}
      {!scope.projectId ? (
        <Notice>Choisis un projet pour analyser ses tarifs et réseaux.</Notice>
      ) : scope.tourId === null ? (
        <Notice>
          Consulte les tarifs date par date pour les dates hors tournée.
        </Notice>
      ) : data.loading && !data.data ? (
        <Loading />
      ) : data.error && !data.data ? (
        <ErrorState error={data.error} retry={data.retry} />
      ) : (
        <>
          <Field
            label={
              kind === "tariff" ? "Rechercher un tarif" : "Rechercher un réseau"
            }
            value={query}
            onChangeText={setQuery}
            placeholder="Nom, catégorie…"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              secondary
              title={sort === "tickets" ? "Tri : billets" : "Tri : recette TTC"}
              onPress={() =>
                setSort((v) => (v === "tickets" ? "gross" : "tickets"))
              }
            />
          </View>
          {categories.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {["", ...categories].map((cat) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: cat === category }}
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    backgroundColor: cat === category ? c.accent : c.secondary,
                  }}
                >
                  <Txt
                    style={{
                      fontSize: 12,
                      color: cat === category ? "#171B22" : c.text,
                    }}
                  >
                    {cat || "Toutes les catégories"}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {data.data?.status !== "complete" &&
            data.data?.status !== "exact" &&
            data.data?.status !== "no_sales" && (
              <Notice warning>
                Ventilation{" "}
                {data.data?.status === "inconsistent"
                  ? "incohérente"
                  : "partielle"}{" "}
                : {exact(data.data?.detailTickets ?? null)} billets ventilés
                pour {exact(data.data?.officialTickets ?? null)} officiels. Les
                parts se rapportent aux billets ventilés.
              </Notice>
            )}
          {data.data?.truncated && (
            <Notice warning>
              Ce périmètre dépasse la limite du service. Réduis la période ou
              choisis une tournée.
            </Notice>
          )}
          {!items.length ? (
            <Empty title="Aucune ventilation disponible" />
          ) : (
            items.slice(0, limit).map((item) => {
              const share = data.data?.detailTickets
                ? (item.tickets / data.data.detailTickets) * 100
                : null;
              const shown =
                ctx.mode === "gross"
                  ? item.gross
                  : ctx.mode === "horsDl"
                    ? item.horsDl
                    : null;
              return (
                <Pressable
                  accessibilityRole={navigate ? "button" : undefined}
                  key={item.key}
                  disabled={!navigate}
                  onPress={() => navigate?.(item)}
                  style={{
                    paddingVertical: 12,
                    borderBottomColor: c.line,
                    borderBottomWidth: 1,
                    gap: 9,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt style={{ fontWeight: "700" }}>{item.label}</Txt>
                      <Txt muted style={{ fontSize: 12 }}>
                        {[
                          item.category,
                          item.dateCount ? item.dateCount + " dates" : null,
                          item.variants > 1
                            ? item.variants + " variantes de prix"
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Txt>
                    </View>
                    <View style={{ alignItems: "flex-end", maxWidth: "45%" }}>
                      <Txt style={{ fontWeight: "700" }}>
                        {exact(item.tickets)} billets
                      </Txt>
                      <Txt muted style={{ fontSize: 12 }}>
                        {shown === null
                          ? "Recette indisponible"
                          : exact(shown, true)}
                      </Txt>
                    </View>
                  </View>
                  <View
                    style={{
                      height: 5,
                      backgroundColor: c.secondary,
                      borderRadius: 3,
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.min(100, ((sort === "tickets" ? item.tickets : (item.gross ?? 0)) / max) * 100)}%`,
                        height: 5,
                        backgroundColor: c.accent,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Txt muted style={{ fontSize: 11 }}>
                    {share === null
                      ? "Part indisponible"
                      : share.toFixed(1).replace(".", ",") +
                        " % des billets ventilés"}
                    {navigate ? " · Voir les dates" : ""}
                  </Txt>
                </Pressable>
              );
            })
          )}
          {items.length > limit && (
            <Button
              secondary
              title="Afficher plus"
              onPress={() => setLimit((n) => n + 30)}
            />
          )}
          <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>
            Les tarifs sont rapprochés par nom et catégorie. Les variantes de
            prix restent distinctes dans le détail. Un prix nul ne prouve pas
            une invitation.
          </Txt>
          {ctx.mode !== "gross" && ctx.mode !== "horsDl" && (
            <Notice>
              La recette sélectionnée n’est pas certifiée par tarif. Les volumes
              restent consultables.
            </Notice>
          )}
        </>
      )}
    </Card>
  );
}
function DateScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Date">) {
  const ctx = useDashboard();
  const date = ctx.dates.find((d) => d.id === route.params.id);
  const scope = scopeFor(ctx, {
    projectId: date?.projectId,
    eventId: route.params.id,
  });
  const finance = useScopedFinance(scope);
  const grid = useResource("prices:" + route.params.id, (s) =>
    api.prices(route.params.id, s),
  );
  if (!date) return <Empty title="Date inaccessible" />;
  return (
    <Page>
      <Heading
        title={date.city ?? date.name}
        subtitle={`${dayLabel(date.day)}${date.time ? " · " + date.time.slice(0, 5) : ""} · ${date.venue ?? date.name}`}
      />
      <Txt muted>
        {date.name} · {date.status}
      </Txt>
      {(date.inherited ?? 0) > 0 && (
        <Notice>
          {exact(date.inherited)} billets hérités d’un report sont inclus dans
          le stock de cette date. Ce ne sont pas de nouvelles ventes.
        </Notice>
      )}
      {!api.eligible(date) && (
        <Notice warning>
          Cette date n’entre pas dans les totaux de billetterie active.
        </Notice>
      )}
      <Summary scope={scope} finance={finance} />
      <Evolution scope={scope} />
      <Tariffs scope={scope} />
      <Card>
        <Heading
          title="Grille tarifaire"
          subtitle="Tarifs configurés, y compris sans vente ventilée"
        />
        {grid.data && !!grid.error && (
          <UpdatedNote
            loading={false}
            error={grid.error}
            updatedAt={grid.updatedAt}
          />
        )}
        {grid.loading && !grid.data ? (
          <Loading />
        ) : grid.error && !grid.data ? (
          <ErrorState error={grid.error} retry={grid.retry} />
        ) : grid.data?.length ? (
          grid.data.map((p) => {
            const v = (k: string) =>
              typeof p[k] === "number" ? (p[k] as number) : Number(p[k] ?? 0);
            const hors = v("price_ht"),
              dl = v("dl_producer") + v("dl_venue") + v("dl_distribution");
            return (
              <View key={String(p.id)} style={{ gap: 3, paddingVertical: 10 }}>
                <Txt style={{ fontWeight: "600" }}>{String(p.tariff_name)}</Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {exact(hors + dl, true)} public TTC · {exact(hors, true)} Hors
                  DL TTC{p.quota !== null ? " · Quota " + String(p.quota) : ""}
                </Txt>
              </View>
            );
          })
        ) : (
          <Empty title="Aucun tarif configuré" />
        )}
      </Card>
      <Tariffs scope={scope} kind="distributor" />
      <Card>
        <Heading
          title="Bordereau"
          subtitle="Résumés des tableaux · consultation uniquement"
        />
        {finance.loading && !finance.data ? (
          <Loading />
        ) : finance.error && !finance.data ? (
          <ErrorState error={finance.error} retry={finance.retry} />
        ) : finance.data?.find((f) => f.eventId === date.id) ? (
          <>
            <KpiGrid>
              {finance.data
                .find((f) => f.eventId === date.id)!
                .sections.map((section) => (
                  <Kpi
                    key={section.key}
                    tone={section.key}
                    badge={
                      ["A", "B", "C", "D", "E"].includes(section.key)
                        ? section.key
                        : undefined
                    }
                    label={section.label}
                    value={section.amount}
                    money
                    note={
                      section.key === "P"
                        ? "Incluse dans Marketing"
                        : section.amount === null
                          ? "Donnée indisponible"
                          : "Appuyer pour le détail"
                    }
                    details={[section.basis, section.note]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))}
            </KpiGrid>
            <UpdatedNote
              loading={finance.loading}
              error={finance.error}
              updatedAt={finance.updatedAt}
            />
            {finance.data
              .find((f) => f.eventId === date.id)!
              .warnings.map((w) => (
                <Notice key={w} warning>
                  {w}
                </Notice>
              ))}
          </>
        ) : (
          <Notice>Résumé non disponible avec tes droits.</Notice>
        )}
      </Card>
    </Page>
  );
}
function ProjectScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Project">) {
  const ctx = useDashboard();
  const p = ctx.catalog.projects.find((p) => p.id === route.params.id);
  const scope = scopeFor(ctx, {
    projectId: route.params.id,
    ...("tourId" in route.params ? { tourId: route.params.tourId } : {}),
  });
  const title = route.params.tourId
    ? ctx.catalog.tours.find((t) => t.id === route.params.tourId)?.name
    : route.params.tourId === null
      ? "Hors tournée"
      : p?.name;
  return (
    <Page>
      {p && (
        <View
          style={{
            backgroundColor: "#171B22",
            borderRadius: 24,
            padding: 20,
            flexDirection: "row",
            gap: 18,
            alignItems: "center",
          }}
        >
          <ProjectArtwork project={p} width={88} height={120} />
          <View style={{ flex: 1, gap: 7 }}>
            <Txt style={{ fontSize: 11, color: "#FFEE57", fontWeight: "700" }}>
              PROJET · {p.season ?? "BORDERO"}
            </Txt>
            <Txt
              accessibilityRole="header"
              style={{
                fontSize: 25,
                lineHeight: 32,
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              {title ?? p.name}
            </Txt>
            {title !== p.name && (
              <Txt style={{ fontSize: 14, color: "#CCD0D5" }}>{p.name}</Txt>
            )}
            <Txt style={{ fontSize: 12, color: "#CCD0D5" }}>
              {datesInScope(scope, ctx).length} représentations dans le
              périmètre
            </Txt>
          </View>
        </View>
      )}
      {route.params.tourId === undefined && (
        <View style={{ gap: 9 }}>
          {ctx.catalog.tours
            .filter((t) => t.project_id === p?.id)
            .map((t) => (
              <RowButton
                key={t.id}
                title={t.name}
                subtitle="Ouvrir la tournée"
                onPress={() =>
                  navigation.push("Project", { id: p!.id, tourId: t.id })
                }
              />
            ))}
          {ctx.dates.some(
            (d) => d.projectId === p?.id && d.tourId === null,
          ) && (
            <RowButton
              title="Hors tournée"
              onPress={() =>
                navigation.push("Project", { id: p!.id, tourId: null })
              }
            />
          )}
        </View>
      )}
      <Summary scope={scope} />
      <Evolution scope={scope} />
      <Tariffs
        scope={scope}
        navigate={(d) =>
          navigation.navigate("Tariff", {
            projectId: route.params.id,
            tourId: route.params.tourId,
            key: d.key,
            label: d.label,
            category: d.category,
          })
        }
      />
      <Tariffs scope={scope} kind="distributor" />
      <Heading title="Les dates" />
      <DatesList
        scope={scope}
        navigate={(id) => navigation.navigate("Date", { id })}
      />
    </Page>
  );
}
function TariffScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Tariff">) {
  const ctx = useDashboard();
  const scope = scopeFor(ctx, {
    projectId: route.params.projectId,
    ...(route.params.tourId ? { tourId: route.params.tourId } : {}),
  });
  const dateList = datesInScope(scope, ctx).filter(api.eligible);
  const resource = useResource(
    "tariff-events:" + JSON.stringify(scope) + route.params.key,
    async (signal) => {
      const rows = await api.tariffEvents(scope, route.params.key, signal);
      return rows.flatMap((row) => {
        const date = dateList.find((d) => d.id === row.eventId);
        return date ? [{ date, dimension: row.dimension }] : [];
      });
    },
  );
  return (
    <Page>
      <Heading
        title={route.params.label}
        subtitle={route.params.category ?? "Détail du tarif par représentation"}
      />
      <Notice>
        Les dates et variantes de prix sont détaillées ci-dessous. Les montants
        affichés sont les recettes publiques TTC ventilées.
      </Notice>
      {resource.data && !!resource.error && (
        <UpdatedNote
          loading={false}
          error={resource.error}
          updatedAt={resource.updatedAt}
        />
      )}
      {resource.loading && !resource.data ? (
        <Loading />
      ) : resource.error && !resource.data ? (
        <ErrorState error={resource.error} retry={resource.retry} />
      ) : resource.data?.length ? (
        resource.data.map(({ date, dimension }) => (
          <RowButton
            key={date.id}
            title={date.city ?? date.name}
            subtitle={`${dayLabel(date.day, true)} · ${exact(dimension.tickets)} billets · ${dimension.variants} variante(s)`}
            right={exact(dimension.gross, true)}
            onPress={() => navigation.navigate("Date", { id: date.id })}
          />
        ))
      ) : (
        <Empty />
      )}
    </Page>
  );
}
function Page({ children }: { children: React.ReactNode }) {
  const ctx = useDashboard();
  const c = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={pageStyle}
      refreshControl={
        <RefreshControl
          refreshing={ctx.refreshing}
          onRefresh={ctx.retry}
          tintColor="#B8A600"
        />
      }
    >
      <UpdatedNote
        loading={ctx.refreshing}
        error={ctx.refreshError}
        updatedAt={ctx.refreshedAt}
      />
      {children}
    </ScrollView>
  );
}
function FilterSheet({
  visible,
  close,
}: {
  visible: boolean;
  close: () => void;
}) {
  const ctx = useDashboard();
  const [from, setFrom] = useState(ctx.from);
  const [to, setTo] = useState(ctx.to);
  const [season, setSeason] = useState(ctx.season);
  const [error, setError] = useState("");
  const seasons = [
    ...new Set(
      ctx.catalog.projects.map((p) => p.season).filter((s): s is string => !!s),
    ),
  ];
  const valid = (s: string) =>
    !s ||
    (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s + "T12:00:00Z")) &&
      new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s);
  return (
    <Sheet
      visible={visible}
      close={close}
      title="Périmètre des représentations"
    >
      <Field
        label="Du (AAAA-MM-JJ)"
        value={from}
        onChangeText={setFrom}
        placeholder="2026-01-01"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Au (AAAA-MM-JJ)"
        value={to}
        onChangeText={setTo}
        placeholder="2026-12-31"
        keyboardType="numbers-and-punctuation"
      />
      {["", ...seasons].map((s) => (
        <RowButton
          key={s}
          title={s || "Toutes les saisons"}
          right={s === season ? "✓" : undefined}
          onPress={() => setSeason(s)}
        />
      ))}
      {error && <Notice warning>{error}</Notice>}
      <Button
        title="Appliquer"
        onPress={() => {
          if (!valid(from) || !valid(to) || (from && to && from > to)) {
            setError("Vérifie les dates et leur ordre.");
            return;
          }
          ctx.setFilters({ from, to, season });
          close();
        }}
      />
      <Button
        secondary
        title="Tout réinitialiser"
        onPress={() => {
          ctx.setFilters({ from: "", to: "", season: "" });
          close();
        }}
      />
    </Sheet>
  );
}
function WorkspaceEvolution() {
  const ctx = useDashboard();
  const projects = ctx.catalog.projects.filter(
    (p) => !ctx.season || p.season === ctx.season,
  );
  const data = useResource(
    !ctx.from && !ctx.to
      ? "workspace-evolution:" +
          ctx.workspace.id +
          projects.map((p) => p.id).join(",")
      : null,
    (signal) => api.workspaceEvolution(projects, signal),
  );
  if (ctx.from || ctx.to) return null;
  return (
    <Card>
      <Heading
        title="Dynamique · 7 jours"
        subtitle="Variations observées sur les derniers jours complets"
      />
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.retry} />
      ) : data.data ? (
        <>
          <Txt style={{ fontSize: 28, lineHeight: 36, fontWeight: "700" }}>
            {exact(data.data.tickets)} billets
          </Txt>
          <Txt muted>
            {dayLabel(data.data.start, true)} – {dayLabel(data.data.end, true)}{" "}
            · {data.data.covered}/{data.data.projects} projets comparables
          </Txt>
          {data.data.covered < data.data.projects && (
            <Notice>
              Ce sous-total couvre les projets dont les sept observations
              journalières sont complètes. Les imports couvrant plusieurs jours
              et les périodes incomplètes sont exclus.
            </Notice>
          )}
          <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>
            Une variation observée peut inclure une correction de stock. Elle ne
            représente pas forcément les achats effectués chaque jour.
          </Txt>
        </>
      ) : null}
    </Card>
  );
}
function MainScreen({ navigation }: NativeStackScreenProps<Routes, "Main">) {
  const ctx = useDashboard();
  const [tab, setTab] = useState("Accueil");
  const [filter, setFilter] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [analysisProject, setAnalysisProject] = useState<string | null>(null);
  const c = useTheme();
  const scope = scopeFor(ctx);
  const visibleProjects = ctx.catalog.projects.filter(
    (p) =>
      (!ctx.season || p.season === ctx.season) &&
      p.name.toLowerCase().includes(projectQuery.toLowerCase()),
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Page>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Heading
              title={tab === "Accueil" ? "Vue d’ensemble" : tab}
              subtitle={ctx.workspace.name}
            />
          </View>
          <Pressable
            accessibilityLabel="Filtrer les représentations"
            accessibilityRole="button"
            onPress={() => setFilter(true)}
            style={{
              marginLeft: "auto",
              padding: 13,
              borderRadius: 15,
              backgroundColor:
                ctx.from || ctx.to || ctx.season ? c.accent : c.surface,
            }}
          >
            <Icon
              name="options-outline"
              color={ctx.from || ctx.to || ctx.season ? "#171B22" : c.text}
            />
          </Pressable>
        </View>
        {(ctx.from || ctx.to || ctx.season) && (
          <Notice>
            {[
              ctx.season,
              ctx.from ? "À partir du " + dayLabel(ctx.from) : "",
              ctx.to ? "Jusqu’au " + dayLabel(ctx.to) : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </Notice>
        )}
        {tab === "Accueil" ? (
          <>
            <Summary scope={scope} />
            <WorkspaceEvolution />
            <Heading
              title="Tes projets"
              subtitle="Une lecture rapide, du global au détail"
            />
            {visibleProjects.length ? (
              visibleProjects.slice(0, 6).map((p) => {
                const d = datesInScope(
                  { ...scope, projectId: p.id },
                  ctx,
                ).filter(api.eligible);
                return (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    artwork={<ProjectArtwork project={p} />}
                    subtitle={`${p.season ?? "Projet"} · ${d.length} dates`}
                    right={
                      compact(sumKnown(d.map((d) => d.tickets))) + " billets"
                    }
                    onPress={() => navigation.navigate("Project", { id: p.id })}
                  />
                );
              })
            ) : (
              <Empty title="Aucun projet accessible" />
            )}
            <Heading title="Prochaines représentations" />
            {datesInScope(scope, ctx)
              .filter((d) => api.eligible(d) && d.day >= parisDay())
              .slice(0, 5)
              .map((d) => (
                <RowButton
                  key={d.id}
                  title={d.city ?? d.name}
                  subtitle={`${dayLabel(d.day, true)} · ${d.venue ?? d.name}`}
                  right={compact(d.tickets) + " billets"}
                  onPress={() => navigation.navigate("Date", { id: d.id })}
                />
              ))}
          </>
        ) : tab === "Projets" ? (
          <>
            <Field
              label="Rechercher un projet"
              value={projectQuery}
              onChangeText={setProjectQuery}
              placeholder="Spectacle, artiste…"
            />
            {visibleProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                artwork={<ProjectArtwork project={p} />}
                subtitle={p.season ?? undefined}
                onPress={() => navigation.navigate("Project", { id: p.id })}
              />
            ))}
            {!visibleProjects.length && <Empty />}
          </>
        ) : tab === "Dates" ? (
          <DatesList
            scope={scope}
            navigate={(id) => navigation.navigate("Date", { id })}
          />
        ) : (
          <>
            <Heading
              title="Comprendre tes ventes"
              subtitle="Choisis un projet pour comparer ses tarifs"
            />
            {analysisProject ? (
              <>
                <Button
                  secondary
                  title="Changer de projet"
                  onPress={() => setAnalysisProject(null)}
                />
                <ModeSelector />
                <Evolution scope={{ ...scope, projectId: analysisProject }} />
                <Tariffs
                  scope={{ ...scope, projectId: analysisProject }}
                  navigate={(d) =>
                    navigation.navigate("Tariff", {
                      projectId: analysisProject,
                      key: d.key,
                      label: d.label,
                      category: d.category,
                    })
                  }
                />
                <Tariffs
                  scope={{ ...scope, projectId: analysisProject }}
                  kind="distributor"
                />
              </>
            ) : (
              visibleProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  artwork={<ProjectArtwork project={p} />}
                  subtitle="Tarifs, réseaux et évolution"
                  onPress={() => setAnalysisProject(p.id)}
                />
              ))
            )}
          </>
        )}
      </Page>
      <SafeAreaView
        edges={["bottom"]}
        style={{
          backgroundColor: "#222222",
          paddingHorizontal: 12,
          paddingTop: 8,
        }}
      >
        <View style={{ flexDirection: "row", paddingBottom: 8 }}>
          {(
            [
              { name: "Accueil", icon: "grid-outline" },
              { name: "Projets", icon: "albums-outline" },
              { name: "Dates", icon: "calendar-outline" },
              { name: "Analyses", icon: "stats-chart-outline" },
            ] as const
          ).map((t) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.name }}
              key={t.name}
              onPress={() => setTab(t.name)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 9,
                gap: 5,
              }}
            >
              <Icon
                name={t.icon}
                size={22}
                color={tab === t.name ? "#FFEE57" : "#C9CED6"}
              />
              <Txt
                style={{
                  color: tab === t.name ? "#FFEE57" : "#C9CED6",
                  fontSize: 11,
                  lineHeight: 15,
                  fontWeight: "600",
                }}
              >
                {t.name}
              </Txt>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <FilterSheet
        key={String(filter)}
        visible={filter}
        close={() => setFilter(false)}
      />
    </View>
  );
}
export function Dashboard({ userEmail }: { userEmail: string }) {
  const c = useTheme();
  const [ws, setWs] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const [mode, setMode] = useState<RevenueMode>("gross");
  const [picker, setPicker] = useState(false);
  const [account, setAccount] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", season: "" });
  const workspaces = useResource("bootstrap", api.bootstrap);
  const workspace =
    workspaces.data?.find((w) => w.id === ws) ?? workspaces.data?.[0];
  const cache = useMemo(() => new ReadCache(), [workspace?.id]);
  useEffect(() => () => cache.clear(), [cache]);
  const cat = useResource(workspace ? "catalog:" + workspace.id : null, (s) =>
    api.catalog(workspace!.id, s),
  );
  const dates = useResource(
    workspace && cat.data
      ? "dates:" +
          workspace.id +
          JSON.stringify(cat.data.projects.map((p) => p.id))
      : null,
    (s) => api.loadDates(workspace!.id, cat.data!.projects, s),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") workspaces.retry();
    });
    return () => listener.remove();
  }, [workspaces.retry]);
  const retry = () => {
    setRevision((n) => n + 1);
    cat.retry();
    dates.retry();
  };
  const value: ContextValue | null =
    workspace && cat.data && dates.data
      ? {
          workspace,
          catalog: cat.data,
          dates: dates.data,
          mode,
          setMode,
          retry,
          refreshing: cat.loading || dates.loading,
          refreshedAt: dates.updatedAt,
          refreshError: dates.error ?? cat.error,
          ...filters,
          setFilters,
        }
      : null;
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: "#FFEE57" }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 11,
          gap: 10,
        }}
      >
        <Image
          accessibilityLabel="Logo Bordero"
          source={require("../assets/logo.png")}
          resizeMode="contain"
          style={{ width: 29, height: 31 }}
        />
        <Txt
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#171B22",
            letterSpacing: -0.6,
          }}
        >
          Bordero
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Changer d’espace de travail"
          onPress={() => setPicker(true)}
          style={{
            flex: 1,
            padding: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            justifyContent: "flex-end",
          }}
        >
          <Txt
            numberOfLines={1}
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#171B22",
              maxWidth: 160,
            }}
          >
            {workspace?.name ?? "Espace de travail"}
          </Txt>
          <Icon name="chevron-down" size={15} color="#171B22" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mon compte"
          onPress={() => setAccount(true)}
          style={{ padding: 8 }}
        >
          <Icon name="person-circle-outline" size={27} color="#171B22" />
        </Pressable>
      </View>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {(!workspaces.data && workspaces.loading) ||
        (!cat.data && cat.loading) ||
        (!dates.data && dates.loading) ? (
          <Loading />
        ) : workspaces.error && !workspaces.data ? (
          <ErrorState error={workspaces.error} retry={workspaces.retry} />
        ) : cat.error && !cat.data ? (
          <ErrorState error={cat.error} retry={cat.retry} />
        ) : dates.error && !dates.data ? (
          <ErrorState error={dates.error} retry={dates.retry} />
        ) : !workspace ? (
          <Empty
            title="Aucun espace accessible"
            detail="Ton compte doit avoir accès aux ventes d’un projet Bordero."
          />
        ) : value ? (
          <Context.Provider value={value}>
            <ReadContext.Provider value={{ cache, revision }}>
              <NavigationContainer
                key={workspace.id + JSON.stringify(filters)}
                theme={{
                  ...(c.bg === "#0B0D10" ? DarkTheme : DefaultTheme),
                  colors: {
                    ...(c.bg === "#0B0D10" ? DarkTheme : DefaultTheme).colors,
                    background: c.bg,
                    card: c.surface,
                    text: c.text,
                    border: c.line,
                    primary: c.text,
                  },
                }}
              >
                <Stack.Navigator
                  screenOptions={{
                    headerStyle: { backgroundColor: c.bg },
                    headerTintColor: c.text,
                    headerTitleStyle: {
                      fontFamily: "DMSans",
                      fontWeight: "600",
                    },
                    headerBackTitle: "Retour",
                    contentStyle: { backgroundColor: c.bg },
                  }}
                >
                  <Stack.Screen
                    name="Main"
                    component={MainScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="Project"
                    component={ProjectScreen}
                    options={{ title: "Projet & tournée" }}
                  />
                  <Stack.Screen
                    name="Date"
                    component={DateScreen}
                    options={{ title: "Représentation" }}
                  />
                  <Stack.Screen
                    name="Tariff"
                    component={TariffScreen}
                    options={{ title: "Tarif · détail" }}
                  />
                </Stack.Navigator>
              </NavigationContainer>
            </ReadContext.Provider>
          </Context.Provider>
        ) : (
          <Loading />
        )}
        {workspaces.data &&
          (workspaces.loading || Boolean(workspaces.error)) && (
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: c.bg,
                justifyContent: "center",
                padding: 20,
              }}
            >
              {workspaces.loading ? (
                <Loading />
              ) : (
                <ErrorState error={workspaces.error} retry={workspaces.retry} />
              )}
            </View>
          )}
      </View>
      <Sheet
        visible={picker}
        close={() => setPicker(false)}
        title="Espaces de travail"
      >
        {workspaces.data?.map((w) => (
          <RowButton
            key={w.id}
            title={w.name}
            right={workspace?.id === w.id ? "✓" : undefined}
            onPress={() => {
              setWs(w.id);
              setFilters({ from: "", to: "", season: "" });
              setPicker(false);
            }}
          />
        ))}
      </Sheet>
      <Sheet
        visible={account}
        close={() => setAccount(false)}
        title="Mon compte"
      >
        <Txt>{userEmail}</Txt>
        <Notice>
          Bordero {release.displayVersion} · Build {release.build} ·
          consultation des ventes et recettes.
        </Notice>
        <Button
          title="Se déconnecter"
          onPress={() => {
            setAccount(false);
            void supabase.auth.signOut({ scope: "local" });
          }}
          secondary
        />
      </Sheet>
    </SafeAreaView>
  );
}
