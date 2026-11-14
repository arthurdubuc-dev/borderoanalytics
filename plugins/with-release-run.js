const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");
module.exports = (config) =>
  withDangerousMod(config, [
    "ios",
    async (config) => {
      const root = config.modRequest.platformProjectRoot;
      const scheme = path.join(
        root,
        "Bordero.xcodeproj/xcshareddata/xcschemes/Bordero.xcscheme",
      );
      if (fs.existsSync(scheme)) {
        const xml = fs.readFileSync(scheme, "utf8");
        fs.writeFileSync(
          scheme,
          xml.replace(
            /(<LaunchAction[\s\S]*?buildConfiguration = ")[^"]+/,
            "$1Release",
          ),
        );
      }
      fs.writeFileSync(
        path.join(root, ".xcode.env"),
        "export NODE_BINARY=$(command -v node)\n",
      );
      fs.writeFileSync(
        path.join(root, ".xcode.env.local"),
        `export NODE_BINARY=${JSON.stringify(process.execPath)}\n`,
      );
      return config;
    },
  ]);
