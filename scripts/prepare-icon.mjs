import { writeFile } from "node:fs/promises";
import {
  generateImageAsync,
  generateImageBackgroundAsync,
  compositeImagesAsync,
} from "@expo/image-utils";
// Keep the supplied logo file intact; compose it proportionally in a yellow icon container.
const foreground = await generateImageAsync(
  { projectRoot: process.cwd(), cacheType: "bordero-icon" },
  {
    src: "./assets/logo.png",
    width: 600,
    height: 644,
    resizeMode: "contain",
    backgroundColor: "transparent",
  },
);
const background = await generateImageBackgroundAsync({
  width: 1024,
  height: 1024,
  backgroundColor: "#FFEE57",
});
await writeFile(
  "assets/app-icon.png",
  await compositeImagesAsync({
    foreground: foreground.source,
    background,
    x: 212,
    y: 190,
  }),
);
