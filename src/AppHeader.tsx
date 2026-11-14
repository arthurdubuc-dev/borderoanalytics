import React from "react";
import { View, Image, Pressable } from "react-native";
import { useTheme, Txt, Icon } from "./ui";
export function AppHeader({
  workspaceName,
  onWorkspace,
  onProfile,
}: {
  workspaceName?: string;
  onWorkspace: () => void;
  onProfile: () => void;
}) {
  const c = useTheme();
  const shadow = {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: c.bg === "#0B0D10" ? 0.22 : 0.06,
    shadowRadius: 12,
    elevation: 3,
  };
  return (
    <View
      style={{
        width: "100%",
        maxWidth: 1120,
        alignSelf: "center",
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: c.bg,
      }}
    >
      <View
        style={[
          shadow,
          {
            width: 52,
            height: 52,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.accent,
          },
        ]}
      >
        <Image
          source={require("../assets/logo.png")}
          resizeMode="contain"
          style={{ width: 32, height: 35 }}
          accessibilityLabel="Logo Bordero"
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Changer d’espace de travail. ${workspaceName ?? ""}`}
        onPress={onWorkspace}
        style={({ pressed }) => [
          shadow,
          {
            flex: 1,
            minWidth: 0,
            minHeight: 52,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.surface,
            opacity: pressed ? 0.7 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Txt
            muted
            style={{
              fontSize: 9,
              lineHeight: 12,
              letterSpacing: 1,
              fontWeight: "600",
            }}
          >
            ESPACE DE TRAVAIL
          </Txt>
          <Txt
            numberOfLines={1}
            style={{ fontSize: 13, lineHeight: 19, fontWeight: "700" }}
          >
            {workspaceName ?? "Bordero"}
          </Txt>
        </View>
        <Icon name="chevron-down" size={15} color={c.muted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mon profil et apparence"
        onPress={onProfile}
        style={({ pressed }) => [
          shadow,
          {
            width: 52,
            height: 52,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.accent,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Icon name="person-outline" size={23} color="#171B22" />
      </Pressable>
    </View>
  );
}
