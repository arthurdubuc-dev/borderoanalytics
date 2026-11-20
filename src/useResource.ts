import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ReadCache, retryRead, isTransient } from "./readPolicy";
export const ReadContext = createContext<{
  cache: ReadCache;
  revision: number;
} | null>(null);
export function useResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
) {
  const context = useContext(ReadContext);
  const fn = useRef(fetcher);
  fn.current = fetcher;
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{
    key: string | null;
    data?: T;
    error?: unknown;
    loading: boolean;
    updatedAt?: number;
  }>({ key: null, loading: false });
  useEffect(() => {
    if (key === null) {
      setState({ key: null, loading: false });
      return;
    }
    let active = true;
    const controller = new AbortController();
    const cached =
      nonce === 0
        ? context?.cache.peek<T>(`${context.revision}:${key}`)
        : undefined;
    setState((previous) =>
      cached
        ? {
            key,
            data: cached.value,
            updatedAt: cached.updatedAt,
            loading: false,
          }
        : previous.key === key
          ? { ...previous, error: undefined, loading: true }
          : { key, loading: true },
    );
    const lease = context?.cache.acquire(
      `${context.revision}:${key}`,
      (signal) => fn.current(signal),
      nonce > 0,
    );
    const pending =
      lease?.promise ??
      retryRead((signal) => fn.current(signal), controller.signal);
    pending.then(
      (data) => {
        if (active)
          setState({
            key,
            data,
            loading: false,
            updatedAt: lease?.updatedAt ?? Date.now(),
          });
      },
      (error) => {
        if (active)
          setState((previous) => ({
            ...previous,
            key,
            data: isTransient(error) ? previous.data : undefined,
            error,
            loading: false,
          }));
      },
    );
    return () => {
      active = false;
      controller.abort();
      lease?.release();
    };
  }, [key, nonce, context?.cache, context?.revision]);
  const cached =
    key !== null && nonce === 0
      ? context?.cache.peek<T>(`${context.revision}:${key}`)
      : undefined;
  return {
    ...(state.key === key
      ? state
      : cached
        ? {
            key,
            data: cached.value,
            updatedAt: cached.updatedAt,
            loading: false,
          }
        : { key, loading: key !== null }),
    retry: useCallback(() => setNonce((n) => n + 1), []),
  };
}
