import { describe, it, expect } from "vitest";
import {
  appearanceMode,
  resolvedAppearance,
  AppearanceStore,
  type AppearanceMode,
} from "../src/appearance";
describe("préférence jour / nuit / automatique", () => {
  it("suit le système et conserve un choix explicite", () => {
    expect(resolvedAppearance("system", "dark")).toBe("dark");
    expect(resolvedAppearance("system", "light")).toBe("light");
    expect(resolvedAppearance("system", null)).toBe("light");
    expect(resolvedAppearance("light", "dark")).toBe("light");
    expect(resolvedAppearance("dark", "light")).toBe("dark");
  });
  it("restaure le choix sauvegardé et ignore une valeur obsolète", async () => {
    expect(appearanceMode("unexpected")).toBe("system");
    expect(appearanceMode(null)).toBe("system");
    const store = new AppearanceStore({
      read: async () => "dark",
      write: async () => {},
    });
    expect(await store.load()).toBe("dark");
  });
  it("conserve le dernier choix même lors de changements rapides", async () => {
    let release!: () => void;
    const writes: AppearanceMode[] = [];
    let saved: AppearanceMode = "system";
    const store = new AppearanceStore({
      read: async () => saved,
      write: async (mode) => {
        writes.push(mode);
        if (mode === "dark")
          await new Promise<void>((r) => {
            release = r;
          });
        saved = mode;
      },
    });
    const first = store.save("dark");
    const last = store.save("light");
    await Promise.resolve();
    await Promise.resolve();
    expect(writes).toEqual(["dark"]);
    release();
    await Promise.all([first, last]);
    expect(await store.load()).toBe("light");
  });
  it("permet de réessayer après un échec de stockage", async () => {
    let attempts = 0;
    let saved = "system";
    const store = new AppearanceStore({
      read: async () => saved,
      write: async (mode) => {
        if (attempts++ === 0) throw new Error("storage unavailable");
        saved = mode;
      },
    });
    await expect(store.save("dark")).rejects.toThrow();
    await store.save("dark");
    expect(await store.load()).toBe("dark");
  });
});
