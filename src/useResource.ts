import { useCallback, useEffect, useRef, useState } from "react";
export function useResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
) {
  const fn = useRef(fetcher);
  fn.current = fetcher;
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{
    key: string | null;
    data?: T;
    error?: unknown;
    loading: boolean;
  }>({ key: null, loading: false });
  useEffect(() => {
    if (key === null) {
      setState({ key: null, loading: false });
      return;
    }
    const c = new AbortController();
    setState((previous) =>
      previous.key === key
        ? { ...previous, error: undefined, loading: true }
        : { key, loading: true },
    );
    fn.current(c.signal).then(
      (data) => {
        if (!c.signal.aborted) setState({ key, data, loading: false });
      },
      (error) => {
        if (!c.signal.aborted) setState({ key, error, loading: false });
      },
    );
    return () => c.abort();
  }, [key, nonce]);
  return {
    ...(state.key === key ? state : { key, loading: key !== null }),
    retry: useCallback(() => setNonce((n) => n + 1), []),
  };
}
