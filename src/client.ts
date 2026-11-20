import { createReadTransport } from "./transport";
import { ReadError } from "./readPolicy";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
function isPublicKey(value: string): boolean {
  if (value.startsWith("sb_publishable_")) return true;
  try {
    return JSON.parse(atob(value.split(".")[1] ?? "")).role === "anon";
  } catch {
    return false;
  }
}
export const configured =
  /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) && isPublicKey(key);
// Small chunks support refresh tokens larger than the platform keychain item limit.
const storage = {
  async getItem(name: string) {
    const raw = await SecureStore.getItemAsync(name);
    if (!raw) return null;
    if (!raw.startsWith("chunks:")) return raw;
    const count = Number(raw.slice(7));
    if (!Number.isInteger(count) || count < 1 || count > 64) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${name}.${i}`),
      ),
    );
    return parts.some((p) => p === null) ? null : parts.join("");
  },
  async setItem(name: string, value: string) {
    await storage.removeItem(name);
    const parts = value.match(/[\s\S]{1,1500}/g) ?? [""];
    for (let i = 0; i < parts.length; i++)
      await SecureStore.setItemAsync(`${name}.${i}`, parts[i]!, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    await SecureStore.setItemAsync(name, `chunks:${parts.length}`, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(name: string) {
    const old = await SecureStore.getItemAsync(name);
    await SecureStore.deleteItemAsync(name);
    if (old?.startsWith("chunks:")) {
      const n = Math.min(64, Number(old.slice(7)) || 0);
      await Promise.all(
        Array.from({ length: n }, (_, i) =>
          SecureStore.deleteItemAsync(`${name}.${i}`),
        ),
      );
    }
  },
};
export const supabase = createClient(
  configured ? url : "https://unconfigured.supabase.co",
  key || "unconfigured",
  {
    auth: {
      storage,
      lock: processLock,
      storageKey: "bordero-dashboard-session",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
const transport = createReadTransport({
  url,
  key,
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new ReadError("NETWORK");
    return data.session;
  },
  refreshSession: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      if ([400, 401, 403].includes(error.status ?? 0)) return null;
      throw new ReadError("NETWORK");
    }
    return data.session;
  },
  onInvalidSession: () => {
    void supabase.auth.signOut({ scope: "local" });
  },
});
export const request = transport.request;
export const mutateHotelPayment = transport.mutate;
export const imageRequest = transport.image;
export function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
) {
  return request<T>("/rest/v1/rpc/" + name, signal, args);
}
export async function table<T>(
  name: string,
  params: Record<string, string>,
  signal: AbortSignal,
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const q = new URLSearchParams({
      ...params,
      limit: "500",
      offset: String(offset),
    });
    const page = await request<T[]>(`/rest/v1/${name}?${q}`, signal);
    result.push(...page);
    if (page.length < 500) return result;
    if (offset >= 50000) throw new Error("TOO_LARGE");
  }
}
