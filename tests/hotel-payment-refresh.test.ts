import React from "react";
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestInstance,
} from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReadCache, ReadError } from "../src/readPolicy";
import { ReadContext } from "../src/useResource";
import { exact, parisDay } from "../src/domain";
import { projectHotelInvoice } from "../src/hotelInvoice";
import type { HotelStay, HotelPayment } from "../src/hotels";
import type { HotelFinanceSnapshot } from "../src/hotelApi";
const api = vi.hoisted(() => ({
  stays: vi.fn(),
  finance: vi.fn(),
  batch: vi.fn(),
  rooming: vi.fn(),
  access: vi.fn(),
  ledger: vi.fn(),
  pending: vi.fn(),
  submit: vi.fn(),
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  Modal: "Modal",
  ScrollView: "ScrollView",
  AppState: { addEventListener: () => ({ remove() {} }) },
  Linking: {},
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
}));
vi.mock("../src/ui", () =>
  Object.fromEntries([
    ...[
      "Txt",
      "Card",
      "Heading",
      "Button",
      "Field",
      "Notice",
      "Loading",
      "Empty",
      "ErrorState",
      "Icon",
      "UpdatedNote",
    ].map((name) => [name, name]),
    [
      "useTheme",
      () => ({
        bg: "#F6F7F8",
        text: "#111",
        muted: "#666",
        line: "#ddd",
        surface: "#fff",
        secondary: "#eee",
        danger: "#c00",
      }),
    ],
  ]),
);
vi.mock("../src/PaymentDateField", () => ({
  PaymentDateField: "PaymentDateField",
}));
vi.mock("../src/hotelApi", () => ({
  loadHotelStays: api.stays,
  loadHotelFinance: api.finance,
  loadHotelFinanceBatch: api.batch,
  loadHotelRooming: api.rooming,
  HOTEL_FINANCE_BATCH_SIZE: 20,
}));
vi.mock("../src/hotelPaymentApi", () => ({
  loadHotelPaymentAccess: api.access,
  loadHotelSettlements: api.ledger,
  pendingHotelPayments: { read: api.pending },
  hotelPaymentWriter: () => ({ submit: api.submit }),
}));
import { HotelsScreen } from "../src/HotelsScreen";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let tree: ReactTestRenderer | undefined;
let paid: number;
let cache: ReadCache;
const stay: HotelStay = {
  id: "stay",
  workspace_id: "w",
  project_id: "p",
  tour_id: null,
  hotel_id: null,
  check_in_date: parisDay(),
  check_out_date: "2027-01-01",
  pax_count: 1,
  status: "confirmed",
  roadbook_entry_id: null,
  hotel: {
    name: "Hôtel test",
    city: "Paris",
    address: null,
    contact_phone: null,
    phone: null,
  },
};
function snapshot(): HotelFinanceSnapshot {
  const line: HotelPayment = {
    id: "balance",
    hotel_stay_id: stay.id,
    payment_type: "balance",
    label: "Solde",
    amount: 500,
    paid_amount: paid,
    status: paid === 500 ? "paid" : "pending",
    due_date: parisDay(),
    paid_on: parisDay(),
    settlement_id: "settlement",
    payment_method: "Carte",
  };
  return {
    payments: [line],
    commitment: {
      id: "parent",
      source_id: stay.id,
      expected_amount: 500,
      received_amount: paid,
      due_date: null,
      received_date: null,
    },
    invoice: { ...projectHotelInvoice(null), total: 500 },
  };
}
function nodes(type: string) {
  return tree!.root.findAll((node) => node.type === type);
}
function card() {
  return nodes("Pressable").find((node) =>
    String(node.props.accessibilityLabel).includes("ouvrir la fiche réception"),
  )!;
}
function button(prefix: string) {
  return nodes("Button").find((node) =>
    String(node.props.title).startsWith(prefix),
  )!;
}
function text(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === "string" ? child : text(child)))
    .join("");
}
async function flush() {
  await act(async () => {
    for (let i = 0; i < 15; i++) await Promise.resolve();
  });
}
async function press(node: ReactTestInstance) {
  expect(node).toBeDefined();
  expect(node.props.disabled).not.toBe(true);
  await act(async () => {
    await node.props.onPress();
  });
  await flush();
}
async function mount() {
  await act(async () => {
    tree = create(
      React.createElement(
        ReadContext.Provider,
        { value: { cache, revision: 0 } },
        React.createElement(HotelsScreen, {
          workspaceId: "w",
          projects: [
            { id: "p", workspace_id: "w", name: "Projet", season: null },
          ],
        }),
      ),
    );
  });
  await flush();
}
async function openEditor(kind: "record" | "correct") {
  await press(card());
  await press(button("Enregistrer ou corriger"));
  await press(
    button(
      kind === "record" ? "Enregistrer un règlement" : "Corriger ce règlement",
    ),
  );
  if (kind === "record")
    await act(async () => {
      nodes("Field")
        .find((node) => node.props.label === "Moyen de paiement")!
        .props.onChangeText("Carte");
    });
  else
    await act(async () => {
      nodes("Field")
        .find((node) => node.props.label === "Motif de la correction")!
        .props.onChangeText("Correction de montant");
    });
}
function assertAmounts(expectedPaid: number) {
  const modal = nodes("Modal")[0]!;
  const paidLabel = modal.findAll(
    (node) => String(node.type) === "Txt" && text(node) === "Déjà réglé",
  )[0]!;
  expect(text(paidLabel.parent!)).toContain(exact(expectedPaid, true));
  const remainder = modal.findAll(
    (node) => String(node.type) === "Txt" && node.props.style?.fontSize === 38,
  )[0]!;
  expect(text(remainder)).toBe(exact(500 - expectedPaid, true));
  expect(card().props.accessibilityLabel).toContain(
    "reste à régler " + exact(500 - expectedPaid, true),
  );
  expect(card().props.accessibilityLabel).toContain(
    expectedPaid === 500 ? "Réglé" : "À régler",
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (!String(message).includes("react-test-renderer is deprecated"))
      throw new Error(String(message) + args.join(" "));
  });
  paid = 200;
  cache = new ReadCache();
  api.stays.mockResolvedValue([stay]);
  api.finance.mockImplementation(async () => snapshot());
  api.batch.mockImplementation(async () => [
    { stayId: stay.id, finance: snapshot() },
  ]);
  api.access.mockResolvedValue({ userId: "user", canWrite: true });
  api.pending.mockResolvedValue(null);
  api.ledger.mockImplementation(async () => [
    {
      id: "settlement",
      source_id: "balance",
      amount: paid,
      paid_at: parisDay(),
      payment_method: "Carte",
      status: "posted",
    },
  ]);
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  cache.clear();
  vi.restoreAllMocks();
});
it.each([
  ["record", 500],
  ["correct", 100],
  ["correct", 300],
  ["correct", 200],
] as const)(
  "%s refreshes paid/remainder and list status before closing the sheet (%s paid), then survives close/reopen and tab remount",
  async (kind, nextPaid) => {
    await mount();
    await openEditor(kind);
    const reads = api.batch.mock.calls.length;
    const ledgerReads = api.ledger.mock.calls.length;
    if (kind === "correct")
      await act(async () => {
        nodes("Field")
          .find((node) => node.props.label === "Montant réglé (€)")!
          .props.onChangeText(String(nextPaid));
      });
    api.submit.mockImplementation(async () => {
      paid = nextPaid;
      return { replayed: false };
    });
    await press(
      button(kind === "record" ? "Enregistrer ·" : "Confirmer la correction"),
    );
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.batch.mock.calls.length).toBeGreaterThan(reads);
    assertAmounts(nextPaid);
    expect(api.ledger.mock.calls.length).toBeGreaterThan(ledgerReads);
    expect(
      button(
        nextPaid === 500 ? "Corriger ce règlement" : "Enregistrer un règlement",
      ).props.disabled,
    ).toBe(false);
    await press(button("Fermer"));
    await press(card());
    assertAmounts(nextPaid);
    await act(async () => tree!.unmount());
    tree = undefined;
    await mount();
    await press(card());
    assertAmounts(nextPaid);
  },
);
it("rejects a late pre-payment list response while displaying the new authoritative totals", async () => {
  let finishOld!: (value: unknown) => void;
  const old = [{ stayId: stay.id, finance: snapshot() }];
  api.batch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  await mount();
  await openEditor("record");
  api.submit.mockImplementation(async () => {
    paid = 500;
    return { replayed: false };
  });
  await press(button("Enregistrer ·"));
  assertAmounts(500);
  await act(async () => finishOld(old));
  await flush();
  assertAmounts(500);
});
it("never shows stale financial totals as current when the post-payment reads fail", async () => {
  await mount();
  await openEditor("record");
  api.submit.mockImplementation(async () => {
    paid = 500;
    api.finance.mockRejectedValue(new ReadError("FORBIDDEN"));
    api.batch.mockRejectedValue(new ReadError("FORBIDDEN"));
    return { replayed: false };
  });
  await press(button("Enregistrer ·"));
  expect(card().props.accessibilityLabel).toContain("À confirmer");
  expect(nodes("ErrorState").length).toBeGreaterThan(0);
  expect(
    nodes("Modal")[0]!.findAll(
      (node) => String(node.type) === "Txt" && text(node) === "Déjà réglé",
    ),
  ).toHaveLength(0);
});
it("does not assume a payment succeeded when its response is uncertain", async () => {
  await mount();
  await openEditor("record");
  const before = api.batch.mock.calls.length;
  api.submit.mockRejectedValue(new Error("Réponse incertaine"));
  await press(button("Enregistrer ·"));
  assertAmounts(200);
  expect(api.batch).toHaveBeenCalledTimes(before);
});

