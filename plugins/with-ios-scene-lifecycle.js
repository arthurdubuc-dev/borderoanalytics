const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

// iOS 27 asserts at launch (EXC_BREAKPOINT via
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) unless the app adopts the
// UIScene life cycle. Expo SDK 57 ships the scene delegate itself
// (expo/ios/AppDelegates/ExpoAppSceneDelegate.swift, @objc(EXExpoAppSceneDelegate)) but no
// config-plugin wiring yet — this plugin is that wiring, kept in our own source so it survives
// `expo prebuild` instead of hand-editing the generated ios/ directory.
const SCENE_DELEGATE_CLASS_NAME = "EXExpoAppSceneDelegate";

const CONFORMANCE_ANCHOR = "class AppDelegate: ExpoAppDelegate {";
const CONFORMANCE_REPLACEMENT =
  "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {";

// Under the scene life cycle, UIKit creates the window and starts React Native from the scene
// delegate's `willConnectTo` — see ExpoAppSceneDelegate.swift. `application(didFinishLaunching:)`
// must stop doing that itself, or the bridge starts twice (once per delegate). The factory itself
// stays here: "the factory is still owned by the app delegate" per Expo's own doc comment on
// ExpoReactNativeFactoryProvider — the scene delegate only reads it back through that protocol.
const STARTUP_BLOCK = `
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

function configureAppDelegateForSceneLifecycle(contents) {
  if (contents.includes("ExpoReactNativeFactoryProvider")) return contents;
  if (!contents.includes(CONFORMANCE_ANCHOR)) {
    throw new Error(
      "Expo AppDelegate.swift template changed: expected 'class AppDelegate: ExpoAppDelegate {'",
    );
  }
  if (!contents.includes(STARTUP_BLOCK)) {
    throw new Error(
      "Expo AppDelegate.swift template changed: expected the iOS/tvOS window+startReactNative block " +
        "(now owned by the scene delegate) inside application(didFinishLaunchingWithOptions:)",
    );
  }
  return contents
    .replace(CONFORMANCE_ANCHOR, CONFORMANCE_REPLACEMENT)
    .replace(STARTUP_BLOCK, "");
}

// Native directories are generated: this durably follows every `npm run native:*`, never a
// hand edit of the generated ios/ tree.
module.exports = (config) => {
  config = withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== "swift")
      throw new Error("Expected a Swift AppDelegate");
    mod.modResults.contents = configureAppDelegateForSceneLifecycle(
      mod.modResults.contents,
    );
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      // One scene per app instance — this is what removes the iOS 27 launch assertion. True
      // multi-window (Stage Manager-style concurrent scenes) is a separate, much bigger feature
      // React Native doesn't support; it is not required for iPad, Split View, or landscape.
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS_NAME,
          },
        ],
      },
    };
    return mod;
  });
};
