import React from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useTheme, useAppearance, Txt, Icon, Heading, Button } from "./ui";
export function AppearanceSettings() {
  const c = useTheme();
  const appearance = useAppearance();
  return (
    <View style={{ gap: 12 }}>
      <Heading
        title="Apparence"
        subtitle="Un affichage adapté à ton environnement."
      />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Mode d’affichage"
        style={{ gap: 8 }}
      >
        {(
          [
            {
              key: "light",
              label: "Jour",
              icon: "sunny-outline",
              description: "Fond clair, lecture lumineuse.",
            },
            {
              key: "dark",
              label: "Nuit",
              icon: "moon-outline",
              description: "Fond sombre, contrastes doux.",
            },
            {
              key: "system",
              label: "Automatique",
              icon: "phone-portrait-outline",
              description: "Suit les réglages de ton téléphone.",
            },
          ] as const
        ).map((option) => {
          const selected = appearance.mode === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.label}. ${option.description}`}
              onPress={() => appearance.setMode(option.key)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 18,
                minHeight: 72,
                borderWidth: 1,
                borderColor: selected ? c.text : c.line,
                backgroundColor: selected ? c.secondary : c.surface,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  backgroundColor: c.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={option.icon} size={21} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt
                  style={{ fontWeight: "700", fontSize: 14, lineHeight: 20 }}
                >
                  {option.label}
                </Txt>
                <Txt muted style={{ fontSize: 12, lineHeight: 18 }}>
                  {option.description}
                </Txt>
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: selected ? c.accent : "transparent",
                  borderWidth: selected ? 0 : 1,
                  borderColor: c.line,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selected && (
                  <Icon name="checkmark" size={16} color="#171B22" />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      {appearance.saving ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <ActivityIndicator size="small" color={c.muted} />
          <Txt muted style={{ fontSize: 12 }}>
            Enregistrement…
          </Txt>
        </View>
      ) : (
        <Txt muted style={{ fontSize: 11, lineHeight: 17 }}>
          Le choix est conservé sur ce téléphone.
        </Txt>
      )}
      {appearance.error && (
        <View style={{ gap: 8 }}>
          <Txt
            accessibilityRole="alert"
            style={{ color: c.danger, fontSize: 12, lineHeight: 18 }}
          >
            Le mode est appliqué, mais son enregistrement a échoué.
          </Txt>
          <Button
            secondary
            title="Réessayer l’enregistrement"
            onPress={() => appearance.setMode(appearance.mode)}
          />
        </View>
      )}
    </View>
  );
}
