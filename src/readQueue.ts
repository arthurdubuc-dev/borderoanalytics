import { abortError } from "./readPolicy";
/** Limit expensive reads without letting cancelled navigation keep work queued. */
export class ReadQueue {
  private active = 0;
  private pending: Array<() => void> = [];
  constructor(private limit = 2) {}
  async run<T>(signal: AbortSignal, load: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve, reject) => {
      const cancel = () => {
        const i = this.pending.indexOf(start);
        if (i >= 0) this.pending.splice(i, 1);
        signal.removeEventListener("abort", cancel);
        reject(abortError());
      };
      const start = () => {
        signal.removeEventListener("abort", cancel);
        if (signal.aborted) {
          reject(abortError());
          return;
        }
        this.active++;
        resolve();
      };
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      if (this.active < this.limit) start();
      else {
        this.pending.push(start);
        signal.addEventListener("abort", cancel, { once: true });
      }
    });
    try {
      if (signal.aborted) throw abortError();
      return await load();
    } finally {
      this.active--;
      this.pending.shift()?.();
    }
  }
}
