import { describe, it, expect, vi } from "vitest";
import { ReadCache, ReadError, retryRead, pause } from "../src/readPolicy";
import { createReadTransport } from "../src/transport";
import { kpiColumns, sectionPalette } from "../src/layout";
import { averagePublicPrice, type DateSummary } from "../src/domain";
import { resolveArtworkSource, imageDataUri } from "../src/artwork";
import { release } from "../src/release";
import config from "../app.config";
import pkg from "../package.json";
describe("grilles portrait, paysage et accessibilité", () => {
  it("dispose les carrés sur deux colonnes en portrait et quatre en paysage/tablette", () => {
    expect(kpiColumns(353, 1, 4)).toBe(2);
    expect(kpiColumns(720, 1, 4)).toBe(4);
    expect(kpiColumns(1080, 1, 8)).toBe(4);
  });
  it("préserve la lecture avec une grande police et un écran étroit", () => {
    expect(kpiColumns(353, 1.6, 4)).toBe(1);
    expect(kpiColumns(270, 1, 4)).toBe(1);
    expect(kpiColumns(1080, 1, 1)).toBe(1);
  });
  it("reprend les couleurs sémantiques du bordereau Web", () => {
    expect(sectionPalette("A").text).toBe("#1D4ED8");
    expect(sectionPalette("B").text).toBe("#0F766E");
    expect(sectionPalette("P").text).toBe("#BE185D");
    expect(sectionPalette("taxes")).toEqual(sectionPalette("vat"));
    expect(sectionPalette("E", true).background).toBe("#222832");
  });
  it("harmonise la version technique 1.0.0 et le numéro de build 1", () => {
    expect(pkg.version).toBe("1.0.0");
    expect(config.version).toBe(pkg.version);
    expect(config.ios?.buildNumber).toBe("1");
    expect(config.android?.versionCode).toBe(1);
    expect(release.displayVersion).toBe("1.0");
  });
});
describe("reprise des lectures sans élargir les droits", () => {
  it("réessaie une source temporairement indisponible et finit au premier succès", async () => {
    let calls = 0;
    const value = await retryRead(
      async () => {
        if (++calls < 3) throw new ReadError("SOURCE_UNAVAILABLE", 503);
        return 42;
      },
      new AbortController().signal,
      [0, 0],
    );
    expect(value).toBe(42);
    expect(calls).toBe(3);
  });
  it("ne répète pas un refus de droits ou une erreur de contrat", async () => {
    for (const code of ["FORBIDDEN", "SESSION", "CONTRACT"]) {
      const fn = vi.fn(async () => {
        throw new ReadError(code);
      });
      await expect(
        retryRead(fn, new AbortController().signal, [0, 0]),
      ).rejects.toThrow(code);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });
  it("annule immédiatement une attente de reprise", async () => {
    const controller = new AbortController();
    const promise = pause(30000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
  it("partage une lecture simultanée mais ne l’annule pas tant qu’un écran la consulte", async () => {
    const cache = new ReadCache();
    let resolve!: (v: number) => void;
    let aborted = false;
    const load = vi.fn((signal: AbortSignal) => {
      signal.addEventListener("abort", () => (aborted = true));
      return new Promise<number>((r) => (resolve = r));
    });
    const a = cache.acquire("same", load),
      b = cache.acquire("same", load);
    a.release();
    expect(aborted).toBe(false);
    resolve(12);
    expect(await b.promise).toBe(12);
    expect(load).toHaveBeenCalledTimes(1);
    b.release();
    cache.clear();
  });
  it("annule une lecture devenue inutile et ne garde pas ses résultats", async () => {
    const cache = new ReadCache();
    const lease = cache.acquire(
      "slow",
      (signal) =>
        new Promise<number>((_, reject) =>
          signal.addEventListener("abort", () =>
            reject(new ReadError("NETWORK")),
          ),
        ),
    );
    const failed = expect(lease.promise).rejects.toMatchObject({
      name: "AbortError",
    });
    lease.release();
    await failed;
    const next = cache.acquire("slow", async () => 9);
    expect(await next.promise).toBe(9);
    next.release();
  });
  it("réutilise le cache récent, invalide à l’expiration et isole deux espaces de travail", async () => {
    let now = 0;
    const cache = new ReadCache(10, () => now);
    let call = 0;
    const load = async () => ++call;
    let a = cache.acquire("same", load);
    expect(await a.promise).toBe(1);
    a.release();
    now = 5;
    a = cache.acquire("same", load);
    expect(await a.promise).toBe(1);
    a.release();
    now = 20;
    a = cache.acquire("same", load);
    expect(await a.promise).toBe(2);
    a.release();
    const other = new ReadCache();
    a = other.acquire("same", load);
    expect(await a.promise).toBe(3);
    a.release();
    cache.clear();
    other.clear();
  });
});
describe("session et transport authentifié", () => {
  function setup(fetcher: typeof fetch) {
    let current = { access_token: "old", user: { id: "user-a" } };
    const refresh = vi.fn(async () => {
      current = { ...current, access_token: "new" };
      return current;
    });
    const invalid = vi.fn();
    return {
      refresh,
      invalid,
      setUser: (id: string) => {
        current = { ...current, user: { id } };
      },
      transport: createReadTransport({
        url: "https://example.supabase.co",
        key: "public-key",
        getSession: async () => current,
        refreshSession: refresh,
        onInvalidSession: invalid,
        fetcher,
      }),
    };
  }
  it("renouvelle une seule fois une session expirée sans déconnecter le compte", async () => {
    const fetcher = vi.fn(
      async (_url, init) =>
        new Response(JSON.stringify({ ok: true }), {
          status:
            new Headers(init?.headers).get("Authorization") === "Bearer old"
              ? 401
              : 200,
        }),
    );
    const s = setup(fetcher);
    expect(
      await s.transport.request(
        "/rest/v1/example",
        new AbortController().signal,
      ),
    ).toEqual({ ok: true });
    expect(s.refresh).toHaveBeenCalledTimes(1);
    expect(s.invalid).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("ne renouvelle pas une session pour contourner un refus 403", async () => {
    const s = setup(async () => new Response("{}", { status: 403 }));
    await expect(
      s.transport.request("/rest/v1/example", new AbortController().signal),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(s.refresh).not.toHaveBeenCalled();
  });
  it("rejette une réponse appartenant à un compte qui vient de changer", async () => {
    let s: ReturnType<typeof setup>;
    s = setup(async () => {
      s.setUser("user-b");
      return new Response("{}", { status: 200 });
    });
    await expect(
      s.transport.request("/rest/v1/example", new AbortController().signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("refuse d’envoyer le token vers un autre domaine ou une redirection d’affiche privée", async () => {
    const fn = vi.fn(
      async (..._args: Parameters<typeof fetch>) => new Response("{}"),
    );
    const s = setup(fn);
    await expect(
      s.transport.request("//external.test", new AbortController().signal),
    ).rejects.toMatchObject({ code: "CONTRACT" });
    expect(fn).not.toHaveBeenCalled();
    await s.transport
      .image(
        "/functions/v1/files-download?fileId=abc",
        new AbortController().signal,
      )
      .catch(() => {});
    expect(fn.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });
});
describe("affiches et indicateurs complémentaires", () => {
  it("préfère le fichier autorisé et refuse les URL publiques non sûres", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(resolveArtworkSource(id, "https://example.test/image.png")).toBe(
      "file:" + id,
    );
    expect(resolveArtworkSource(null, "http://example.test/image")).toBeNull();
    expect(
      resolveArtworkSource(null, "https://name:secret@example.test/image"),
    ).toBeNull();
    expect(
      imageDataUri(new Uint8Array([116, 101, 115, 116]).buffer, "image/png"),
    ).toBe("data:image/png;base64,dGVzdA==");
  });
  it("calcule un prix moyen pondéré uniquement sur des dates comparables", () => {
    const dates = [
      { gross: 100, tickets: 10 },
      { gross: 600, tickets: 20 },
      { gross: null, tickets: 10 },
    ] as DateSummary[];
    expect(averagePublicPrice(dates)).toEqual({ value: 700 / 30, covered: 2 });
    expect(
      averagePublicPrice([{ gross: 0, tickets: 0 }] as DateSummary[]).value,
    ).toBeNull();
  });
});
