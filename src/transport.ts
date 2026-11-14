import { abortError, ReadError } from "./readPolicy";
import { ReadQueue } from "./readQueue";
interface SessionIdentity {
  access_token: string;
  user: { id: string };
  expires_at?: number;
}
interface Options {
  url: string;
  key: string;
  getSession: () => Promise<SessionIdentity | null>;
  refreshSession: () => Promise<SessionIdentity | null>;
  onInvalidSession: () => void;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}
export function createReadTransport(options: Options) {
  const fetcher = options.fetcher ?? fetch;
  const expensive = new ReadQueue(2);
  let refreshing: Promise<SessionIdentity | null> | undefined;
  function refresh() {
    if (!refreshing) {
      refreshing = options.refreshSession().finally(() => {
        refreshing = undefined;
      });
    }
    return refreshing;
  }
  async function read<T>(
    path: string,
    signal: AbortSignal,
    body?: unknown,
    binary = false,
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new ReadError("CONTRACT");
    if (signal.aborted) throw abortError();
    const initial = await options.getSession();
    if (!initial) throw new ReadError("SESSION");
    let session = initial;
    if (initial.expires_at && initial.expires_at * 1000 < Date.now() + 15000) {
      const next = await refresh();
      if (!next) {
        options.onInvalidSession();
        throw new ReadError("SESSION");
      }
      if (next.user.id !== initial.user.id) throw abortError();
      session = next;
    }
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) controller.abort();
    const timer = setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      options.timeoutMs ?? (path.includes("mobile-dashboard") ? 45000 : 25000),
    );
    try {
      const send = (token: string) =>
        fetcher(options.url + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            apikey: options.key,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(binary ? { Accept: "image/*" } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          redirect: binary ? "error" : "follow",
          signal: controller.signal,
        });
      let response = await send(session.access_token);
      if (response.status === 401) {
        const current = await options.getSession();
        if (current?.user.id !== initial.user.id) throw abortError();
        const next =
          current.access_token !== session.access_token
            ? current
            : await refresh();
        if (!next) {
          options.onInvalidSession();
          throw new ReadError("SESSION");
        }
        if (next.user.id !== initial.user.id) throw abortError();
        response = await send(next.access_token);
      }
      if (response.status === 401) throw new ReadError("SESSION", 401);
      if (response.status === 403) throw new ReadError("FORBIDDEN", 403);
      if (response.status === 404) throw new ReadError("NOT_FOUND", 404);
      if (response.status === 429) throw new ReadError("RATE_LIMIT", 429);
      if ([408, 425, 500, 502, 503, 504].includes(response.status))
        throw new ReadError("SOURCE_UNAVAILABLE", response.status);
      if (!response.ok) throw new ReadError("INVALID_REQUEST", response.status);
      let result: unknown;
      if (binary) {
        const type = response.headers.get("content-type") ?? "";
        if (!/^image\/(png|jpeg|webp|gif)$/.test(type))
          throw new ReadError("CONTRACT");
        if (Number(response.headers.get("Content-Length")) > 8 * 1024 * 1024)
          throw new ReadError("CONTRACT");
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 8 * 1024 * 1024) throw new ReadError("CONTRACT");
        result = { bytes, type };
      } else {
        try {
          result = await response.json();
        } catch {
          throw new ReadError("CONTRACT");
        }
      }
      if (signal.aborted) throw abortError();
      const current = await options.getSession();
      if (current?.user.id !== initial.user.id) throw abortError();
      return result as T;
    } catch (error) {
      if (signal.aborted) throw abortError();
      if (timedOut) throw new ReadError("TIMEOUT");
      if (
        error instanceof ReadError ||
        (error instanceof Error && error.name === "AbortError")
      )
        throw error;
      throw new ReadError("NETWORK");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    }
  }
  return {
    request: <T>(path: string, signal: AbortSignal, body?: unknown) =>
      /mobile-dashboard|get_project_sales_|get_event_dates_economic_sales|v_event_date_sales_/.test(
        path,
      )
        ? expensive.run(signal, () => read<T>(path, signal, body))
        : read<T>(path, signal, body),
    image: (path: string, signal: AbortSignal) =>
      read<{ bytes: ArrayBuffer; type: string }>(path, signal, undefined, true),
  };
}
