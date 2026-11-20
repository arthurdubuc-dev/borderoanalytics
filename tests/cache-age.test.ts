import { expect, it, vi } from "vitest";
import { ReadCache } from "../src/readPolicy";
it("shows a warm result immediately without extending its freshness or refetching, and expires it", async () => {
  let now = 1000;
  const cache = new ReadCache(60, () => now),
    load = vi.fn(async () => ({ value: 42 }));
  const first = cache.acquire("workspace:a", load);
  await first.promise;
  first.release();
  now = 1020;
  expect(cache.peek("workspace:a")).toEqual({
    value: { value: 42 },
    updatedAt: 1000,
  });
  const second = cache.acquire("workspace:a", load);
  await second.promise;
  expect(second.updatedAt).toBe(1000);
  expect(load).toHaveBeenCalledTimes(1);
  second.release();
  expect(cache.peek("workspace:b")).toBeUndefined();
  now = 1061;
  expect(cache.peek("workspace:a")).toBeUndefined();
  cache.clear();
  expect(cache.peek("workspace:a")).toBeUndefined();
});
