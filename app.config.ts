import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  icon: "./assets/app-icon.png",
  name: "Bordero",
  slug: "bordero-dashboard",
  version: "0.1.0",
  scheme: "bordero-dashboard",
  orientation: "default",
  userInterfaceStyle: "automatic",
  backgroundColor: "#FFEE57",
  ios: {
    bundleIdentifier: "io.bordero.dashboard",
    buildNumber: "1",
    supportsTablet: true,
    appleTeamId: "X38VMPARWG",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: { package: "io.bordero.dashboard", versionCode: 1 },
  plugins: [
    "./plugins/with-ios-scene-lifecycle.js",
    "./plugins/with-release-run.js",
    "expo-system-ui",
    "expo-secure-store",
    "expo-font",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFEE57",
        image: "./assets/logo.png",
        imageWidth: 90,
      },
    ],
  ],
};
export default config;
