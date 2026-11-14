import type { ExpoConfig } from "expo/config";
import { release } from "./src/release.ts";
const config: ExpoConfig = {
  icon: "./assets/app-icon.png",
  name: "Bordero",
  slug: "bordero-dashboard",
  version: release.version,
  scheme: "bordero-dashboard",
  orientation: "default",
  userInterfaceStyle: "automatic",
  backgroundColor: "#FFEE57",
  ios: {
    bundleIdentifier: "io.bordero.dashboard",
    buildNumber: String(release.build),
    supportsTablet: true,
    appleTeamId: "X38VMPARWG",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: { package: "io.bordero.dashboard", versionCode: release.build },
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
