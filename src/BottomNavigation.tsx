import React from "react";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, Icon, Txt } from "./ui";
export type MainTab = "Accueil" | "Projets" | "Dates" | "Analyses" | "Hôtels";
export function BottomNavigation({
  active,
  onChange,
  onHeightChange,
}: {
  active: string;
  onChange: (tab: MainTab) => void;
  onHeightChange?: (height: number) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        backgroundColor: "transparent",
        paddingBottom: Math.max(insets.bottom, 12),
        paddingHorizontal: 12,
        paddingTop: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          maxWidth: 640,
          alignSelf: "center",
          padding: 6,
          marginBottom: 10,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 14,
          elevation: 3,
        }}
      >
        {(
          [
            { name: "Accueil", icon: "grid-outline" },
            { name: "Projets", icon: "albums-outline" },
            { name: "Dates", icon: "calendar-outline" },
            { name: "Analyses", icon: "stats-chart-outline" },
            { name: "Hôtels", icon: "bed-outline" },
          ] as const
        ).map((t) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active === t.name }}
            key={t.name}
            onPress={() => onChange(t.name)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 10,
              gap: 5,
              borderRadius: 18,
              backgroundColor: active === t.name ? c.secondary : "transparent",
            }}
          >
            <Icon
              name={t.icon}
              size={22}
              color={active === t.name ? c.text : c.muted}
            />
            <Txt
              style={{
                color: active === t.name ? c.text : c.muted,
                fontSize: 10,
                lineHeight: 15,
                fontWeight: "600",
              }}
            >
              {t.name}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
