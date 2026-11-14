import { createClient } from "@supabase/supabase-js";
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
      storageKey: "bordero-dashboard-session",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
export async function request<T>(
  path: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("SESSION");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(cancel, 25000);
  try {
    const response = await fetch(url + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (response.status === 401) {
      void supabase.auth.signOut({ scope: "local" });
      throw new Error("SESSION");
    }
    if (response.status === 403) throw new Error("FORBIDDEN");
    if (!response.ok)
      throw new Error(
        path.includes("mobile-dashboard") &&
        [404, 503].includes(response.status)
          ? "BACKEND_UNAVAILABLE"
          : "NETWORK",
      );
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
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
