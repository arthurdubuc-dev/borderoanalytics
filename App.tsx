import React, { useEffect, useState } from "react";
import {
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./src/client";
import {
  ThemeProvider,
  Txt,
  Card,
  Button,
  Field,
  Loading,
  Notice,
  pageStyle,
} from "./src/ui";
import { Dashboard } from "./src/screens";
function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEE57" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            pageStyle,
            {
              maxWidth: 470,
              flexGrow: 1,
              justifyContent: "center",
              paddingVertical: 35,
              gap: 25,
            },
          ]}
        >
          <View style={{ alignItems: "flex-start", gap: 12 }}>
            <Image
              source={require("./assets/logo.png")}
              resizeMode="contain"
              style={{ width: 67, height: 72 }}
              accessibilityLabel="Logo Bordero"
            />
            <Txt
              style={{
                fontSize: 43,
                lineHeight: 51,
                fontWeight: "700",
                color: "#171B22",
                letterSpacing: -1.5,
              }}
            >
              Bordero
            </Txt>
            <Txt style={{ fontSize: 18, lineHeight: 26, color: "#464315" }}>
              Tes ventes. Tes recettes.{"\n"}Une vue claire, où que tu sois.
            </Txt>
          </View>
          <Card>
            <Txt style={{ fontSize: 22, fontWeight: "700" }}>Bienvenue</Txt>
            <Txt muted>Connecte-toi avec ton compte Bordero Web.</Txt>
            <Field
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
            />
            <Field
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
            />
            {error && (
              <Txt accessibilityRole="alert" style={{ color: "#BB3838" }}>
                {error}
              </Txt>
            )}
            {!configured && (
              <Notice warning>
                La connexion à Bordero doit être configurée pour ce build.
              </Notice>
            )}
            <Button
              title={busy ? "Connexion…" : "Se connecter"}
              disabled={busy || !configured || !email.trim() || !password}
              onPress={() => {
                setBusy(true);
                setError(null);
                supabase.auth
                  .signInWithPassword({ email: email.trim(), password })
                  .then(({ error }) => {
                    if (error)
                      setError(
                        "Connexion impossible. Vérifie tes identifiants et ta connexion.",
                      );
                    else setPassword("");
                  })
                  .catch(() =>
                    setError(
                      "Connexion indisponible. Réessaie dans un instant.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            />
            <Button
              title="Gérer mon compte sur Bordero Web"
              onPress={() => void Linking.openURL("https://bordero.io")}
              secondary
            />
          </Card>
          <Txt style={{ textAlign: "center", fontSize: 11, color: "#464315" }}>
            TABLEAU DE BORD · ANDROID & iOS
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null | undefined>();
  const [fonts, error] = useFonts({
    DMSans: require("./assets/fonts/DMSans-Variable.ttf"),
    ...Ionicons.font,
  });
  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();
    return () => {
      active = false;
      subscription.unsubscribe();
      listener.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="dark" />
        {session === undefined || (!fonts && !error) ? (
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: "#FFEE57",
              justifyContent: "center",
            }}
          >
            <Loading />
          </SafeAreaView>
        ) : session ? (
          <Dashboard
            key={session.user.id}
            userEmail={session.user.email ?? ""}
          />
        ) : (
          <Auth />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
