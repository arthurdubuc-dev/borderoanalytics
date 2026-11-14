import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Txt, useTheme, Notice } from "./ui";
import { exact, compact } from "./domain";
import {
  ringPath,
  sliceAt,
  ticketingSlices,
  type TicketingInput,
} from "./ticketingGeometry";

export function TicketingPie({ items }: { items: readonly TicketingInput[] }) {
  const c = useTheme();
  const signature = JSON.stringify(
    items.map(({ key, label, tickets }) => ({ key, label, tickets })),
  );
  const model = useMemo(
    () => ticketingSlices(JSON.parse(signature) as TicketingInput[]),
    [signature],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState(300);
  const [progress, setProgress] = useState(0);
  const animation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    const listener = animation.addListener(({ value }) => setProgress(value));
    const start = (reduce: boolean) => {
      if (!alive) return;
      animation.stopAnimation();
      animation.setValue(reduce ? 1 : 0);
      if (!reduce)
        Animated.timing(animation, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
    };
    AccessibilityInfo.isReduceMotionEnabled().then(start, () => start(true));
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      start,
    );
    setSelected(null);
    return () => {
      alive = false;
      subscription.remove();
      animation.stopAnimation();
      animation.removeListener(listener);
    };
  }, [animation, signature]);
  if (!model)
    return (
      <Notice warning>
        Les volumes disponibles ne permettent pas une répartition fiable.
        Consulte le détail des billetteries.
      </Notice>
    );
  if (!model.total)
    return <Notice>Aucun billet ventilé sur ce périmètre.</Notice>;
  const active = model.slices.find((s) => s.key === selected) ?? null;
  const size = Math.min(width >= 620 ? 260 : width, 280);
  const choose = (x: number, y: number) => {
    const slice = sliceAt(model.slices, (x / size) * 240, (y / size) * 240);
    if (slice) setSelected(slice.key);
  };
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ gap: 16 }}
    >
      <Txt muted style={{ fontSize: 12 }}>
        Parts des billets ventilés · touche une part ou une billetterie
      </Txt>
      <View
        style={{
          flexDirection: width >= 620 ? "row" : "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Pressable
          accessibilityRole="image"
          accessibilityLabel={`Répartition de ${exact(model.total)} billets par billetterie. Utilise la légende pour sélectionner une billetterie.`}
          onPress={(e) =>
            choose(e.nativeEvent.locationX, e.nativeEvent.locationY)
          }
          onPointerMove={(e) => {
            if (
              e.nativeEvent.pointerType === "mouse" ||
              e.nativeEvent.pointerType === "pen"
            )
              choose(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          }}
          style={{ width: size, height: size }}
        >
          <Svg
            pointerEvents="none"
            width={size}
            height={size}
            viewBox="0 0 240 240"
          >
            <Path
              d={ringPath(-Math.PI / 2, Math.PI * 1.5)}
              fill={c.secondary}
            />
            {model.slices.map((s) => {
              const reveal = Math.min(
                s.end,
                -Math.PI / 2 + Math.PI * 2 * progress,
              );
              const gap =
                model.slices.length === 1
                  ? 0
                  : Math.min(0.018, (s.end - s.start) * 0.12);
              return (
                <Path
                  key={s.key}
                  d={ringPath(
                    s.start + gap,
                    reveal - gap,
                    active?.key === s.key ? 106 : 100,
                  )}
                  fill={s.color}
                  opacity={active && active.key !== s.key ? 0.45 : 1}
                />
              );
            })}
          </Svg>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt style={{ fontSize: 29, lineHeight: 36, fontWeight: "700" }}>
              {compact(active?.tickets ?? model.total)}
            </Txt>
            <Txt muted style={{ fontSize: 12 }}>
              {active ? "billets vendus" : "billets ventilés"}
            </Txt>
            {active && (
              <Txt style={{ fontSize: 15, fontWeight: "700", marginTop: 4 }}>
                {(active.share * 100).toLocaleString("fr-FR", {
                  maximumFractionDigits: 1,
                })}{" "}
                %
              </Txt>
            )}
          </View>
        </Pressable>
        <View
          style={{
            gap: 4,
            flex: width >= 620 ? 1 : undefined,
            alignSelf: "stretch",
            justifyContent: "center",
          }}
        >
          {model.slices.map((s, index) => (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active?.key === s.key }}
              accessibilityLabel={`${s.label}, ${exact(s.tickets)} billets, ${(s.share * 100).toFixed(1)} pour cent`}
              onPress={() => setSelected(s.key)}
              onHoverIn={() => setSelected(s.key)}
              style={{
                minHeight: 48,
                padding: 10,
                borderRadius: 14,
                backgroundColor:
                  active?.key === s.key ? c.secondary : "transparent",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: s.color,
                }}
              />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontSize: 14, fontWeight: "700" }}>{s.label}</Txt>
                {index === 0 && (
                  <Txt muted style={{ fontSize: 11 }}>
                    Première billetterie en volume
                  </Txt>
                )}
              </View>
              <Txt style={{ fontWeight: "700" }}>
                {(s.share * 100).toLocaleString("fr-FR", {
                  maximumFractionDigits: 1,
                })}{" "}
                %
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>
      <View
        accessibilityLiveRegion="polite"
        style={{
          padding: 14,
          borderRadius: 16,
          backgroundColor: c.secondary,
          gap: 3,
        }}
      >
        <Txt style={{ fontWeight: "700" }}>
          {active?.label ?? "Ensemble des billetteries"}
        </Txt>
        <Txt>
          {exact(active?.tickets ?? model.total)} billets
          {active
            ? ` · ${(active.share * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % des billets ventilés`
            : ""}
        </Txt>
      </View>
    </View>
  );
}
