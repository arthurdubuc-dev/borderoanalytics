import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  compact,
  exact,
  dayLabel,
  errorMessage,
  type TimelinePoint,
} from "./domain";
const light = {
  bg: "#F6F7F8",
  surface: "#FFFFFF",
  text: "#171B22",
  muted: "#687180",
  line: "#E2E5E9",
  secondary: "#F0F2F4",
  accent: "#FFEE57",
  warning: "#805000",
  danger: "#A32626",
};
const dark = {
  ...light,
  bg: "#0B0D10",
  surface: "#171B22",
  text: "#F7F8FA",
  muted: "#AAB2BF",
  line: "#343B46",
  secondary: "#222832",
  warning: "#FFD282",
  danger: "#FF9A9A",
};
export const Theme = createContext(light);
export const useTheme = () => useContext(Theme);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return (
    <Theme.Provider value={scheme === "dark" ? dark : light}>
      {children}
    </Theme.Provider>
  );
}
export function Txt({
  children,
  style,
  muted = false,
  ...props
}: React.ComponentProps<typeof Text> & { muted?: boolean }) {
  const c = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: "DMSans",
          fontSize: 15,
          lineHeight: 22,
          color: muted ? c.muted : c.text,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 21,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  const c = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? c.text}
      accessible={false}
    />
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 18,
        paddingVertical: 13,
        borderRadius: 15,
        backgroundColor: secondary ? c.secondary : c.accent,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
      })}
    >
      {icon && (
        <Icon name={icon} size={19} color={secondary ? c.text : "#171B22"} />
      )}
      <Txt style={{ fontWeight: "700", color: secondary ? c.text : "#171B22" }}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: 22,
          padding: 20,
          borderWidth: 1,
          borderColor: c.line,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 5, marginTop: 10, marginBottom: 4 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Txt
          accessibilityRole="header"
          style={{ fontSize: 23, lineHeight: 30, fontWeight: "700", flex: 1 }}
        >
          {title}
        </Txt>
        {action}
      </View>
      {subtitle && <Txt muted>{subtitle}</Txt>}
    </View>
  );
}
export function Notice({
  children,
  warning = false,
}: {
  children: React.ReactNode;
  warning?: boolean;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.secondary,
        padding: 15,
        borderRadius: 14,
        flexDirection: "row",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <Icon
        name={warning ? "information-circle-outline" : "ellipse-outline"}
        size={20}
        color={warning ? c.warning : c.muted}
      />
      <Txt
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 20,
          color: warning ? c.warning : c.muted,
        }}
      >
        {children}
      </Txt>
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 32, alignItems: "center", gap: 12 }}>
      <ActivityIndicator color="#B8A600" />
      <Txt muted>Chargement des données…</Txt>
    </View>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <Card>
      <Icon name="cloud-offline-outline" size={30} />
      <Txt>{errorMessage(error)}</Txt>
      <Button title="Réessayer" onPress={retry} secondary />
    </Card>
  );
}
export function Empty({
  title = "Aucune donnée pour ce périmètre",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <Card>
      <Icon name="file-tray-outline" size={28} />
      <Txt style={{ fontWeight: "700" }}>{title}</Txt>
      {detail && <Txt muted>{detail}</Txt>}
    </Card>
  );
}
export function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Txt style={{ fontSize: 13, fontWeight: "600" }}>{label}</Txt>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        style={[
          {
            padding: 15,
            minHeight: 52,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 14,
            color: c.text,
            backgroundColor: c.surface,
            fontSize: 16,
            fontFamily: "DMSans",
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Kpi({
  label,
  value,
  money = false,
  note,
  hero = false,
}: {
  label: string;
  value: number | null;
  money?: boolean;
  note?: string;
  hero?: boolean;
}) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => sub.remove();
  }, []);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${exact(value, money)}. ${open ? "Replier" : "Afficher le chiffre exact"}`}
      accessibilityState={{ expanded: open, disabled: value === null }}
      disabled={value === null}
      onPress={() => {
        if (!reduce)
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((v) => !v);
      }}
      style={({ pressed }) => ({
        borderRadius: 22,
        padding: 22,
        borderWidth: 1,
        borderColor: hero ? c.accent : c.line,
        backgroundColor: hero ? c.accent : c.surface,
        opacity: pressed ? 0.85 : 1,
        gap: 12,
        flex: 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Txt
          style={{
            color: hero ? "#35330E" : c.muted,
            fontSize: 13,
            lineHeight: 19,
            flex: 1,
            fontWeight: "600",
          }}
        >
          {label}
        </Txt>
        <Icon
          name={open ? "chevron-up" : "chevron-down"}
          size={17}
          color={hero ? "#171B22" : c.muted}
        />
      </View>
      <Txt
        style={{
          fontSize: 42,
          lineHeight: 51,
          fontWeight: "700",
          letterSpacing: -1.8,
          color: hero ? "#171B22" : c.text,
        }}
      >
        {compact(value, money)}
      </Txt>
      {note && (
        <Txt
          style={{
            fontSize: 12,
            lineHeight: 18,
            color: hero ? "#464315" : c.muted,
          }}
        >
          {note}
        </Txt>
      )}
      {open && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: hero ? "#D8C940" : c.line,
            paddingTop: 12,
            gap: 3,
          }}
        >
          <Txt style={{ fontSize: 11, color: hero ? "#464315" : c.muted }}>
            CHIFFRE EXACT
          </Txt>
          <Txt
            selectable
            style={{
              fontSize: 21,
              lineHeight: 29,
              fontWeight: "700",
              color: hero ? "#171B22" : c.text,
            }}
          >
            {exact(value, money)}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}
export function KpiGrid({ children }: { children: React.ReactNode }) {
  const { width, fontScale } = useWindowDimensions();
  return (
    <View
      style={{
        flexDirection: width < 460 || fontScale > 1.2 ? "column" : "row",
        gap: 14,
        alignItems: "stretch",
      }}
    >
      {children}
    </View>
  );
}
export function RowButton({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 17,
        backgroundColor: pressed ? c.secondary : c.surface,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: c.line,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
      })}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Txt style={{ fontWeight: "700" }}>{title}</Txt>
        {subtitle && (
          <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      {right && (
        <Txt style={{ fontWeight: "700", maxWidth: "40%", textAlign: "right" }}>
          {right}
        </Txt>
      )}
      <Icon name="chevron-forward" size={17} color={c.muted} />
    </Pressable>
  );
}
export function TrendChart({
  points,
  money = false,
}: {
  points: TimelinePoint[];
  money?: boolean;
}) {
  const c = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const sampled =
    points.length > 48
      ? points.filter(
          (_, i) =>
            i % Math.ceil(points.length / 48) === 0 || i === points.length - 1,
        )
      : points;
  const values = sampled.map((p) => (money ? p.gross : p.tickets));
  const valid = values.filter((v): v is number => v !== null);
  if (!valid.length)
    return (
      <Notice>Pas encore d’historique comparable pour cette mesure.</Notice>
    );
  const max = Math.max(...valid.map(Math.abs), 1);
  const pick = points.find((p) => p.day === selected) ?? points.at(-1);
  return (
    <View style={{ gap: 15 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <Txt muted style={{ fontSize: 12 }}>
          {pick ? dayLabel(pick.day, true) : ""}
        </Txt>
        <Txt style={{ fontWeight: "700", fontSize: 18 }}>
          {exact(pick ? (money ? pick.gross : pick.tickets) : null, money)}
        </Txt>
      </View>
      <View
        accessibilityLabel="Évolution cumulée. Appuie sur une barre pour lire sa valeur."
        style={{
          height: 135,
          flexDirection: "row",
          gap: 3,
          alignItems: "flex-end",
        }}
      >
        {sampled.map((p, i) => {
          const value = values[i];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(p.day)} : ${exact(value ?? null, money)}`}
              key={p.day}
              onPress={() => setSelected(p.day)}
              style={{ flex: 1, height: 135, justifyContent: "flex-end" }}
            >
              <View
                style={{
                  height:
                    value == null
                      ? 2
                      : Math.max(3, (Math.abs(value) / max) * 135),
                  backgroundColor:
                    value === null
                      ? c.line
                      : p.day === selected
                        ? c.text
                        : c.accent,
                  borderRadius: 4,
                  opacity: value === null ? 0.3 : 1,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Txt muted style={{ fontSize: 11 }}>
          {dayLabel(sampled[0]!.day, true)}
        </Txt>
        <Txt muted style={{ fontSize: 11 }}>
          {dayLabel(sampled.at(-1)!.day, true)}
        </Txt>
      </View>
      <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>
        Cumuls observés · les remontées peuvent couvrir plusieurs jours. Les
        absences de données ne valent pas zéro.
      </Txt>
    </View>
  );
}
export const pageStyle: ViewStyle = {
  width: "100%",
  maxWidth: 1120,
  alignSelf: "center",
  padding: 20,
  gap: 16,
  paddingBottom: 35,
};
