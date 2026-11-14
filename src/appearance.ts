export type AppearanceMode = "light" | "dark" | "system";
export const APPEARANCE_KEY = "bordero.appearance.v1";
export function appearanceMode(value: unknown): AppearanceMode {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolvedAppearance(
  mode: AppearanceMode,
  system: string | null | undefined,
): "light" | "dark" {
  return mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
}
/** Serial writes keep the last choice when a user switches modes quickly. */
export class AppearanceStore {
  private writes: Promise<void> = Promise.resolve();
  constructor(
    private storage: {
      read: () => Promise<string | null>;
      write: (mode: AppearanceMode) => Promise<void>;
    },
  ) {}
  async load(): Promise<AppearanceMode> {
    return appearanceMode(await this.storage.read());
  }
  save(mode: AppearanceMode): Promise<void> {
    const write = this.writes
      .catch(() => {})
      .then(() => this.storage.write(mode));
    this.writes = write;
    return write;
  }
}
