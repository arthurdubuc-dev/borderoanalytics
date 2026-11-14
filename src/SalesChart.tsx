import React, { useRef, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Txt, useTheme, Icon, Notice } from "./ui";
import { compact, exact, dayLabel, type TimelinePoint } from "./domain";
import {
  chartWindow,
  periodStats,
  type ChartMetric,
  type ChartMode,
} from "./analytics";
function Choice<T extends string | number>({
  values,
  value,
  onChange,
}: {
  values: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {values.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item.key }}
          onPress={() => onChange(item.key)}
          style={{
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: value === item.key ? c.text : c.secondary,
          }}
        >
          <Txt
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: value === item.key ? c.surface : c.muted,
            }}
          >
            {item.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
export function SalesChart({ points }: { points: TimelinePoint[] }) {
  const c = useTheme();
  const chartScroll = useRef<ScrollView>(null);
  const [metric, setMetric] = useState<ChartMetric>("gross");
  const [mode, setMode] = useState<ChartMode>("daily");
  const [period, setPeriod] = useState(30);
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState(300);
  const data = chartWindow(points, period, metric, mode);
  const daily = chartWindow(points, period, metric, "daily");
  const stats = periodStats(daily);
  const known = data.filter((p) => p.value !== null);
  const pick = data.find((p) => p.day === selected) ?? known.at(-1);
  const money = metric === "gross";
  const min = Math.min(0, ...known.map((p) => p.value!));
  const max = Math.max(1, ...known.map((p) => p.value!));
  const range = max - min;
  const height = 176;
  const chartWidth = Math.max(width, data.length * (mode === "daily" ? 8 : 3));
  const step = chartWidth / Math.max(data.length, 1);
  const y = (v: number) => ((max - v) / range) * height;
  const zero = y(0);
  const blue = "#4885FF";
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Choice
          values={[
            { key: "gross", label: "CA public TTC" },
            { key: "tickets", label: "Billets" },
          ]}
          value={metric}
          onChange={setMetric}
        />
        <Choice
          values={[
            { key: "daily", label: "Par jour" },
            { key: "cumulative", label: "Cumul total" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>
      <Choice
        values={[
          { key: 7, label: "7 jours" },
          { key: 30, label: "30 jours" },
          { key: 90, label: "90 jours" },
          { key: 0, label: "Tout" },
        ]}
        value={period}
        onChange={setPeriod}
      />
      <View
        style={{
          backgroundColor: c.secondary,
          borderRadius: 18,
          padding: 16,
          gap: 6,
        }}
      >
        <Txt muted style={{ fontSize: 11, letterSpacing: 1 }}>
          {mode === "daily" ? "JOURNÉE SÉLECTIONNÉE" : "CUMUL À CETTE DATE"}
        </Txt>
        <Txt
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            fontSize: 32,
            lineHeight: 44,
            fontWeight: "700",
            letterSpacing: -1,
          }}
        >
          {exact(pick?.value ?? null, money)}
        </Txt>
        <Txt muted style={{ fontSize: 12 }}>
          {pick ? dayLabel(pick.day) : "Aucune observation"} ·{" "}
          {money ? "Recette publique TTC" : "Billets vendus"}
        </Txt>
      </View>
      {!known.length ? (
        <Notice>
          Aucune mesure journalière comparable sur cette période. Essaie le
          cumul total ou une période plus longue.
        </Notice>
      ) : null}
      <View
        onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width - 44))}
        style={{ flexDirection: "row", gap: 8 }}
      >
        <View
          style={{
            width: 36,
            height: height + 4,
            justifyContent: "space-between",
          }}
        >
          {[max, (max + min) / 2, min].map((n, i) => (
            <Txt key={i} muted style={{ fontSize: 9 }}>
              {Math.abs(n) >= 1000
                ? compact(n)
                : new Intl.NumberFormat("fr-FR", {
                    maximumFractionDigits: 0,
                  }).format(n)}
            </Txt>
          ))}
        </View>
        <ScrollView
          horizontal
          ref={chartScroll}
          onContentSizeChange={() =>
            chartScroll.current?.scrollToEnd({ animated: false })
          }
          showsHorizontalScrollIndicator={chartWidth > width}
          style={{ flex: 1 }}
          contentContainerStyle={{ width: chartWidth, paddingBottom: 6 }}
        >
          <View style={{ width: chartWidth, height: height + 6 }}>
            {[0, height / 2, height].map((top, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top,
                  borderTopWidth: 1,
                  borderColor: c.line,
                  borderStyle: "dashed",
                }}
              />
            ))}
            {min < 0 && (
              <View
                style={{
                  position: "absolute",
                  top: zero,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: c.muted,
                }}
              />
            )}
            {data.map((p, i) => {
              const v = p.value;
              const prev = data[i - 1];
              const active = pick?.day === p.day;
              const color = v !== null && v < 0 ? "#EB6586" : blue;
              const segment =
                mode === "cumulative" &&
                v !== null &&
                prev?.value !== null &&
                prev?.value !== undefined;
              const dy = segment ? y(v!) - y(prev!.value!) : 0;
              const length = Math.sqrt(step * step + dy * dy);
              return (
                <React.Fragment key={p.day}>
                  {segment && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: (i - 0.5) * step + step / 2 - length / 2,
                        top: (y(prev!.value!) + y(v!)) / 2,
                        width: length,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: blue,
                        transform: [{ rotate: Math.atan2(dy, step) + "rad" }],
                      }}
                    />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${dayLabel(p.day)} : ${exact(v, money)}`}
                    onPress={() => setSelected(p.day)}
                    style={{
                      position: "absolute",
                      left: i * step,
                      top: 0,
                      width: step,
                      height: height + 6,
                    }}
                  >
                    {active && (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: step / 2,
                          width: 1,
                          backgroundColor: c.muted,
                          opacity: 0.4,
                        }}
                      />
                    )}
                    {v === null ? (
                      <View
                        style={{
                          position: "absolute",
                          left: step / 2 - 1,
                          top: zero - 3,
                          width: 2,
                          height: 3,
                          backgroundColor: c.line,
                        }}
                      />
                    ) : mode === "daily" ? (
                      <View
                        style={{
                          position: "absolute",
                          left: Math.max(1, step * 0.15),
                          width: Math.max(2, step * 0.7),
                          top: Math.min(y(v), zero),
                          height: Math.max(2, Math.abs(y(v) - zero)),
                          borderRadius: 4,
                          backgroundColor: active ? c.text : color,
                          opacity: active ? 1 : 0.8,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          position: "absolute",
                          left: step / 2 - (active ? 4 : 2),
                          top: y(v) - (active ? 4 : 2),
                          width: active ? 8 : 4,
                          height: active ? 8 : 4,
                          borderRadius: 8,
                          backgroundColor: active ? c.text : blue,
                        }}
                      />
                    )}
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Txt muted style={{ fontSize: 10 }}>
          {data[0] ? dayLabel(data[0].day, true) : ""}
        </Txt>
        <Txt muted style={{ fontSize: 10 }}>
          {data.at(-1) ? dayLabel(data.at(-1)!.day, true) : ""}
        </Txt>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          [
            "Sur la période",
            stats.total === null ? "—" : compact(stats.total, money),
          ],
          [
            "Moyenne / jour",
            stats.average === null ? "—" : compact(stats.average, money),
          ],
          ["Meilleur jour", stats.best ? dayLabel(stats.best.day, true) : "—"],
        ].map(([label, value]) => (
          <View
            key={label}
            style={{
              flex: 1,
              minWidth: 90,
              padding: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.line,
              gap: 6,
            }}
          >
            <Txt muted style={{ fontSize: 10 }}>
              {label}
            </Txt>
            <Txt style={{ fontSize: 17, fontWeight: "700" }}>{value}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 7 }}>
        <Icon name="information-circle-outline" size={16} color={c.muted} />
        <Txt muted style={{ fontSize: 11, lineHeight: 17, flex: 1 }}>
          {stats.covered}/{daily.length} jours avec mesure quotidienne. Les
          totaux de période portent sur ces jours uniquement. Les trous et
          remontées groupées ne valent pas zéro. Les corrections peuvent être
          négatives.
          {mode === "cumulative"
            ? " Le cumul conserve les ventes antérieures à la fenêtre affichée."
            : ""}{" "}
          Appuie sur le graphique pour lire une valeur exacte.
        </Txt>
      </View>
    </View>
  );
}
