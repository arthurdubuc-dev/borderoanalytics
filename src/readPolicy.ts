export class ReadError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(code);
  }
}
export function isTransient(error: unknown): boolean {
  return error instanceof ReadError
    ? ["NETWORK", "TIMEOUT", "SOURCE_UNAVAILABLE", "RATE_LIMIT"].includes(
        error.code,
      )
    : error instanceof TypeError;
}
export function abortError(): Error {
  const error = new Error("Lecture annulée");
  error.name = "AbortError";
  return error;
}
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
export async function retryRead<T>(
  load: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  waits: readonly number[] = [450, 1200],
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) throw abortError();
    try {
      return await load(signal);
    } catch (error) {
      if (signal.aborted) throw abortError();
      if (!isTransient(error) || attempt >= waits.length) throw error;
      await pause(waits[attempt]!, signal);
    }
  }
}
interface Entry {
  value?: unknown;
  hasValue: boolean;
  updatedAt: number;
  pending?: Promise<unknown>;
  controller?: AbortController;
  readers: number;
}
/** Per-mounted-session/workspace memory only. Never persisted to disk. */
export class ReadCache {
  private entries = new Map<string, Entry>();
  constructor(
    private ttl = 60000,
    private now: () => number = Date.now,
  ) {}
  /** Read an already-authorized fresh value without starting work or extending its age. */
  peek<T>(key: string): { value: T; updatedAt: number } | undefined {
    const entry = this.entries.get(key);
    if (!entry?.hasValue || this.now() - entry.updatedAt > this.ttl)
      return undefined;
    return { value: entry.value as T, updatedAt: entry.updatedAt };
  }
  acquire<T>(
    key: string,
    loader: (signal: AbortSignal) => Promise<T>,
    force = false,
  ) {
    let entry = this.entries.get(key);
    if (
      !entry ||
      (!entry.pending &&
        (force || !entry.hasValue || this.now() - entry.updatedAt > this.ttl))
    ) {
      const controller = new AbortController();
      entry = { hasValue: false, updatedAt: 0, controller, readers: 0 };
      const current = entry;
      current.pending = retryRead(loader, controller.signal).then(
        (value) => {
          if (controller.signal.aborted) throw abortError();
          current.value = value;
          current.hasValue = true;
          current.updatedAt = this.now();
          current.pending = undefined;
          this.trim();
          return value;
        },
        (error) => {
          if (this.entries.get(key) === current) this.entries.delete(key);
          throw error;
        },
      );
      this.entries.set(key, current);
      // Only old settled entries are evicted; active reads keep their cancellation owner.
      if (this.entries.size > 80)
        for (const [id, item] of this.entries) {
          if (!item.pending && !item.readers && id !== key)
            this.entries.delete(id);
          if (this.entries.size <= 64) break;
        }
    }
    const current = entry;
    current.readers++;
    let released = false;
    return {
      get updatedAt() {
        return current.updatedAt;
      },
      promise: (current.pending ??
        Promise.resolve(current.value)) as Promise<T>,
      release: () => {
        if (released) return;
        released = true;
        current.readers--;
        if (!current.readers && current.pending) {
          current.controller?.abort();
          if (this.entries.get(key) === current) this.entries.delete(key);
        }
        this.trim();
      },
    };
  }
  private trim() {
    let weight = [...this.entries.values()].reduce(
      (n, e) => n + (typeof e.value === "string" ? e.value.length : 0),
      0,
    );
    for (const [key, entry] of this.entries) {
      if (weight <= 16000000) break;
      if (!entry.pending && !entry.readers) {
        weight -= typeof entry.value === "string" ? entry.value.length : 0;
        this.entries.delete(key);
      }
    }
  }
  /** Discard only matching reads; late pre-mutation responses cannot refill them. */
  invalidate(matches: (key: string) => boolean) {
    for (const [key, entry] of this.entries) {
      if (!matches(key)) continue;
      entry.controller?.abort();
      this.entries.delete(key);
    }
  }
  clear() {
    for (const entry of this.entries.values()) entry.controller?.abort();
    this.entries.clear();
  }
}
