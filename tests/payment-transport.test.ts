import { expect, it, vi } from "vitest";
import { createReadTransport } from "../src/transport";
import { PaymentRejected } from "../src/paymentErrors";
const session = { access_token: "synthetic", user: { id: "own-account" } };
const args = { p_request_key: "immutable-key", p_amount: 100 };
const signal = new AbortController().signal;
function make(fetcher: typeof fetch, getSession = async () => session) {
  return createReadTransport({
    url: "https://example.supabase.co",
    key: "public",
    getSession,
    refreshSession: async () => ({ ...session, access_token: "refreshed" }),
    onInvalidSession: () => {},
    fetcher,
  });
}
it("never sends a mutation under another account and refuses other RPC names", async () => {
  const fetcher = vi.fn<typeof fetch>();
  const transport = make(fetcher);
  await expect(
    transport.mutate("mark_hotel_payment_paid", signal, args, "other-account"),
  ).rejects.toBeInstanceOf(PaymentRejected);
  await expect(
    transport.mutate("delete_all" as never, signal, args, "own-account"),
  ).rejects.toBeInstanceOf(PaymentRejected);
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not automatically retry a failed write, and preserves exact payload on an auth-only refresh", async () => {
  const failure = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("{}", { status: 503 }));
  await expect(
    make(failure).mutate(
      "mark_hotel_payment_paid",
      signal,
      args,
      "own-account",
    ),
  ).rejects.toMatchObject({ code: "SOURCE_UNAVAILABLE" });
  expect(failure).toHaveBeenCalledTimes(1);
  const refresh = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response("{}", { status: 200 }));
  await make(refresh).mutate(
    "mark_hotel_payment_paid",
    signal,
    args,
    "own-account",
  );
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(refresh.mock.calls[0]?.[1]?.body).toBe(
    refresh.mock.calls[1]?.[1]?.body,
  );
});
it("translates a finance refusal without echoing raw SQL or account identifiers", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Finance write denied", code: "P0001" }),
        { status: 400 },
      ),
    );
  await expect(
    make(fetcher).mutate(
      "correct_hotel_payment_paid",
      signal,
      args,
      "own-account",
    ),
  ).rejects.toThrow("droits financiers");
});