it("waits for authoritative post-payment reads, then updates both views without another tap", async () => {
  await mount();
  await openEditor("record");
  let finishSheet!: (value: HotelFinanceSnapshot) => void;
  let finishList!: (
    value: Array<{ stayId: string; finance: HotelFinanceSnapshot }>,
  ) => void;
  api.submit.mockImplementation(async () => {
    paid = 500;
    api.finance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSheet = resolve;
        }),
    );
    api.batch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishList = resolve;
        }),
    );
    return { replayed: false };
  });
  await press(button("Enregistrer ·"));
  expect(card().props.accessibilityLabel).toContain("Vérification du solde");
  expect(
    nodes("Modal")[0]!.findAll(
      (node) => String(node.type) === "Txt" && text(node) === "Déjà réglé",
    ),
  ).toHaveLength(0);
  await act(async () => {
    finishSheet(snapshot());
    finishList([{ stayId: stay.id, finance: snapshot() }]);
  });
  await flush();
  assertAmounts(500);
  expect(button("Corriger ce règlement").props.disabled).toBe(false);
});
it("invalidates only matching workspace reads, preserving unrelated financial and sales caches", async () => {
  for (const key of [
    "0:hotel-finance:w:p:stay:0",
    "0:hotel-list-finance:w:stay:0",
    "0:hotel-settlements:w:stay:0",
    "0:hotel-finance:other:p:stay:0",
    "0:sales:w",
  ]) {
    const lease = cache.acquire(key, async () => 42);
    await lease.promise;
    lease.release();
  }
  await mount();
  await openEditor("record");
  api.submit.mockImplementation(async () => {
    paid = 500;
    return { replayed: false };
  });
  await press(button("Enregistrer ·"));
  for (const key of [
    "0:hotel-finance:w:p:stay:0",
    "0:hotel-list-finance:w:stay:0",
    "0:hotel-settlements:w:stay:0",
  ])
    expect(cache.peek(key)).toBeUndefined();
  expect(cache.peek("0:hotel-finance:other:p:stay:0")?.value).toBe(42);
  expect(cache.peek("0:sales:w")?.value).toBe(42);
});
