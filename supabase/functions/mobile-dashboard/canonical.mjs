// Generated from Bordero Web. Do not edit formulas here. See scripts/bundle-canonical.mjs.
// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/ticketing/canonical/types.ts
var TicketingEngineInputError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "TicketingEngineInputError";
    this.code = code;
  }
};

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/ticketing/canonical/money.ts
var MAX_ABS_CENTS = 1e13;
function assertFiniteInteger(value, ctx) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TicketingEngineInputError("MONEY_NOT_FINITE", `[${ctx}] valeur non finie: ${String(value)}`);
  }
  if (!Number.isInteger(value)) {
    throw new TicketingEngineInputError("MONEY_NOT_INTEGER", `[${ctx}] centimes non entiers: ${value}`);
  }
  if (Math.abs(value) > MAX_ABS_CENTS) {
    throw new TicketingEngineInputError("MONEY_OUT_OF_RANGE", `[${ctx}] hors plage: ${value}`);
  }
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/ticketing/canonical/ticketingEngine.ts
var VERSION = "1.0.0";
function validateCategory(cat, warnings) {
  assertFiniteInteger(cat.ticketPriceTtcCents, `category[${cat.id}].ticketPriceTtcCents`);
  assertFiniteInteger(cat.dlProducerTtcCents, `category[${cat.id}].dlProducerTtcCents`);
  assertFiniteInteger(cat.dlVenueTtcCents, `category[${cat.id}].dlVenueTtcCents`);
  assertFiniteInteger(cat.dlDistributorTtcCents, `category[${cat.id}].dlDistributorTtcCents`);
  if (cat.ticketPriceTtcCents < 0 || cat.dlProducerTtcCents < 0 || cat.dlVenueTtcCents < 0 || cat.dlDistributorTtcCents < 0) {
    warnings.push({ code: "NEGATIVE_PRICE", categoryId: cat.id });
  }
  const dlTotal = cat.dlProducerTtcCents + cat.dlVenueTtcCents + cat.dlDistributorTtcCents;
  if (dlTotal > cat.ticketPriceTtcCents) {
    warnings.push({
      code: "TP_BELOW_DL",
      categoryId: cat.id,
      tpCents: cat.ticketPriceTtcCents,
      dlTotalCents: dlTotal
    });
  }
}
function runTicketingEngineV1(input) {
  if (!input || typeof input !== "object") {
    throw new TicketingEngineInputError("INVALID_INPUT", "input requis");
  }
  const warnings = [];
  const catalog = /* @__PURE__ */ new Map();
  for (const cat of input.priceCatalog) {
    if (!cat || typeof cat.id !== "string" || cat.id.length === 0) {
      throw new TicketingEngineInputError("INVALID_CATEGORY", "category.id manquant");
    }
    if (catalog.has(cat.id)) {
      warnings.push({ code: "DUPLICATE_CATEGORY_ID", categoryId: cat.id });
      continue;
    }
    validateCategory(cat, warnings);
    catalog.set(cat.id, cat);
  }
  let paidTicketsSold = 0;
  let grossTtc = 0;
  let dlProd = 0;
  let dlVenue = 0;
  let dlDistrib = 0;
  const byCatAcc = /* @__PURE__ */ new Map();
  const byPlatAcc = /* @__PURE__ */ new Map();
  for (const line of input.sales) {
    if (!line || typeof line.categoryId !== "string") {
      throw new TicketingEngineInputError("INVALID_SALE_LINE", "sale.categoryId manquant");
    }
    const qty = line.quantity;
    if (typeof qty !== "number" || !Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
      warnings.push({
        code: "NON_POSITIVE_QUANTITY",
        quantity: qty,
        sourceRef: line.sourceRef ?? void 0,
        lineId: line.id
      });
      continue;
    }
    const cat = catalog.get(line.categoryId);
    if (!cat) {
      warnings.push({
        code: "MISSING_PRICE_CATEGORY",
        categoryId: line.categoryId,
        sourceRef: line.sourceRef ?? void 0,
        lineId: line.id
      });
      continue;
    }
    const lineGross = cat.ticketPriceTtcCents * qty;
    const lineDlProd = cat.dlProducerTtcCents * qty;
    const lineDlVenue = cat.dlVenueTtcCents * qty;
    const lineDlDistrib = cat.dlDistributorTtcCents * qty;
    const lineDlTotal = lineDlProd + lineDlVenue + lineDlDistrib;
    const lineHorsDl = lineGross - lineDlTotal;
    paidTicketsSold += qty;
    grossTtc += lineGross;
    dlProd += lineDlProd;
    dlVenue += lineDlVenue;
    dlDistrib += lineDlDistrib;
    const catAcc = byCatAcc.get(cat.id);
    if (catAcc) {
      catAcc.ticketsSold += qty;
      catAcc.ticketingGrossRevenueTtcCents += lineGross;
      catAcc.ticketingHorsDlTtcCents += lineHorsDl;
      catAcc.dlTotalTtcCents += lineDlTotal;
    } else {
      byCatAcc.set(cat.id, {
        categoryId: cat.id,
        label: cat.label,
        ticketsSold: qty,
        ticketingGrossRevenueTtcCents: lineGross,
        ticketingHorsDlTtcCents: lineHorsDl,
        dlTotalTtcCents: lineDlTotal
      });
    }
    const platformKey = typeof line.platformId === "string" && line.platformId.length > 0 ? line.platformId : null;
    if (platformKey === null) {
      warnings.push({
        code: "UNKNOWN_PLATFORM",
        sourceRef: line.sourceRef ?? void 0,
        lineId: line.id
      });
    }
    const platAcc = byPlatAcc.get(platformKey);
    if (platAcc) {
      platAcc.ticketsSold += qty;
      platAcc.ticketingGrossRevenueTtcCents += lineGross;
      platAcc.ticketingHorsDlTtcCents += lineHorsDl;
      platAcc.dlTotalTtcCents += lineDlTotal;
    } else {
      byPlatAcc.set(platformKey, {
        platformId: platformKey,
        ticketsSold: qty,
        ticketingGrossRevenueTtcCents: lineGross,
        ticketingHorsDlTtcCents: lineHorsDl,
        dlTotalTtcCents: lineDlTotal
      });
    }
  }
  const dlTotal = dlProd + dlVenue + dlDistrib;
  const horsDl = grossTtc - dlTotal;
  assertFiniteInteger(grossTtc, "grossTtc");
  assertFiniteInteger(dlTotal, "dlTotal");
  assertFiniteInteger(horsDl, "horsDl");
  const complimentary = typeof input.complimentaryQuantity === "number" && Number.isFinite(input.complimentaryQuantity) && input.complimentaryQuantity > 0 ? Math.floor(input.complimentaryQuantity) : 0;
  const occupied = paidTicketsSold + complimentary;
  let fillRate = null;
  const cap = input.capacity;
  if (cap != null) {
    if (!Number.isFinite(cap) || cap < 0) {
      warnings.push({ code: "INVALID_CAPACITY", capacity: Number(cap) });
    } else if (cap > 0) {
      const policy = input.fillRatePolicy ?? "sold_over_capacity";
      const numer = policy === "occupied_over_capacity" ? occupied : paidTicketsSold;
      fillRate = numer / cap;
      if (paidTicketsSold > cap) {
        warnings.push({ code: "SALES_EXCEED_CAPACITY", sold: paidTicketsSold, capacity: cap });
      }
    }
  }
  const avgPaid = paidTicketsSold > 0 ? Math.round(grossTtc / paidTicketsSold) : null;
  const byCategory = Array.from(byCatAcc.values()).sort(
    (a, b) => a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0
  );
  const byPlatform = Array.from(byPlatAcc.values()).sort((a, b) => {
    const ai = a.platformId ?? "";
    const bi = b.platformId ?? "";
    if (a.platformId === null && b.platformId !== null) return 1;
    if (b.platformId === null && a.platformId !== null) return -1;
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });
  const output = {
    version: VERSION,
    paidTicketsSold,
    complimentaryTickets: complimentary,
    occupiedSeats: occupied,
    ticketingGrossRevenueTtcCents: grossTtc,
    ticketingHorsDlTtcCents: horsDl,
    dlTtcCents: {
      producer: dlProd,
      venue: dlVenue,
      distributor: dlDistrib,
      total: dlTotal
    },
    averagePaidTicketPriceTtcCents: avgPaid,
    fillRate,
    byPlatform,
    byCategory,
    warnings
  };
  if (output.ticketingGrossRevenueTtcCents !== output.ticketingHorsDlTtcCents + output.dlTtcCents.total) {
    throw new TicketingEngineInputError(
      "INVARIANT_VIOLATED",
      "gross !== horsDl + dlTotal"
    );
  }
  return output;
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/types.ts
var FinanceEngineInputError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "FinanceEngineInputError";
    this.code = code;
  }
};
var FinanceInvariantError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "FinanceInvariantError";
    this.code = code;
  }
};

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/money.ts
var MAX_ABS_MINOR = 1e13;
function assertMoney(m, ctx) {
  if (!m || typeof m !== "object") {
    throw new FinanceEngineInputError("MONEY_INVALID", `[${ctx}] montant absent`);
  }
  if (typeof m.amountMinor !== "number" || !Number.isFinite(m.amountMinor)) {
    throw new FinanceEngineInputError("MONEY_NOT_FINITE", `[${ctx}] montant non fini`);
  }
  if (!Number.isInteger(m.amountMinor)) {
    throw new FinanceEngineInputError("MONEY_NOT_INTEGER", `[${ctx}] unit\xE9 mineure non enti\xE8re: ${m.amountMinor}`);
  }
  if (Math.abs(m.amountMinor) > MAX_ABS_MINOR) {
    throw new FinanceEngineInputError("MONEY_OUT_OF_RANGE", `[${ctx}] hors plage: ${m.amountMinor}`);
  }
  if (m.currency !== "EUR" && m.currency !== "CHF") {
    throw new FinanceEngineInputError("CURRENCY_UNSUPPORTED", `[${ctx}] devise non support\xE9e: ${String(m.currency)}`);
  }
}
function money(amountMinor, currency) {
  const m = { amountMinor, currency };
  assertMoney(m, "money");
  return m;
}
function zero(currency) {
  return { amountMinor: 0, currency };
}
function assertSameCurrency(a, b, ctx) {
  if (a.currency !== b.currency) {
    throw new FinanceEngineInputError(
      "CURRENCY_MISMATCH",
      `[${ctx}] devises incompatibles: ${a.currency} vs ${b.currency} \u2014 aucune conversion implicite`
    );
  }
}
function addMoney(a, b) {
  assertMoney(a, "addMoney.a");
  assertMoney(b, "addMoney.b");
  assertSameCurrency(a, b, "addMoney");
  return money(a.amountMinor + b.amountMinor, a.currency);
}
function subMoney(a, b) {
  assertMoney(a, "subMoney.a");
  assertMoney(b, "subMoney.b");
  assertSameCurrency(a, b, "subMoney");
  return money(a.amountMinor - b.amountMinor, a.currency);
}
var RATE_RX = /^-?\d+(\.\d+)?$/;
function parseDecimalRate(rate, ctx = "rate") {
  if (typeof rate !== "string" || !RATE_RX.test(rate.trim())) {
    throw new FinanceEngineInputError("RATE_INVALID", `[${ctx}] taux d\xE9cimal invalide: ${String(rate)}`);
  }
  const trimmed = rate.trim();
  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [intPart, fracPart = ""] = abs.split(".");
  const digits = `${intPart}${fracPart}`;
  const numerator = BigInt(digits) * (negative ? -1n : 1n);
  return { numerator, scale: fracPart.length };
}
function pow10(n2) {
  return 10n ** BigInt(n2);
}
function divRound(numerator, denominator, mode = "HALF_UP") {
  if (denominator === 0n) {
    throw new FinanceEngineInputError("DIVISION_BY_ZERO", "division par z\xE9ro");
  }
  const negative = numerator < 0n !== denominator < 0n;
  const absN = numerator < 0n ? -numerator : numerator;
  const absD = denominator < 0n ? -denominator : denominator;
  const q = absN / absD;
  const r = absN % absD;
  if (r === 0n) return negative ? -q : q;
  let up;
  switch (mode) {
    case "TRUNCATE":
      up = false;
      break;
    case "FLOOR":
      up = negative;
      break;
    case "CEIL":
      up = !negative;
      break;
    case "HALF_EVEN": {
      const twice = r * 2n;
      if (twice > absD) up = true;
      else if (twice < absD) up = false;
      else up = q % 2n === 1n;
      break;
    }
    case "HALF_UP":
    default:
      up = r * 2n >= absD;
      break;
  }
  const result = up ? q + 1n : q;
  return negative ? -result : result;
}
function toNumber(value, ctx) {
  const n2 = Number(value);
  if (!Number.isSafeInteger(n2) || Math.abs(n2) > MAX_ABS_MINOR) {
    throw new FinanceEngineInputError("MONEY_OUT_OF_RANGE", `[${ctx}] r\xE9sultat hors plage: ${value.toString()}`);
  }
  return n2;
}
function applyRate(amount, rate, mode = "HALF_UP", ctx = "applyRate") {
  assertMoney(amount, ctx);
  const { numerator, scale } = parseDecimalRate(rate, ctx);
  const product = BigInt(amount.amountMinor) * numerator;
  const result = divRound(product, pow10(scale), mode);
  return money(toNumber(result, ctx), amount.currency);
}
function extractVatFromTtc(ttc, rate, mode = "HALF_UP", ctx = "extractVatFromTtc") {
  assertMoney(ttc, ctx);
  const { numerator, scale } = parseDecimalRate(rate, ctx);
  const denom = pow10(scale) + numerator;
  if (denom === 0n) {
    throw new FinanceEngineInputError("RATE_INVALID", `[${ctx}] taux d\xE9g\xE9n\xE9r\xE9 (1 + rate = 0)`);
  }
  const result = divRound(BigInt(ttc.amountMinor) * numerator, denom, mode);
  return money(toNumber(result, ctx), ttc.currency);
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/taxes.ts
function resolveTaxBase(baseType, bases, rule) {
  switch (baseType) {
    case "GROSS_TICKETING_TTC":
      return bases.grossTicketingTTC;
    case "EXCL_LOCATION_RIGHTS_TTC":
      return bases.exclLocationRightsTTC;
    case "EXCL_LOCATION_RIGHTS_HT":
      return bases.exclLocationRightsHT;
    case "NET_TICKETING_HT":
      return bases.netTicketingHT;
    case "FIXED":
      return zero(bases.currency);
    case "CUSTOM_DOCUMENTED": {
      if (!rule?.customBaseAmount) {
        throw new FinanceEngineInputError(
          "CUSTOM_BASE_MISSING",
          `[${rule?.code ?? "tax"}] assiette CUSTOM_DOCUMENTED sans montant explicite`
        );
      }
      if (!rule.customBaseDocumentation) {
        throw new FinanceEngineInputError(
          "CUSTOM_BASE_UNDOCUMENTED",
          `[${rule.code ?? "tax"}] assiette CUSTOM_DOCUMENTED non document\xE9e`
        );
      }
      assertMoney(rule.customBaseAmount, `tax.${rule.code}.customBaseAmount`);
      assertSameCurrency(rule.customBaseAmount, bases.grossTicketingTTC, "resolveTaxBase");
      return rule.customBaseAmount;
    }
    default:
      throw new FinanceEngineInputError("TAX_BASE_UNKNOWN", `assiette inconnue: ${String(baseType)}`);
  }
}
function computeTaxes(rules, bases) {
  const currency = bases.currency;
  if (!rules || rules.length === 0) {
    return { results: [], total: zero(currency) };
  }
  const active = rules.filter((r) => r.isActive !== false);
  const ordered = [...active].sort((a, b) => {
    const ao = (a.applicationOrder ?? Number.MAX_SAFE_INTEGER) - (b.applicationOrder ?? Number.MAX_SAFE_INTEGER);
    if (ao !== 0) return ao;
    const dof = (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER);
    if (dof !== 0) return dof;
    return a.code.localeCompare(b.code);
  });
  const seen = /* @__PURE__ */ new Set();
  let total = zero(currency);
  let chainedNet = bases.netTicketingHT;
  const results = [];
  for (const rule of ordered) {
    if (!rule.code) {
      throw new FinanceEngineInputError("TAX_CODE_MISSING", "r\xE8gle de taxe sans code stable");
    }
    if (seen.has(rule.code)) {
      throw new FinanceEngineInputError("TAX_CODE_DUPLICATE", `code de taxe dupliqu\xE9: ${rule.code}`);
    }
    seen.add(rule.code);
    if (rule.currency && rule.currency !== currency) {
      throw new FinanceEngineInputError(
        "CURRENCY_MISMATCH",
        `[${rule.code}] devise de la r\xE8gle (${rule.currency}) \u2260 devise du calcul (${currency})`
      );
    }
    const baseAmount = resolveTaxBase(rule.baseType, { ...bases, netTicketingHT: chainedNet }, rule);
    let calculatedAmount;
    if (rule.baseType === "FIXED") {
      if (!rule.fixedAmount) {
        throw new FinanceEngineInputError("TAX_FIXED_AMOUNT_MISSING", `[${rule.code}] montant fixe absent`);
      }
      assertMoney(rule.fixedAmount, `tax.${rule.code}.fixedAmount`);
      assertSameCurrency(rule.fixedAmount, baseAmount, `tax.${rule.code}`);
      calculatedAmount = rule.fixedAmount;
    } else {
      if (rule.rate === void 0) {
        throw new FinanceEngineInputError(
          "TAX_RATE_MISSING",
          `[${rule.code}] taux absent pour l'assiette ${rule.baseType}`
        );
      }
      calculatedAmount = applyRate(baseAmount, rule.rate, rule.roundingRule ?? "HALF_UP", `tax.${rule.code}`);
    }
    results.push({
      code: rule.code,
      label: rule.label,
      baseType: rule.baseType,
      baseAmount,
      rate: rule.rate,
      fixedAmount: rule.fixedAmount,
      calculatedAmount,
      effectiveFrom: rule.effectiveFrom,
      source: rule.source,
      roundingRule: rule.roundingRule,
      isActive: rule.isActive ?? true,
      displayOrder: rule.displayOrder,
      applicationOrder: rule.applicationOrder
    });
    total = addMoney(total, calculatedAmount);
    chainedNet = { amountMinor: chainedNet.amountMinor - calculatedAmount.amountMinor, currency };
  }
  const display = [...results].sort((a, b) => {
    const dof = (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER);
    if (dof !== 0) return dof;
    return a.code.localeCompare(b.code);
  });
  return { results: display, total };
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/cessionEngine.ts
function computeCession(input, currency) {
  if (!input) return void 0;
  assertMoney(input.amountHT, "cession.amountHT");
  if (input.amountHT.currency !== currency) {
    throw new FinanceEngineInputError(
      "CURRENCY_MISMATCH",
      `[cession] devise ${input.amountHT.currency} \u2260 devise du calcul ${currency} \u2014 aucune conversion implicite`
    );
  }
  if (!input.vatApplicable) {
    if (input.vatRate !== void 0) {
      throw new FinanceEngineInputError("CESSION_VAT_INCONSISTENT", "[cession] taux de TVA fourni alors que la TVA est d\xE9sactiv\xE9e");
    }
    return {
      amountHT: input.amountHT,
      vatApplicable: false,
      vatAmount: zero(currency),
      amountTTC: input.amountHT,
      attendance: input.attendance
    };
  }
  if (input.vatRate === void 0) {
    throw new FinanceEngineInputError("CESSION_VAT_RATE_MISSING", "[cession] TVA applicable sans taux explicite");
  }
  const vatAmount = applyRate(input.amountHT, input.vatRate, input.roundingRule ?? "HALF_UP", "cession.vat");
  return {
    amountHT: input.amountHT,
    vatApplicable: true,
    vatRate: input.vatRate,
    vatAmount,
    amountTTC: addMoney(input.amountHT, vatAmount),
    attendance: input.attendance
  };
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/productionSummary.ts
function computeTotalProductionHT(ticketingRevenueExcludingLocationRightsHT, producerLocationRightsHT, cessionRevenueHT) {
  return addMoney(addMoney(ticketingRevenueExcludingLocationRightsHT, producerLocationRightsHT), cessionRevenueHT);
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/invariants.ts
function check(cond, code, message) {
  if (!cond) throw new FinanceInvariantError(code, message);
}
function assertFinanceInvariants(r) {
  const c = r.currency;
  const sameCurrency = [
    r.grossTicketingRevenueTTC,
    r.totalLocationRightsTTC,
    r.ticketingRevenueExcludingLocationRightsTTC,
    r.ticketingVat,
    r.ticketingRevenueExcludingLocationRightsHT,
    r.totalTaxesAndWithholdingsHT,
    r.netTicketingRevenueHT,
    r.localPromoterCommissionHT,
    r.producerTicketingRevenueHT,
    r.producerLocationRightsHT,
    r.cessionRevenueHT,
    r.totalProductionHT
  ].every((m) => m.currency === c);
  check(sameCurrency, "CURRENCY_CONSISTENCY", "tous les montants doivent partager la devise du r\xE9sultat");
  check(
    r.ticketingRevenueExcludingLocationRightsTTC.amountMinor === r.grossTicketingRevenueTTC.amountMinor - r.totalLocationRightsTTC.amountMinor,
    "INVARIANT_HORS_DL_TTC",
    "Hors DL TTC \u2260 Brute TTC \u2212 Total DL TTC"
  );
  check(
    r.ticketingRevenueExcludingLocationRightsHT.amountMinor === r.ticketingRevenueExcludingLocationRightsTTC.amountMinor - r.ticketingVat.amountMinor,
    "INVARIANT_HORS_DL_HT",
    "Hors DL HT \u2260 Hors DL TTC \u2212 TVA"
  );
  check(
    r.netTicketingRevenueHT.amountMinor === r.ticketingRevenueExcludingLocationRightsHT.amountMinor - r.totalTaxesAndWithholdingsHT.amountMinor,
    "INVARIANT_NET",
    "Recette Nette \u2260 Hors DL HT \u2212 Taxes et retenues"
  );
  check(
    r.producerTicketingRevenueHT.amountMinor === r.netTicketingRevenueHT.amountMinor - r.localPromoterCommissionHT.amountMinor,
    "INVARIANT_PRODUCER",
    "Recette Producteur \u2260 Recette Nette \u2212 Commission Promoteur Local"
  );
  check(
    r.totalProductionHT.amountMinor === r.ticketingRevenueExcludingLocationRightsHT.amountMinor + r.producerLocationRightsHT.amountMinor + r.cessionRevenueHT.amountMinor,
    "INVARIANT_TOTAL_PRODUCTION",
    "Total Production HT \u2260 Hors DL HT + DL Production HT + Cession HT"
  );
  const b = r.locationRightsBreakdown;
  check(
    b.total.ttc.amountMinor === b.producer.ttc.amountMinor + b.venue.ttc.amountMinor + b.distributor.ttc.amountMinor + b.others.ttc.amountMinor,
    "INVARIANT_DL_BREAKDOWN_TTC",
    "ventilation DL TTC incoh\xE9rente"
  );
  check(
    b.total.ht.amountMinor === b.producer.ht.amountMinor + b.venue.ht.amountMinor + b.distributor.ht.amountMinor + b.others.ht.amountMinor,
    "INVARIANT_DL_BREAKDOWN_HT",
    "ventilation DL HT incoh\xE9rente"
  );
  check(
    b.total.ttc.amountMinor === r.totalLocationRightsTTC.amountMinor,
    "INVARIANT_DL_TOTAL",
    "Total DL TTC \u2260 somme de la ventilation"
  );
  check(
    b.producer.ht.amountMinor === r.producerLocationRightsHT.amountMinor,
    "INVARIANT_DL_PRODUCER_HT",
    "DL Production HT \u2260 part producteur de la ventilation"
  );
  const taxSum = r.taxesAndWithholdings.reduce((acc, t) => acc + t.calculatedAmount.amountMinor, 0);
  check(
    taxSum === r.totalTaxesAndWithholdingsHT.amountMinor,
    "INVARIANT_TAX_TOTAL",
    "total des taxes \u2260 somme des lignes"
  );
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/financeEngine.ts
var ENGINE_VERSION = "1.0.0";
function requireCurrency(m, currency, ctx) {
  assertMoney(m, ctx);
  if (m.currency !== currency) {
    throw new FinanceEngineInputError(
      "CURRENCY_MISMATCH",
      `[${ctx}] devise ${m.currency} \u2260 devise du calcul ${currency} \u2014 aucune conversion implicite`
    );
  }
  return m;
}
function locationRightsHT(ttc, policy, ctx) {
  if (!policy?.applicable) return ttc;
  if (policy.rate === void 0) {
    throw new FinanceEngineInputError("DL_VAT_RATE_MISSING", `[${ctx}] TVA DL applicable sans taux explicite`);
  }
  const vat = extractVatFromTtc(ttc, policy.rate, policy.roundingRule ?? "HALF_UP", ctx);
  return subMoney(ttc, vat);
}
function runFinanceEngineV1(input) {
  if (!input || typeof input !== "object") {
    throw new FinanceEngineInputError("INPUT_INVALID", "entr\xE9e absente");
  }
  const currency = input.currency;
  if (currency !== "EUR" && currency !== "CHF") {
    throw new FinanceEngineInputError("CURRENCY_UNSUPPORTED", `devise non support\xE9e: ${String(currency)}`);
  }
  const warnings = [];
  const grossTicketingRevenueTTC = requireCurrency(input.grossTicketingRevenueTTC, currency, "grossTicketingRevenueTTC");
  const lr = input.locationRights;
  if (!lr) throw new FinanceEngineInputError("LOCATION_RIGHTS_MISSING", "ventilation DL absente");
  const producerTTC = requireCurrency(lr.producerTTC, currency, "locationRights.producerTTC");
  const venueTTC = requireCurrency(lr.venueTTC, currency, "locationRights.venueTTC");
  const distributorTTC = requireCurrency(lr.distributorTTC, currency, "locationRights.distributorTTC");
  const othersTTC = lr.othersTTC ? requireCurrency(lr.othersTTC, currency, "locationRights.othersTTC") : zero(currency);
  const totalLocationRightsTTC = addMoney(addMoney(producerTTC, venueTTC), addMoney(distributorTTC, othersTTC));
  const producerHT = locationRightsHT(producerTTC, input.locationRightsVat, "locationRights.producer");
  const venueHT = locationRightsHT(venueTTC, input.locationRightsVat, "locationRights.venue");
  const distributorHT = locationRightsHT(distributorTTC, input.locationRightsVat, "locationRights.distributor");
  const othersHT = locationRightsHT(othersTTC, input.locationRightsVat, "locationRights.others");
  const totalLocationRightsHT = addMoney(addMoney(producerHT, venueHT), addMoney(distributorHT, othersHT));
  const ticketingRevenueExcludingLocationRightsTTC = subMoney(grossTicketingRevenueTTC, totalLocationRightsTTC);
  const vatInput = input.ticketingVat ?? { mode: "NONE" };
  let ticketingVat;
  switch (vatInput.mode) {
    case "NONE":
      ticketingVat = zero(currency);
      break;
    case "AMOUNT":
      ticketingVat = requireCurrency(vatInput.amount, currency, "ticketingVat.amount");
      break;
    case "RATE_INCLUDED":
      ticketingVat = extractVatFromTtc(
        ticketingRevenueExcludingLocationRightsTTC,
        vatInput.rate,
        vatInput.roundingRule ?? "HALF_UP",
        "ticketingVat"
      );
      break;
    default:
      throw new FinanceEngineInputError("VAT_MODE_UNKNOWN", `mode TVA inconnu: ${String(vatInput.mode)}`);
  }
  const ticketingRevenueExcludingLocationRightsHT = subMoney(
    ticketingRevenueExcludingLocationRightsTTC,
    ticketingVat
  );
  const bases = {
    currency,
    grossTicketingTTC: grossTicketingRevenueTTC,
    exclLocationRightsTTC: ticketingRevenueExcludingLocationRightsTTC,
    exclLocationRightsHT: ticketingRevenueExcludingLocationRightsHT,
    netTicketingHT: ticketingRevenueExcludingLocationRightsHT
  };
  const { results: taxesAndWithholdings, total: totalTaxesAndWithholdingsHT } = computeTaxes(input.taxes, bases);
  const netTicketingRevenueHT = subMoney(
    ticketingRevenueExcludingLocationRightsHT,
    totalTaxesAndWithholdingsHT
  );
  let localPromoter;
  let localPromoterCommissionHT = zero(currency);
  if (input.localPromoter) {
    const p = input.localPromoter;
    const baseType = p.baseType ?? "NET_TICKETING_HT";
    if (p.mode === "FIXED") {
      if (!p.fixedAmount) {
        throw new FinanceEngineInputError("PROMOTER_FIXED_AMOUNT_MISSING", "[localPromoter] montant fixe absent");
      }
      localPromoterCommissionHT = requireCurrency(p.fixedAmount, currency, "localPromoter.fixedAmount");
    } else if (p.mode === "PERCENT") {
      if (p.rate === void 0) {
        throw new FinanceEngineInputError("PROMOTER_RATE_MISSING", "[localPromoter] taux absent");
      }
      const base = resolveTaxBase(
        baseType,
        { ...bases, netTicketingHT: netTicketingRevenueHT },
        { code: "PROMOTEUR_LOCAL", customBaseAmount: p.customBaseAmount, customBaseDocumentation: "localPromoter" }
      );
      localPromoterCommissionHT = applyRate(base, p.rate, p.roundingRule ?? "HALF_UP", "localPromoter");
    } else {
      throw new FinanceEngineInputError("PROMOTER_MODE_UNKNOWN", `mode promoteur inconnu: ${String(p.mode)}`);
    }
    localPromoter = {
      reference: p.reference,
      mode: p.mode,
      baseType,
      rate: p.rate,
      fixedAmount: p.fixedAmount,
      calculatedAmount: localPromoterCommissionHT,
      currency
    };
  }
  const producerTicketingRevenueHT = subMoney(netTicketingRevenueHT, localPromoterCommissionHT);
  const cession = computeCession(input.cession, currency);
  const cessionRevenueHT = cession ? cession.amountHT : zero(currency);
  const totalProductionHT = computeTotalProductionHT(
    ticketingRevenueExcludingLocationRightsHT,
    producerHT,
    cessionRevenueHT
  );
  if (input.context?.status === "CANCELED") {
    warnings.push("EVENT_CANCELED_EXCLUDED_FROM_PERFORMANCE_ANALYTICS");
  }
  if (input.context?.status === "RESCHEDULED") {
    warnings.push("EVENT_RESCHEDULED_LINKED_DATE");
    if (!input.context.rescheduledToEventDateId) {
      warnings.push("EVENT_RESCHEDULED_LINK_MISSING");
    }
  }
  const result = {
    currency,
    grossTicketingRevenueTTC,
    totalLocationRightsTTC,
    ticketingRevenueExcludingLocationRightsTTC,
    ticketingVat,
    ticketingRevenueExcludingLocationRightsHT,
    taxesAndWithholdings,
    totalTaxesAndWithholdingsHT,
    netTicketingRevenueHT,
    localPromoterCommissionHT,
    producerTicketingRevenueHT,
    producerLocationRightsHT: producerHT,
    cessionRevenueHT,
    totalProductionHT,
    locationRightsBreakdown: {
      producer: { ht: producerHT, ttc: producerTTC },
      venue: { ht: venueHT, ttc: venueTTC },
      distributor: { ht: distributorHT, ttc: distributorTTC },
      others: { ht: othersHT, ttc: othersTTC },
      total: { ht: totalLocationRightsHT, ttc: totalLocationRightsTTC }
    },
    localPromoter,
    cession,
    context: input.context,
    warnings,
    engineVersion: ENGINE_VERSION
  };
  assertFinanceInvariants(result);
  return result;
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/bordereauInputAdapter.ts
var EUR = "EUR";
function eurosToCents(euros) {
  if (!Number.isFinite(euros)) return 0;
  return Math.round(euros * 100);
}
function eurMoney(euros) {
  return money(eurosToCents(euros), EUR);
}
function percentToDecimalRate(percent) {
  if (!Number.isFinite(percent)) return "0";
  const negative = percent < 0;
  const abs = Math.abs(percent);
  const str = abs.toString();
  const [intPart, fracPart = ""] = str.split(".");
  const digits = `${intPart}${fracPart}`;
  const totalScale = fracPart.length + 2;
  const padded = digits.padStart(totalScale + 1, "0");
  const cut = padded.length - totalScale;
  const wholePart = padded.slice(0, cut) || "0";
  const decimalPart = padded.slice(cut);
  let rate = `${wholePart}.${decimalPart}`.replace(/0+$/, "").replace(/\.$/, "");
  if (rate === "" || rate === "-") rate = "0";
  return negative && rate !== "0" ? `-${rate}` : rate;
}
function mapEventDateStatus(status, rescheduledToEventDateId) {
  if (status === "cancelled") {
    return { status: "CANCELED" };
  }
  if (status === "rescheduled" || rescheduledToEventDateId) {
    return { status: "RESCHEDULED", rescheduledToEventDateId: rescheduledToEventDateId ?? void 0 };
  }
  return void 0;
}
function adaptBordereauInput(input) {
  const notes = [];
  const ticketing = input.isCession ? { sales: [], priceCatalog: [], capacity: input.capacity ?? null } : {
    sales: input.sales.map((s, i) => ({
      id: s.id,
      categoryId: s.ticket_price_id ?? "",
      platformId: s.platform ?? null,
      quantity: s.quantity,
      sourceRef: s.id ?? `bordereau-sale-${i}`
    })),
    priceCatalog: input.priceCatalog.map((p) => ({
      id: p.id,
      label: p.label,
      ticketPriceTtcCents: eurosToCents(p.price_ht + (p.dl_producer || 0) + (p.dl_venue || 0) + (p.dl_distribution || 0)),
      dlProducerTtcCents: eurosToCents(p.dl_producer || 0),
      dlVenueTtcCents: eurosToCents(p.dl_venue || 0),
      dlDistributorTtcCents: eurosToCents(p.dl_distribution || 0)
    })),
    capacity: input.capacity ?? null
  };
  if (input.isCession) {
    notes.push(
      "CESSION_TICKETING_CHAIN_BYPASSED: le legacy fait transiter le montant de cession par la cha\xEEne TVA/taxes billetterie (computeRecetteSummary) ; FinanceEngine mod\xE9lise la cession comme un flux HT ind\xE9pendant (docs \xA710.4). TicketingEngine re\xE7oit un catalogue vide (aucune vente billetterie sur une date en cession, comportement identique \xE0 useBordereau.ts)."
    );
  }
  const vatRate = percentToDecimalRate(input.vatRatePercent);
  const promoteurTax = input.taxes.find((t) => t.code === "PROMOTEUR_LOCAL");
  const otherTaxes = input.taxes.filter((t) => t.code !== "PROMOTEUR_LOCAL");
  const taxDrafts = otherTaxes.map((tax, i) => {
    switch (tax.apply_to) {
      case "RECIPE_HT":
        return {
          kind: "resolved",
          rule: buildSimpleRule(tax, i, "EXCL_LOCATION_RIGHTS_HT")
        };
      case "DL_PROD_HT":
        notes.push(
          `DL_PROD_HT_IS_ACTUALLY_TTC: taxe "${tax.code}" assise sur la valeur TTC de DL Producteur (bug de nommage legacy).`
        );
        return { kind: "dl_prod_ttc_custom", code: tax.code, label: tax.label, mode: tax.mode, value: tax.value, order: i };
      case "SACEM":
        return { kind: "sacem_chained_custom", code: tax.code, label: tax.label, mode: tax.mode, value: tax.value, order: i };
      case "CUSTOM":
        notes.push(
          `CUSTOM_APPLY_TO_DEFAULTED: taxe "${tax.code}" a apply_to=CUSTOM ; le legacy retombe silencieusement sur l'assiette Hors DL HT (cas par d\xE9faut du switch). Reproduit \xE0 l'identique, assiette r\xE9ellement ambigu\xEB.`
        );
        return { kind: "resolved", rule: buildSimpleRule(tax, i, "EXCL_LOCATION_RIGHTS_HT") };
      default:
        return { kind: "resolved", rule: buildSimpleRule(tax, i, "EXCL_LOCATION_RIGHTS_HT") };
    }
  });
  let localPromoter;
  if (promoteurTax) {
    localPromoter = promoteurTax.mode === "fixed" ? { mode: "FIXED", fixedAmount: eurMoney(promoteurTax.value), baseType: "NET_TICKETING_HT" } : { mode: "PERCENT", rate: percentToDecimalRate(promoteurTax.value), baseType: "NET_TICKETING_HT" };
  }
  let cession;
  if (input.isCession) {
    const cessionVatPercent = input.cessionVatRatePercent ?? input.vatRatePercent;
    if (input.cessionVatRatePercent == null) {
      notes.push(
        "CESSION_VAT_RATE_FALLBACK: aucun taux de TVA cession distinct en base \xE0 ce jour ; r\xE9utilisation du taux de TVA billetterie (P1 laisse ce taux param\xE9trable par workspace, non encore impl\xE9ment\xE9)."
      );
    }
    cession = {
      amountHT: eurMoney(input.cessionAmountHtEuros ?? 0),
      vatApplicable: true,
      vatRate: percentToDecimalRate(cessionVatPercent)
    };
  }
  const financeDraft = {
    isCession: input.isCession,
    vatRate,
    taxDrafts,
    localPromoter,
    cession,
    context: mapEventDateStatus(input.eventDateStatus, input.rescheduledToEventDateId)
  };
  return { ticketing, financeDraft, notes };
}
function buildSimpleRule(tax, order, baseType) {
  const base = {
    code: tax.code,
    label: tax.label,
    baseType: tax.mode === "fixed" ? "FIXED" : baseType,
    displayOrder: order
  };
  if (tax.mode === "fixed") {
    base.fixedAmount = eurMoney(tax.value);
  } else {
    base.rate = percentToDecimalRate(tax.value);
  }
  return base;
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/bordereauCanonicalService.ts
var EUR2 = "EUR";
function resolveTaxDraft(draft, producerLocationRightsTTC, sacemCalculatedAmount) {
  if (draft.kind === "resolved") return draft.rule;
  if (draft.kind === "dl_prod_ttc_custom") {
    const base2 = {
      code: draft.code,
      label: draft.label,
      baseType: draft.mode === "fixed" ? "FIXED" : "CUSTOM_DOCUMENTED",
      displayOrder: draft.order
    };
    if (draft.mode === "fixed") {
      base2.fixedAmount = money(Math.round(draft.value * 100), EUR2);
    } else {
      base2.rate = draft.value.toString();
      base2.customBaseAmount = producerLocationRightsTTC;
      base2.customBaseDocumentation = 'Reproduction legacy : "DL_PROD_HT" re\xE7oit en r\xE9alit\xE9 la valeur TTC de DL Producteur (bug de nommage, cf. docs/AUDIT_SEMANTIQUE_FINANCE_20260802.md \xA75) \u2014 Lot A3.2';
    }
    return base2;
  }
  const base = {
    code: draft.code,
    label: draft.label,
    baseType: draft.mode === "fixed" ? "FIXED" : "CUSTOM_DOCUMENTED",
    displayOrder: draft.order
  };
  if (draft.mode === "fixed") {
    base.fixedAmount = money(Math.round(draft.value * 100), EUR2);
  } else {
    base.rate = draft.value.toString();
    base.customBaseAmount = sacemCalculatedAmount;
    base.customBaseDocumentation = "Assiette cha\xEEn\xE9e legacy : montant calcul\xE9 de la taxe SACEM (apply_to=SACEM) \u2014 Lot A3.2";
  }
  return base;
}
function runBordereauCanonical(input) {
  let notes = [];
  try {
    const adapted = adaptBordereauInput(input);
    const ticketingInput = adapted.ticketing;
    const financeDraft = adapted.financeDraft;
    notes = adapted.notes;
    const ticketing = runTicketingEngineV1(ticketingInput);
    const grossTTC = money(ticketing.ticketingGrossRevenueTtcCents, EUR2);
    const producerTTC = money(ticketing.dlTtcCents.producer, EUR2);
    const venueTTC = money(ticketing.dlTtcCents.venue, EUR2);
    const distributorTTC = money(ticketing.dlTtcCents.distributor, EUR2);
    const exclLocationRightsTTC = money(ticketing.ticketingHorsDlTtcCents, EUR2);
    let taxRules = [];
    if (!financeDraft.isCession && financeDraft.taxDrafts.length > 0) {
      const ticketingVatForChain = extractVatFromTtc(
        exclLocationRightsTTC,
        financeDraft.vatRate,
        "HALF_UP",
        "bordereauCanonicalService.chainedBaseVat"
      );
      const exclLocationRightsHT = money(
        exclLocationRightsTTC.amountMinor - ticketingVatForChain.amountMinor,
        EUR2
      );
      const bases = {
        currency: EUR2,
        grossTicketingTTC: grossTTC,
        exclLocationRightsTTC,
        exclLocationRightsHT,
        netTicketingHT: exclLocationRightsHT
      };
      const sacemDraft = financeDraft.taxDrafts.find(
        (d) => d.kind === "resolved" && d.rule.code === "SACEM"
      );
      let sacemCalculatedAmount = money(0, EUR2);
      if (sacemDraft) {
        sacemCalculatedAmount = computeTaxes([sacemDraft.rule], bases).total;
      }
      taxRules = financeDraft.taxDrafts.map((d) => resolveTaxDraft(d, producerTTC, sacemCalculatedAmount));
    } else if (financeDraft.isCession && financeDraft.taxDrafts.length > 0) {
      notes.push(
        "CESSION_TAXES_IGNORED: des taxes non-promoteur \xE9taient configur\xE9es sur cette date en cession ; conform\xE9ment \xE0 la doctrine (CessionEngine ne taxe jamais la cession, docs \xA710.4), elles ne sont PAS appliqu\xE9es dans le chemin canonique \u2014 divergence structurelle d\xE9j\xE0 document\xE9e, pas une r\xE9gression."
      );
    }
    const finance = runFinanceEngineV1({
      currency: EUR2,
      grossTicketingRevenueTTC: grossTTC,
      locationRights: { producerTTC, venueTTC, distributorTTC },
      ticketingVat: financeDraft.isCession ? { mode: "NONE" } : { mode: "RATE_INCLUDED", rate: financeDraft.vatRate },
      taxes: taxRules,
      localPromoter: financeDraft.isCession ? void 0 : financeDraft.localPromoter,
      cession: financeDraft.cession,
      context: financeDraft.context
    });
    return { result: { ticketing, finance }, notes, error: null };
  } catch (e) {
    return { result: null, notes, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/bordereauTaxFields.ts
function buildBordereauTaxFields(finance) {
  const retenuesTotalBeforePromoteur = finance.totalTaxesAndWithholdingsHT.amountMinor / 100;
  const promoteurLocalAmount = finance.localPromoterCommissionHT.amountMinor / 100;
  return {
    totalTaxes: retenuesTotalBeforePromoteur + promoteurLocalAmount,
    retenuesTotalBeforePromoteur,
    recetteHTApresRetenues: finance.netTicketingRevenueHT.amountMinor / 100,
    promoteurLocalAmount,
    recetteNette: finance.producerTicketingRevenueHT.amountMinor / 100
  };
}
function emptyBordereauTaxFields() {
  return {
    totalTaxes: 0,
    retenuesTotalBeforePromoteur: 0,
    recetteHTApresRetenues: 0,
    promoteurLocalAmount: 0,
    recetteNette: 0
  };
}
function cessionBordereauTaxFields(cessionAmountHT) {
  return {
    totalTaxes: 0,
    retenuesTotalBeforePromoteur: 0,
    recetteHTApresRetenues: cessionAmountHT,
    promoteurLocalAmount: 0,
    recetteNette: cessionAmountHT
  };
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/bordereauLogDedup.ts
var seenKeys = /* @__PURE__ */ new Set();
function buildBordereauDivergenceLogKey(params) {
  return `${params.eventDateId}::${params.metric}::${params.legacyCents}::${params.canonicalCents}`;
}
function shouldLogBordereauDivergence(key) {
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  return true;
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/cessionAdapter.ts
function eurosToCents2(euros) {
  if (!Number.isFinite(euros)) return 0;
  return Math.round(euros * 100);
}
function eurMoney2(euros, currency) {
  return money(eurosToCents2(euros), currency);
}
function percentToDecimalRate2(percent) {
  if (!Number.isFinite(percent)) return "0";
  const negative = percent < 0;
  const abs = Math.abs(percent);
  const str = abs.toString();
  const [intPart, fracPart = ""] = str.split(".");
  const digits = `${intPart}${fracPart}`;
  const totalScale = fracPart.length + 2;
  const padded = digits.padStart(totalScale + 1, "0");
  const cut = padded.length - totalScale;
  const wholePart = padded.slice(0, cut) || "0";
  const decimalPart = padded.slice(cut);
  let rate = `${wholePart}.${decimalPart}`.replace(/0+$/, "").replace(/\.$/, "");
  if (rate === "" || rate === "-") rate = "0";
  return negative && rate !== "0" ? `-${rate}` : rate;
}
function resolveContext(eventDateStatus, rescheduledToEventDateId) {
  if (eventDateStatus === "cancelled") {
    return { status: "CANCELED" };
  }
  if (eventDateStatus === "rescheduled" || rescheduledToEventDateId) {
    return { status: "RESCHEDULED", rescheduledToEventDateId: rescheduledToEventDateId ?? void 0 };
  }
  return void 0;
}
function adaptCession(input) {
  const currency = input.currency ?? "EUR";
  const warnings = [];
  const isCession = input.dealType === "cession";
  if (!isCession) {
    return { isCession: false, currency, warnings };
  }
  const context = resolveContext(input.eventDateStatus, input.rescheduledToEventDateId);
  const rawAmount = input.cessionAmountHtEuros;
  if (rawAmount == null) {
    warnings.push(
      "CESSION_AMOUNT_MISSING_DEFAULTED_ZERO: aucun montant de cession renseign\xE9 (dealType=cession) ; trait\xE9 comme 0 HT."
    );
  } else if (!Number.isFinite(rawAmount)) {
    warnings.push("CESSION_AMOUNT_NOT_FINITE_DEFAULTED_ZERO: montant de cession non num\xE9rique ; trait\xE9 comme 0 HT.");
  }
  const amountEuros = rawAmount != null && Number.isFinite(rawAmount) ? rawAmount : 0;
  if (amountEuros < 0) {
    warnings.push(
      "CESSION_AMOUNT_NEGATIVE: montant de cession n\xE9gatif \u2014 reproduit tel quel, aucune correction m\xE9tier dans l'adaptateur."
    );
  }
  const vatApplicable = input.cessionVatApplicable ?? true;
  let vatRate;
  if (vatApplicable) {
    const vatPercent = input.cessionVatRatePercent ?? input.vatRatePercent;
    if (input.cessionVatRatePercent == null) {
      warnings.push(
        "CESSION_VAT_RATE_FALLBACK: aucun taux de TVA cession distinct en base \xE0 ce jour ; r\xE9utilisation du taux de TVA billetterie (param\xE9trable par workspace \xE0 terme, non encore impl\xE9ment\xE9)."
      );
    }
    vatRate = percentToDecimalRate2(vatPercent);
  }
  const cessionInput = {
    amountHT: eurMoney2(amountEuros, currency),
    vatApplicable,
    vatRate,
    attendance: input.attendance ?? void 0
  };
  return { isCession: true, currency, cessionInput, context, warnings };
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/canonicalCessionService.ts
function emptyResult(currency, status, warnings, context) {
  return {
    amountHT: zero(currency),
    currency,
    vatRule: { applicable: false },
    status,
    context,
    warnings,
    version: "1.0.0"
  };
}
function runCanonicalCession(input) {
  const currency = input.currency ?? "EUR";
  const adapted = adaptCession(input);
  if (!adapted.isCession) {
    return emptyResult(currency, "NOT_CESSION", adapted.warnings);
  }
  try {
    const result = computeCession(adapted.cessionInput, currency);
    if (!result) {
      return emptyResult(currency, "NOT_CESSION", adapted.warnings, adapted.context);
    }
    return {
      amountHT: result.amountHT,
      vatAmount: result.vatAmount,
      amountTTC: result.amountTTC,
      attendance: result.attendance,
      vatRule: { applicable: result.vatApplicable, rate: result.vatRate },
      currency,
      status: "COMPUTED",
      context: adapted.context,
      warnings: adapted.warnings,
      version: "1.0.0"
    };
  } catch (e) {
    const message = e instanceof FinanceEngineInputError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
    return emptyResult(currency, "ENGINE_ERROR", [...adapted.warnings, `CESSION_ENGINE_ERROR: ${message}`], adapted.context);
  }
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/cessionShadowMode.ts
function euroToCents(euros) {
  return Math.round(euros * 100);
}
function metricRow(metric, legacyEuros, canonical, toleranceCents) {
  const legacyCents = euroToCents(legacyEuros);
  const canonicalCents = canonical.amountMinor;
  const diffCents = canonicalCents - legacyCents;
  return {
    metric,
    legacyCents,
    canonicalCents,
    diffCents,
    toleranceCents,
    withinTolerance: Math.abs(diffCents) <= toleranceCents
  };
}
function compareCessionShadow(legacy, canonical, toleranceCents = 1) {
  if (canonical.status !== "COMPUTED") {
    return {
      comparableMetrics: [],
      semanticMismatches: [],
      hasUnexpectedMonetaryDivergence: false,
      notes: canonical.warnings
    };
  }
  const comparableMetrics = [
    metricRow("cessionAmountHT", legacy.recetteHT, canonical.amountHT, toleranceCents)
  ];
  if (canonical.amountTTC) {
    comparableMetrics.push(metricRow("cessionAmountTTC", legacy.recetteTTC, canonical.amountTTC, toleranceCents));
  }
  const semanticMismatches = [];
  if (legacy.recetteNetteLegacyTaxee !== void 0) {
    semanticMismatches.push({
      metric: "Recette Nette (legacy, cha\xEEne tax\xE9e) vs Cession HT (canonique, jamais tax\xE9e)",
      category: "CESSION_PIPELINE_DIVERGENCE",
      reason: "Le Bordereau UI legacy fait transiter le montant de cession par la cha\xEEne TVA/taxes billetterie (hors PROMOTEUR_LOCAL) avant d'afficher une \xAB Recette Nette \xBB. CessionEngine ne taxe jamais la cession (docs/FINANCE_GOVERNANCE.md, Synth\xE8se point 4). Ces deux grandeurs ne sont structurellement pas comparables \u2014 ce n'est jamais une divergence mon\xE9taire inattendue.",
      legacyCents: euroToCents(legacy.recetteNetteLegacyTaxee),
      canonicalCents: canonical.amountHT.amountMinor
    });
  }
  const hasUnexpectedMonetaryDivergence = comparableMetrics.some((m) => !m.withinTolerance);
  return {
    comparableMetrics,
    semanticMismatches,
    hasUnexpectedMonetaryDivergence,
    notes: canonical.warnings
  };
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/cessionSafeCutover.ts
var LEGACY_BORDEREAU_CURRENCY = "EUR";
function euroToCents2(euros) {
  return Math.round(euros * 100);
}
function allLegacy(legacy) {
  return {
    amountHT: legacy.amountHT,
    vatAmount: legacy.vatAmount,
    amountTTC: legacy.amountTTC,
    source: { amountHT: "legacy", vatAmount: "legacy", amountTTC: "legacy" },
    fallbackReasons: {}
  };
}
function blockAll(legacy, reason) {
  const result = allLegacy(legacy);
  result.fallbackReasons = { amountHT: reason, vatAmount: reason, amountTTC: reason };
  return result;
}
function computeCessionSafeCutover(legacy, isCession, canonical) {
  if (!isCession) {
    return allLegacy(legacy);
  }
  if (!canonical || canonical.status !== "COMPUTED") {
    return blockAll(legacy, "CANONICAL_CESSION_ERROR");
  }
  if (canonical.currency !== LEGACY_BORDEREAU_CURRENCY) {
    return blockAll(legacy, "CURRENCY_MISMATCH");
  }
  const result = allLegacy(legacy);
  const legacyHTCents = euroToCents2(legacy.amountHT);
  const canonicalHTCents = canonical.amountHT.amountMinor;
  if (legacyHTCents === canonicalHTCents) {
    result.amountHT = canonicalHTCents / 100;
    result.source.amountHT = "canonical";
  } else {
    result.fallbackReasons.amountHT = "CESSION_AMOUNT_MISMATCH";
  }
  if (canonical.vatRule.applicable && !canonical.vatRule.rate) {
    result.fallbackReasons.vatAmount = "CESSION_VAT_RATE_MISSING";
    result.fallbackReasons.amountTTC = "CESSION_VAT_RATE_MISSING";
  } else {
    const canonicalVatCents = canonical.vatAmount?.amountMinor ?? 0;
    const legacyVatCents = euroToCents2(legacy.vatAmount);
    if (legacyVatCents === canonicalVatCents) {
      result.vatAmount = canonicalVatCents / 100;
      result.source.vatAmount = "canonical";
    } else {
      result.fallbackReasons.vatAmount = "CESSION_VAT_AMOUNT_MISMATCH";
    }
  }
  if (!result.fallbackReasons.amountTTC) {
    const canonicalTTCCents = canonical.amountTTC?.amountMinor;
    if (canonicalTTCCents === void 0) {
      result.fallbackReasons.amountTTC = "CANONICAL_CESSION_ERROR";
    } else {
      const legacyTTCCents = euroToCents2(legacy.amountTTC);
      if (legacyTTCCents === canonicalTTCCents) {
        result.amountTTC = canonicalTTCCents / 100;
        result.source.amountTTC = "canonical";
      } else {
        result.fallbackReasons.amountTTC = "CESSION_TTC_MISMATCH";
      }
    }
  }
  return result;
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/finance/canonical/adapters/bordereauCalculationsService.ts
var EMPTY_BORDEREAU_CALCULATIONS = {
  recetteTTC: 0,
  recetteHT: 0,
  tva: 0,
  vatRate: 5.5,
  dlProdHT: 0,
  dlSalleHT: 0,
  dlDistribHT: 0,
  dlTotalTtc: 0,
  revenueExcludingDlTtc: 0,
  dlPromoterPct: 30,
  dlPromoterAmount: 0,
  dlProducerAmount: 0,
  locationAmount: 0,
  mgAmount: 0,
  percentageSalleAmount: 0,
  salleEffective: 0,
  salleExtras: 0,
  salleTotal: 0,
  totalA: 0,
  totalB: 0,
  totalC: 0,
  totalD: 0,
  totalE: 0,
  totalP: 0,
  totalTaxes: 0,
  retenuesTotalBeforePromoteur: 0,
  recetteHTApresRetenues: 0,
  promoteurLocalAmount: 0,
  totalCosts: 0,
  recetteNette: 0,
  totalProduction: 0
};
function computeBordereauCalculations(input) {
  const {
    eventDateId,
    eventDate,
    project,
    sales,
    ticketPrices,
    costItems,
    taxes,
    communicationActions,
    plateauCost,
    totalDigitalTTC,
    enabled = true
  } = input;
  if (!enabled) return EMPTY_BORDEREAU_CALCULATIONS;
  const vatRatePercent = project?.vatRate ?? eventDate?.vatRate ?? 5.5;
  const vatRate = vatRatePercent / 100;
  const isCession = eventDate?.dealType === "cession";
  const dlPromoterPct = eventDate?.dlPromoterPct ?? 30;
  if (!eventDate) {
    return {
      recetteTTC: 0,
      recetteHT: 0,
      tva: 0,
      vatRate: vatRatePercent,
      dlProdHT: 0,
      dlSalleHT: 0,
      dlDistribHT: 0,
      dlTotalTtc: 0,
      revenueExcludingDlTtc: 0,
      dlPromoterPct: 30,
      dlPromoterAmount: 0,
      dlProducerAmount: 0,
      locationAmount: 0,
      mgAmount: 0,
      percentageSalleAmount: 0,
      salleEffective: 0,
      salleExtras: 0,
      salleTotal: 0,
      totalA: 0,
      totalB: 0,
      totalC: 0,
      totalD: 0,
      totalE: 0,
      totalP: 0,
      totalTaxes: 0,
      retenuesTotalBeforePromoteur: 0,
      recetteHTApresRetenues: 0,
      promoteurLocalAmount: 0,
      totalCosts: 0,
      recetteNette: 0,
      totalProduction: 0
    };
  }
  let recetteTTC = 0;
  let recetteHT = 0;
  let dlProdTotal = 0;
  let dlSalleTotal = 0;
  let dlDistribTotal = 0;
  if (isCession) {
    recetteHT = eventDate.cessionAmountHt ?? 0;
    recetteTTC = recetteHT * (1 + vatRate);
  } else {
    sales.forEach((sale) => {
      const price = ticketPrices.find((p) => p.id === sale.ticket_price_id);
      if (price) {
        dlProdTotal += (price.dl_producer || 0) * (sale.quantity || 0);
        dlSalleTotal += (price.dl_venue || 0) * (sale.quantity || 0);
        dlDistribTotal += (price.dl_distribution || 0) * (sale.quantity || 0);
        recetteHT += (price.price_ht || 0) * (sale.quantity || 0);
      }
    });
  }
  if (isNaN(recetteTTC)) recetteTTC = 0;
  if (isNaN(recetteHT)) recetteHT = 0;
  if (isNaN(dlProdTotal)) dlProdTotal = 0;
  if (isNaN(dlSalleTotal)) dlSalleTotal = 0;
  if (isNaN(dlDistribTotal)) dlDistribTotal = 0;
  const dlProdHT = dlProdTotal;
  const dlSalleHT = dlSalleTotal;
  const dlDistribHT = dlDistribTotal;
  const dlTotalTtc = dlProdHT + dlSalleHT + dlDistribHT;
  const taxInputs = taxes.filter((tax) => !(isCession && tax.code === "PROMOTEUR_LOCAL")).map((tax) => ({
    code: tax.code,
    label: tax.label,
    mode: tax.mode,
    value: tax.value,
    apply_to: tax.apply_to
  }));
  let canonicalOutcome = null;
  try {
    canonicalOutcome = runBordereauCanonical({
      sales: sales.map((s) => ({ id: s.id, ticket_price_id: s.ticket_price_id, quantity: s.quantity, platform: s.platform })),
      priceCatalog: ticketPrices.map((p) => ({
        id: p.id,
        price_ht: p.price_ht,
        dl_producer: p.dl_producer,
        dl_venue: p.dl_venue,
        dl_distribution: p.dl_distribution
      })),
      capacity: null,
      vatRatePercent,
      taxes: taxInputs,
      isCession,
      cessionAmountHtEuros: isCession ? eventDate.cessionAmountHt ?? null : null,
      eventDateStatus: eventDate.status
    });
    if (canonicalOutcome.error) {
      const key = buildBordereauDivergenceLogKey({
        eventDateId,
        metric: "CANONICAL_ENGINE_ERROR",
        legacyCents: 0,
        canonicalCents: -1
      });
      if (shouldLogBordereauDivergence(key)) {
      }
    }
  } catch (canonicalError) {
    canonicalOutcome = null;
  }
  const finance = canonicalOutcome?.result?.finance ?? null;
  let cessionCutover = null;
  if (isCession) {
    const legacyCessionHT = recetteHT;
    const legacyCessionTTC = recetteTTC;
    const legacyCessionVat = recetteTTC - recetteHT;
    let canonicalCession = null;
    try {
      canonicalCession = runCanonicalCession({
        dealType: eventDate.dealType,
        cessionAmountHtEuros: eventDate.cessionAmountHt ?? null,
        vatRatePercent,
        attendance: eventDate.actualAttendance ?? null,
        eventDateStatus: eventDate.status
      });
      const cessionComparison = compareCessionShadow(
        { recetteHT: legacyCessionHT, recetteTTC: legacyCessionTTC },
        canonicalCession
      );
      if (cessionComparison.hasUnexpectedMonetaryDivergence) {
        for (const m of cessionComparison.comparableMetrics.filter((x) => !x.withinTolerance)) {
          const key = buildBordereauDivergenceLogKey({
            eventDateId,
            metric: `cession:${m.metric}`,
            legacyCents: m.legacyCents,
            canonicalCents: m.canonicalCents
          });
          if (shouldLogBordereauDivergence(key)) {
          }
        }
      }
    } catch (cessionShadowError) {
    }
    try {
      cessionCutover = computeCessionSafeCutover(
        { amountHT: legacyCessionHT, vatAmount: legacyCessionVat, amountTTC: legacyCessionTTC },
        isCession,
        canonicalCession
      );
      const fallbackEntries = Object.entries(cessionCutover.fallbackReasons);
      for (const [field, reason] of fallbackEntries) {
        const key = buildBordereauDivergenceLogKey({
          eventDateId,
          metric: `cession-cutover:${field}`,
          legacyCents: Math.round(
            (field === "amountHT" ? legacyCessionHT : field === "vatAmount" ? legacyCessionVat : legacyCessionTTC) * 100
          ),
          canonicalCents: reason === "CANONICAL_CESSION_ERROR" || reason === "CURRENCY_MISMATCH" ? -1 : 0
        });
        if (shouldLogBordereauDivergence(key)) {
        }
      }
    } catch (cessionCutoverError) {
      cessionCutover = null;
    }
  }
  const displayRecetteTTC = isCession ? cessionCutover ? cessionCutover.amountTTC : recetteTTC : finance ? finance.grossTicketingRevenueTTC.amountMinor / 100 : 0;
  const displayRecetteHT = isCession ? cessionCutover ? cessionCutover.amountHT : recetteHT : finance ? finance.ticketingRevenueExcludingLocationRightsHT.amountMinor / 100 : 0;
  const displayTva = isCession ? cessionCutover ? cessionCutover.vatAmount : recetteTTC - recetteHT : finance ? finance.ticketingVat.amountMinor / 100 : 0;
  const revenueExcludingDlTtc = displayRecetteTTC - dlTotalTtc;
  const taxFields = isCession ? cessionBordereauTaxFields(displayRecetteHT) : finance ? buildBordereauTaxFields(finance) : emptyBordereauTaxFields();
  const { totalTaxes, retenuesTotalBeforePromoteur, recetteHTApresRetenues, promoteurLocalAmount, recetteNette } = taxFields;
  const getGroupItems = (code) => costItems.filter((item) => item.group_code === code);
  const groupA = getGroupItems("A");
  const groupB = getGroupItems("B");
  const groupC = getGroupItems("C");
  const groupD = getGroupItems("D");
  const locationItem = groupA.find((i) => i.cell_code === "A01");
  const mgItem = groupA.find((i) => i.cell_code === "A02");
  const percentItem = groupA.find((i) => i.cell_code === "A03");
  const locationAmount = locationItem?.total || 0;
  const mgAmount = mgItem?.total || 0;
  const percentageSalleAmount = percentItem ? displayRecetteHT * ((percentItem.quantity || 0) / 100) : 0;
  const salleEffective = Math.max(mgAmount, percentageSalleAmount);
  const salleExtras = groupA.filter((i) => !["A01", "A02", "A03"].includes(i.cell_code)).reduce((sum, i) => sum + (i.total || 0), 0);
  const salleTotal = locationAmount + salleEffective + salleExtras;
  const totalP = communicationActions.reduce((sum, a) => sum + (a.total_cost || 0), 0);
  const dlPromoterAmount = dlProdHT * (dlPromoterPct / 100);
  const dlProducerAmount = dlProdHT - dlPromoterAmount;
  const commercAmount = dlPromoterAmount;
  const dExtras = groupD.filter((i) => !["D01", "D02"].includes(i.cell_code)).reduce((sum, i) => sum + (i.total || 0), 0);
  const totalA = salleTotal;
  const totalB = groupB.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalC = groupC.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalD = totalP + commercAmount + dExtras;
  const quotePartTournee = plateauCost.totalAllocation;
  const groupE = getGroupItems("E");
  const manualETotal = groupE.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalE = quotePartTournee + manualETotal + totalDigitalTTC;
  const totalCostsDate = totalA + totalB + totalC + totalD;
  const totalCosts = totalA + totalB + totalC + totalD + totalE + totalTaxes;
  const totalProduction = recetteNette + dlProducerAmount - totalE - totalCostsDate;
  return {
    recetteTTC: displayRecetteTTC,
    recetteHT: displayRecetteHT,
    tva: displayTva,
    vatRate: vatRatePercent,
    dlProdHT,
    dlSalleHT,
    dlDistribHT,
    dlTotalTtc,
    revenueExcludingDlTtc,
    dlPromoterPct,
    dlPromoterAmount,
    dlProducerAmount,
    locationAmount,
    mgAmount,
    percentageSalleAmount,
    salleEffective,
    salleExtras,
    salleTotal,
    totalA,
    totalB,
    totalC,
    totalD,
    totalE,
    totalP,
    totalTaxes,
    retenuesTotalBeforePromoteur,
    recetteHTApresRetenues,
    promoteurLocalAmount,
    totalCosts,
    recetteNette,
    totalProduction
  };
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/constants/dateStatuses.ts
var COMMERCIAL_EVENT_DATE_STATUSES = [
  "option_1",
  "option_2",
  "confirmed",
  "on_sale",
  "cancelled"
];
var DATE_STATUS_CONFIG = {
  off: {
    label: "Jour OFF",
    badgeClassName: "bg-muted text-muted-foreground border-border",
    pillClassName: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    color: "#94a3b8",
    showBadge: true,
    order: 0
  },
  option_1: {
    label: "Option 1",
    badgeClassName: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    pillClassName: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    color: "#f97316",
    showBadge: true,
    order: 1
  },
  option_2: {
    label: "Option 2",
    badgeClassName: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    pillClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    color: "#f59e0b",
    showBadge: true,
    order: 2
  },
  confirmed: {
    label: "Confirm\xE9",
    badgeClassName: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    pillClassName: "bg-green-500/15 text-green-700 dark:text-green-400",
    color: "#22c55e",
    showBadge: false,
    // Default state — no badge shown
    order: 3
  },
  on_sale: {
    label: "En vente",
    badgeClassName: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    pillClassName: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    color: "#3b82f6",
    showBadge: true,
    order: 4
  },
  cancelled: {
    label: "Annul\xE9",
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    pillClassName: "bg-red-500/15 text-red-700 dark:text-red-400",
    color: "#ef4444",
    showBadge: true,
    order: 5
  },
  postponed: {
    label: "Report\xE9 \u2014 date \xE0 venir",
    badgeClassName: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    pillClassName: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    color: "#8b5cf6",
    showBadge: true,
    order: 6
  },
  rescheduled: {
    label: "Report\xE9",
    badgeClassName: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 border-slate-300 dark:border-slate-700",
    pillClassName: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
    color: "#64748b",
    showBadge: true,
    order: 7
  },
  closed: {
    label: "Cl\xF4tur\xE9",
    badgeClassName: "bg-primary/20 text-primary border-primary/30",
    pillClassName: "bg-primary/15 text-primary",
    color: "#eab308",
    showBadge: true,
    order: 8
  }
};
var DATE_STATUS_OPTIONS_ALL = Object.entries(
  DATE_STATUS_CONFIG
).sort(([, a], [, b]) => a.order - b.order).map(([value, config]) => ({ value, label: config.label }));
var COMMERCIAL_DATE_STATUS_OPTIONS = DATE_STATUS_OPTIONS_ALL.filter((opt) => COMMERCIAL_EVENT_DATE_STATUSES.includes(opt.value));
var LEGACY_OPTION_EVENT_DATE_STATUSES = ["option_1", "option_2"];
var NON_EXPLOITATION_EVENT_DATE_STATUSES = [
  "cancelled",
  "option_1",
  "option_2",
  "postponed",
  "rescheduled"
];
var NON_EXPLOITATION_STATUS_FILTER = `(${NON_EXPLOITATION_EVENT_DATE_STATUSES.join(",")})`;
var NON_AMORTIZABLE_EVENT_DATE_STATUSES = [...NON_EXPLOITATION_EVENT_DATE_STATUSES, "off"];
var NON_AMORTIZABLE_STATUS_FILTER = `(${NON_AMORTIZABLE_EVENT_DATE_STATUSES.join(",")})`;
function isAmortizableEventDateStatus(status) {
  return !NON_AMORTIZABLE_EVENT_DATE_STATUSES.includes(status ?? "");
}
function isCancelledEventDateStatus(status) {
  return status === "cancelled";
}
var DATE_STATUS_OPTIONS = COMMERCIAL_DATE_STATUS_OPTIONS.filter(
  (opt) => !LEGACY_OPTION_EVENT_DATE_STATUSES.includes(opt.value) && !isCancelledEventDateStatus(opt.value)
);
var KNOWN_EVENT_DATE_STATUSES = new Set(Object.keys(DATE_STATUS_CONFIG));

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/tourEconomics/amortization.ts
var FAMILIES = ["tour", "staff", "hotel"];
var zeroFamilies = () => ({ tour: 0, staff: 0, hotel: 0 });
function finite(value) {
  const n2 = Number(value);
  return Number.isFinite(n2) ? n2 : 0;
}
function validOverride(value) {
  if (value === null || value === void 0) return null;
  const n2 = Number(value);
  return Number.isFinite(n2) ? n2 : null;
}
function compute(costs, eventDates, forceExclude) {
  const dates = /* @__PURE__ */ new Map();
  for (const d of eventDates) if (!dates.has(d.id)) dates.set(d.id, d);
  const lines = costs.map((c) => ({ ...c, total: finite(c.total) }));
  const grandTotal = lines.reduce((s, l) => s + l.total, 0);
  const rawEventDateCount = dates.size;
  const legacyAllocation = grandTotal / Math.max(1, rawEventDateCount);
  const activeIds = [];
  const lockedDates = [];
  const excludedIds = [];
  for (const d of dates.values()) {
    if (forceExclude.has(d.id) || !isAmortizableEventDateStatus(d.status)) {
      excludedIds.push(d.id);
    } else if (d.financialClosedAt) {
      const override = validOverride(d.plateauOverride);
      const stored = validOverride(d.lockedAllocation);
      if (override !== null) lockedDates.push({ id: d.id, frozen: override, source: "override" });
      else if (stored !== null) lockedDates.push({ id: d.id, frozen: stored, source: "locked" });
      else lockedDates.push({ id: d.id, frozen: legacyAllocation, source: "closed_legacy" });
    } else {
      activeIds.push(d.id);
    }
  }
  const lockedIds = lockedDates.map((l) => l.id);
  const amortizableIds = [...activeIds, ...lockedIds];
  const amortizableSet = new Set(amortizableIds);
  const activeSet = new Set(activeIds);
  const eligibleOf = (appliesTo) => {
    if (!appliesTo || appliesTo.length === 0) return amortizableIds;
    return [...new Set(appliesTo)].filter((id) => amortizableSet.has(id));
  };
  const lineEligible = lines.map((l) => eligibleOf(l.appliesToDateIds));
  const weight = (lineIdx, dateId) => {
    const eligible = lineEligible[lineIdx];
    return eligible.length > 0 && eligible.includes(dateId) ? lines[lineIdx].total / eligible.length : 0;
  };
  const attributed = /* @__PURE__ */ new Map();
  const warnings = /* @__PURE__ */ new Set();
  for (const locked of lockedDates) {
    const weights = lines.map((_, i) => weight(i, locked.id));
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (totalWeight === 0) {
      attributed.set(locked.id, weights.map(() => 0));
      if (locked.frozen !== 0) warnings.add("locked_without_attributable_costs");
    } else {
      attributed.set(locked.id, weights.map((w) => locked.frozen * w / totalWeight));
    }
  }
  const shareByDate = /* @__PURE__ */ new Map();
  for (const id of activeIds) shareByDate.set(id, zeroFamilies());
  const allocatedToActiveByFamily = zeroFamilies();
  let remainingToAmortize = 0;
  let orphanTotal = 0;
  let overAbsorbed = 0;
  const residualLines = [];
  lines.forEach((line, i) => {
    const absorbedByLocked = lockedDates.reduce((s, l) => s + (attributed.get(l.id)?.[i] ?? 0), 0);
    let remaining = line.total - absorbedByLocked;
    if (line.total >= 0 && remaining < 0) {
      overAbsorbed += -remaining;
      remaining = 0;
    }
    remainingToAmortize += remaining;
    const targets = lineEligible[i].filter((id) => activeSet.has(id));
    if (targets.length === 0) {
      if (remaining !== 0) {
        orphanTotal += remaining;
        residualLines.push({ id: line.id, family: line.family, total: remaining });
      }
      return;
    }
    const share = remaining / targets.length;
    for (const id of targets) shareByDate.get(id)[line.family] += share;
    allocatedToActiveByFamily[line.family] += remaining;
  });
  if (residualLines.length > 0) warnings.add("orphan_cost_lines");
  if (overAbsorbed > 0) warnings.add("over_absorbed");
  const perDate = {};
  let discardedByOverride = 0;
  let overrideOnActive = 0;
  for (const d of dates.values()) {
    const override = validOverride(d.plateauOverride);
    const lockedInfo = lockedDates.find((l) => l.id === d.id);
    if (lockedInfo) {
      const byFamily = zeroFamilies();
      lines.forEach((line, i) => {
        byFamily[line.family] += attributed.get(d.id)?.[i] ?? 0;
      });
      perDate[d.id] = { source: lockedInfo.source, byFamily, total: lockedInfo.frozen };
    } else if (activeSet.has(d.id)) {
      const byFamily = shareByDate.get(d.id);
      const total = FAMILIES.reduce((s, f) => s + byFamily[f], 0);
      if (override !== null) {
        discardedByOverride += total;
        overrideOnActive += override;
        perDate[d.id] = { source: "override", byFamily: zeroFamilies(), total: override };
      } else {
        perDate[d.id] = { source: "active", byFamily: { ...byFamily }, total };
      }
    } else if (override !== null) {
      perDate[d.id] = { source: "override", byFamily: zeroFamilies(), total: override };
    } else {
      perDate[d.id] = { source: "excluded", byFamily: zeroFamilies(), total: 0 };
    }
  }
  const lockedAbsorbed = lockedDates.reduce((s, l) => s + l.frozen, 0);
  const allocatedToActive = remainingToAmortize - orphanTotal;
  const totalEconomicCost = lockedAbsorbed + allocatedToActive + orphanTotal;
  return {
    grandTotal,
    rawEventDateCount,
    amortizableDateCount: amortizableIds.length,
    activeDateCount: activeIds.length,
    lockedDateCount: lockedIds.length,
    excludedDateCount: excludedIds.length,
    lockedAbsorbed,
    remainingToAmortize,
    allocatedToActive,
    allocatedToActiveByFamily,
    discardedByOverride,
    averageAllocationPerActiveDate: activeIds.length > 0 ? allocatedToActive / activeIds.length : 0,
    residualTotal: orphanTotal,
    residualLines,
    orphanTotal,
    orphanLineIds: residualLines.map((l) => l.id),
    lockedHistoricalTotal: lockedAbsorbed,
    allocatedActiveTotal: allocatedToActive,
    totalEconomicCost,
    economicGap: totalEconomicCost - grandTotal,
    overrideAdjustment: overrideOnActive - discardedByOverride,
    overAbsorbed,
    warnings: [...warnings],
    perDate
  };
}
function computeTourEconomicAllocation(input) {
  return compute(input.costs, input.eventDates, /* @__PURE__ */ new Set());
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/tourEconomics/plateauView.ts
function familyTotal(lines, family) {
  return lines.filter((l) => l.family === family).reduce((s, l) => s + (Number(l.total) || 0), 0);
}
function zeroCost() {
  return {
    tourCostsAllocation: 0,
    hotelAllocation: 0,
    staffAllocation: 0,
    totalAllocation: 0,
    hotelsActualOnDate: 0,
    source: "project",
    hasOverride: false,
    overrideValue: null,
    allocationSource: "none"
  };
}
function resolvePlateauCosts({ tourId, tour, project }) {
  const tourAllocation = tourId ? computeTourEconomicAllocation({ costs: tour.lines, eventDates: tour.dates }) : null;
  const projectAllocation = computeTourEconomicAllocation({ costs: project.lines, eventDates: project.dates });
  const summaryScope = tourId && tourAllocation ? { allocation: tourAllocation, lines: tour.lines } : { allocation: projectAllocation, lines: project.lines };
  const a = summaryScope.allocation;
  const active = a.activeDateCount;
  const summary = {
    totalTourCosts: familyTotal(summaryScope.lines, "tour"),
    totalHotelsTour: familyTotal(summaryScope.lines, "hotel"),
    totalStaffTour: familyTotal(summaryScope.lines, "staff"),
    grandTotalTour: a.grandTotal,
    tourDateCount: a.amortizableDateCount,
    avgCostPerDate: a.averageAllocationPerActiveDate,
    hotelAllocationPerDate: active > 0 ? a.allocatedToActiveByFamily.hotel / active : 0,
    staffAllocationPerDate: active > 0 ? a.allocatedToActiveByFamily.staff / active : 0,
    rawEventDateCount: a.rawEventDateCount,
    activeDateCount: a.activeDateCount,
    lockedDateCount: a.lockedDateCount,
    lockedAbsorbed: a.lockedAbsorbed,
    remainingToAmortize: a.remainingToAmortize,
    residualTotal: a.residualTotal,
    totalEconomicCost: a.totalEconomicCost,
    orphanTotal: a.orphanTotal
  };
  const fromAllocation = (allocation, dateId, source, overrideValue) => {
    const entry = allocation.perDate[dateId];
    if (entry?.source === "override") {
      return { ...zeroCost(), tourCostsAllocation: entry.total, totalAllocation: entry.total, source: "date", hasOverride: true, overrideValue: overrideValue ?? entry.total, allocationSource: "override" };
    }
    if (entry) {
      const hotel2 = entry.byFamily.hotel;
      const staff2 = entry.byFamily.staff;
      return { ...zeroCost(), tourCostsAllocation: entry.total - hotel2 - staff2, hotelAllocation: hotel2, staffAllocation: staff2, totalAllocation: entry.total, source, allocationSource: entry.source };
    }
    const n2 = allocation.activeDateCount;
    if (n2 === 0) return { ...zeroCost(), source };
    const hotel = allocation.allocatedToActiveByFamily.hotel / n2;
    const staff = allocation.allocatedToActiveByFamily.staff / n2;
    const total = allocation.allocatedToActive / n2;
    return { ...zeroCost(), tourCostsAllocation: total - hotel - staff, hotelAllocation: hotel, staffAllocation: staff, totalAllocation: total, source, allocationSource: "active" };
  };
  const getPlateauCostForDate = (dateId) => {
    const scopedDates = tourId ? tour.dates : project.dates;
    const overridden = scopedDates.find((d) => d.id === dateId);
    const overrideValue = overridden?.plateauOverride;
    if (overrideValue !== null && overrideValue !== void 0 && Number.isFinite(Number(overrideValue))) {
      return { ...zeroCost(), tourCostsAllocation: Number(overrideValue), totalAllocation: Number(overrideValue), source: "date", hasOverride: true, overrideValue: Number(overrideValue), allocationSource: "override" };
    }
    if (tourId && tourAllocation && tour.dates.length > 0) return fromAllocation(tourAllocation, dateId, "tour", null);
    if (project.dates.length > 0) return fromAllocation(projectAllocation, dateId, "project", null);
    return zeroCost();
  };
  return { summary, getPlateauCostForDate, allocation: a };
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/tourEconomics/costLines.ts
function tourCostLineTotal(cost) {
  return (Number(cost.amount) || 0) * (Number(cost.quantity) || 1);
}
function toTourCostLines(costs) {
  return costs.map((c) => ({
    id: `tour:${c.id}`,
    family: "tour",
    total: tourCostLineTotal(c),
    appliesToDateIds: c.applies_to_date_ids ?? null
  }));
}
function toStaffCostLines(costs, totalOf) {
  return costs.map((c) => ({
    id: `staff:${c.id}`,
    family: "staff",
    total: totalOf(c),
    appliesToDateIds: c.applies_to_date_ids ?? null
  }));
}
function toHotelCostLines(totalTtc) {
  const total = Number(totalTtc) || 0;
  return total === 0 ? [] : [{ id: "hotels", family: "hotel", total, appliesToDateIds: null }];
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/domain/hotels/invoiceCalc.ts
function n(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
function resolveHotelCityTaxRate(details) {
  for (const key of ["city_tax_rate_pppn", "city_tax_per_person_per_night", "city_tax_rate"]) {
    if (details[key] !== void 0) return n(details[key]);
  }
  return null;
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/utils/hotelStatus.ts
var HOTEL_STATUS_CONFIG = {
  OPTION: {
    label: "Brouillon",
    className: "bg-muted text-muted-foreground"
  },
  CONFIRME: {
    label: "Sign\xE9",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  },
  PAYE: {
    label: "R\xE9gl\xE9",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
  },
  FACTURE: {
    label: "Factur\xE9",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  },
  mixed: {
    label: "Mixte",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  }
};
var LEGACY_STATUS_MAP = {
  draft: "OPTION",
  confirmed: "CONFIRME",
  invoiced: "FACTURE"
};
function normalizeStatus(status) {
  if (!status) return null;
  if (status in HOTEL_STATUS_CONFIG && status !== "mixed") {
    return status;
  }
  if (status in LEGACY_STATUS_MAP) {
    return LEGACY_STATUS_MAP[status];
  }
  return null;
}
function resolveEffectiveStatus(detailsStatus, stayStatus) {
  const normalized = normalizeStatus(detailsStatus);
  if (normalized) return normalized;
  const fallback = normalizeStatus(stayStatus);
  if (fallback) return fallback;
  return null;
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/src/utils/osm.ts
function extractCityName(cityValue) {
  if (!cityValue || typeof cityValue !== "string") return null;
  const trimmed = cityValue.trim();
  if (!trimmed) return null;
  const startsWithPostal = trimmed.match(/^(\d{5})\s*,?\s*(.+)$/);
  if (startsWithPostal) {
    return startsWithPostal[2].trim();
  }
  const endsWithPostal = trimmed.match(/^(.+?)\s*[,\s(]+\s*(\d{5})\s*\)?$/);
  if (endsWithPostal) {
    return endsWithPostal[1].trim();
  }
  const middlePostal = trimmed.match(/^(.+?)\s+\d{5}\s*$/);
  if (middlePostal) {
    return middlePostal[1].trim();
  }
  return trimmed;
}

// ../../../Users/arthurdubuc/Documents/GitHub/Bordero/borderoapp/bordero-mobile-canonical-entry.ts
function calculateTeamMemberCost(cost) {
  return (cost.total_employer_cost || 0) + (cost.per_diem_total || 0);
}
function calculateInvoiceTotals(input) {
  const { amount_ht, vat_applicable, vat_rate, cost_mode, dateCount } = input;
  const safeCount = Math.max(1, dateCount);
  let totalHT;
  let perDateHT;
  if (cost_mode === "GLOBAL_HT") {
    totalHT = amount_ht;
    perDateHT = totalHT / safeCount;
  } else {
    perDateHT = amount_ht;
    totalHT = perDateHT * safeCount;
  }
  const totalVAT = vat_applicable ? totalHT * vat_rate : 0;
  const totalTTC = totalHT + totalVAT;
  return { totalHT, totalVAT, totalTTC, perDateHT };
}
function computeStaffCostLineTotal(cost, rawDateCount) {
  if (cost.billing_mode === "INVOICE") {
    const totals = calculateInvoiceTotals({
      amount_ht: cost.amount_ht,
      vat_applicable: cost.vat_applicable,
      vat_rate: cost.vat_rate,
      cost_mode: cost.cost_mode,
      dateCount: rawDateCount
    });
    return totals.totalTTC + (cost.per_diem_total || 0);
  }
  if (cost.billing_mode === "PAYROLL") return calculateTeamMemberCost(cost);
  return 0;
}
function sanitizeRate(r) {
  const rate = r;
  if (!rate || typeof rate !== "object") {
    return { label: "", qty: 0, price_ht: 0, vat_rate: 0 };
  }
  return {
    label: String(rate.label ?? ""),
    qty: Number.isFinite(Number(rate.qty)) ? Number(rate.qty) : 0,
    price_ht: Number.isFinite(Number(rate.price_ht)) ? Number(rate.price_ht) : 0,
    vat_rate: Number.isFinite(Number(rate.vat_rate)) ? Number(rate.vat_rate) : 0
  };
}
function sanitizeRates(rates) {
  if (!Array.isArray(rates)) return [];
  return rates.map(sanitizeRate);
}
function convertRoadbookRatesToHotelRates(roomRates) {
  if (!Array.isArray(roomRates)) return [];
  return roomRates.map((r) => {
    const rate = r;
    if (!rate || typeof rate !== "object") {
      return { label: "", qty: 0, price_ht: 0, vat_rate: 0 };
    }
    const isComped = Boolean(rate.is_comped);
    if (isComped) {
      return {
        label: String(rate.room_type || rate.label || "Chambre"),
        qty: Number.isFinite(Number(rate.qty)) ? Number(rate.qty) : 0,
        price_ht: 0,
        vat_rate: 0
      };
    }
    if ("price_ht" in rate && !("price_ttc_per_room" in rate)) return sanitizeRate(rate);
    const priceTTC = Number.isFinite(Number(rate.price_ttc_per_room)) ? Number(rate.price_ttc_per_room) : 0;
    const vatPct = Number.isFinite(Number(rate.vat_rate)) ? Number(rate.vat_rate) : 0;
    const vatDecimal = vatPct / 100;
    const priceHT = vatDecimal > 0 ? priceTTC / (1 + vatDecimal) : priceTTC;
    return {
      label: String(rate.room_type || rate.label || "Chambre"),
      qty: Number.isFinite(Number(rate.qty)) ? Number(rate.qty) : 0,
      price_ht: priceHT,
      vat_rate: vatDecimal
      // Store as decimal (0.10 not 10)
    };
  });
}
function calculateNightTotals(rates, paxCount, cityTaxPppn) {
  const safeRates = sanitizeRates(rates);
  const paxNum = Number(paxCount);
  const cityTaxNum = Number(cityTaxPppn);
  const safePax = Number.isFinite(paxNum) ? paxNum : 0;
  const safeCityTax = Number.isFinite(cityTaxNum) ? cityTaxNum : 0;
  const room_ht = safeRates.reduce((sum, r) => sum + r.qty * r.price_ht, 0);
  const tva = safeRates.reduce((sum, r) => sum + r.qty * r.price_ht * r.vat_rate, 0);
  const city_tax = safePax * safeCityTax;
  const total_ttc = room_ht + tva + city_tax;
  return { room_ht, tva, city_tax, total_ttc };
}
function formatRatesBreakdown(rates) {
  const safeRates = sanitizeRates(rates);
  if (safeRates.length === 0) return "\u2014";
  const filtered = safeRates.filter((r) => r.qty > 0);
  if (filtered.length === 0) return "\u2014";
  return filtered.map((r) => `${r.qty}x ${r.label || "Chambre"} @ ${r.price_ht.toFixed(0)}\u20AC`).join(", ");
}
function calculateHotelRows(tourDays, hotelEntries, stayByEntryId) {
  return tourDays.map((td) => {
    const dayType = td.day_type;
    const dayEntries = hotelEntries.filter((e) => e.tour_day_id === td.id);
    const accommodations = dayEntries.map((entry) => {
      const entryType = entry.type === "tourbus" ? "tourbus" : "hotel";
      const details = entry.details || {};
      const stay = stayByEntryId.get(entry.id);
      if (entryType === "tourbus") {
        const roomingList = details.rooming_list || "";
        const pax = typeof roomingList === "string" && roomingList.trim() ? roomingList.split("\n").filter((line) => line.trim()).length : details.pax_count ?? details.occupants ?? null;
        return {
          entry_id: entry.id,
          type: entryType,
          name: entry.location_name || "Tourbus",
          pax_count: pax,
          rates: [],
          rooms_breakdown: "\u2014",
          rooms_count: 0,
          room_ht: 0,
          tva: 0,
          city_tax: 0,
          total_ttc: 0,
          status: null,
          stay_id: null,
          hotel_id: null
        };
      }
      const entryDetails = details;
      const linkedHotelId = entryDetails.hotel_id || null;
      const persistedRoomHt = entryDetails.room_ht;
      const persistedTva = entryDetails.tva;
      const persistedCityTax = entryDetails.city_tax;
      const persistedTotalTtc = entryDetails.total_ttc;
      const persistedRoomsCount = entryDetails.rooms_count ?? entryDetails.rooms;
      const hasPersisted = persistedTotalTtc !== void 0 && persistedTotalTtc !== null && Number.isFinite(Number(persistedTotalTtc)) || persistedRoomHt !== void 0 && persistedRoomHt !== null && Number.isFinite(Number(persistedRoomHt));
      let totals;
      let roomsCount;
      if (hasPersisted) {
        const roomHt = Number(persistedRoomHt);
        const tva = Number(persistedTva);
        const cityTax = Number(persistedCityTax);
        const totalTtc2 = Number(persistedTotalTtc);
        const rooms = Number(persistedRoomsCount);
        totals = {
          room_ht: Number.isFinite(roomHt) ? roomHt : 0,
          tva: Number.isFinite(tva) ? tva : 0,
          city_tax: Number.isFinite(cityTax) ? cityTax : 0,
          total_ttc: Number.isFinite(totalTtc2) ? totalTtc2 : 0
        };
        roomsCount = Number.isFinite(rooms) ? rooms : 0;
      } else {
        const roomRatesFromDetails = entryDetails.room_rates;
        const paxCount2 = entryDetails.occupants ?? entryDetails.pax_count ?? stay?.pax_count ?? 0;
        const cityTaxPppn = resolveHotelCityTaxRate(entryDetails) ?? stay?.city_tax_per_person_per_night ?? 0;
        const nights = Number(entryDetails.nights) || 1;
        if (Array.isArray(roomRatesFromDetails) && roomRatesFromDetails.length > 0) {
          const DEFAULT_VAT_RATE = 10;
          let roomTtc = 0;
          let tvaTotal = 0;
          let roomCount = 0;
          for (const r of roomRatesFromDetails) {
            const qty = Number(r.qty) || 0;
            const priceTtc = Number(r.price_ttc_per_room) || 0;
            const isComped = Boolean(r.is_comped);
            const vatPct = r.vat_rate == null ? DEFAULT_VAT_RATE : Number(r.vat_rate);
            roomCount += qty;
            if (!isComped && qty > 0 && priceTtc > 0) {
              const lineTotal = qty * priceTtc;
              const vatDecimal = vatPct / 100;
              const lineTva = lineTotal * vatDecimal / (1 + vatDecimal);
              roomTtc += lineTotal;
              tvaTotal += lineTva;
            }
          }
          const roomHt = roomTtc - tvaTotal;
          const cityTax = Number(paxCount2) * Number(cityTaxPppn) * nights;
          totals = {
            room_ht: Math.round(roomHt * 100) / 100,
            tva: Math.round(tvaTotal * 100) / 100,
            city_tax: Math.round(cityTax * 100) / 100,
            total_ttc: Math.round((roomTtc + cityTax) * 100) / 100
          };
          roomsCount = roomCount;
        } else {
          const rates2 = stay ? sanitizeRates(stay.rates) : [];
          totals = calculateNightTotals(rates2, paxCount2, cityTaxPppn);
          roomsCount = rates2.reduce((sum, r) => sum + r.qty, 0);
        }
      }
      const paxCount = details.occupants ?? details.pax_count ?? stay?.pax_count ?? null;
      const rates = Array.isArray(details.room_rates) ? convertRoadbookRatesToHotelRates(details.room_rates) : sanitizeRates(stay?.rates);
      const effectiveStatus = resolveEffectiveStatus(
        details.status,
        stay?.status
      );
      return {
        entry_id: entry.id,
        type: entryType,
        name: entry.location_name || stay?.hotel?.name || null,
        pax_count: paxCount,
        rates,
        rooms_breakdown: formatRatesBreakdown(rates),
        rooms_count: roomsCount,
        ...totals,
        status: effectiveStatus,
        stay_id: stay?.id || null,
        hotel_id: linkedHotelId || stay?.hotel_id || null
      };
    });
    const first = accommodations[0];
    const totalRoomHt = accommodations.reduce((sum, a) => sum + a.room_ht, 0);
    const totalTva = accommodations.reduce((sum, a) => sum + a.tva, 0);
    const totalCityTax = accommodations.reduce((sum, a) => sum + a.city_tax, 0);
    const totalTtc = accommodations.reduce((sum, a) => sum + a.total_ttc, 0);
    const totalPax = accommodations.reduce((sum, a) => sum + (a.pax_count || 0), 0);
    const totalRooms = accommodations.reduce((sum, a) => sum + a.rooms_count, 0);
    return {
      tour_day_id: td.id,
      night_date: td.date,
      day_type: dayType,
      city: extractCityName(td.city),
      // Backward compat: first accommodation data
      hotel_name: first?.name || null,
      hotel_id: first?.hotel_id || null,
      stay_id: first?.stay_id || null,
      pax_count: totalPax > 0 ? totalPax : null,
      rates: first?.rates || [],
      rooms_breakdown: first?.rooms_breakdown || "\u2014",
      rooms_count: totalRooms,
      room_ht: totalRoomHt,
      tva: totalTva,
      city_tax: totalCityTax,
      total_ttc: totalTtc,
      status: first?.status || null,
      // NEW: all accommodations for this day
      accommodations
    };
  });
}
export {
  calculateHotelRows,
  computeBordereauCalculations,
  computeStaffCostLineTotal,
  resolvePlateauCosts,
  toHotelCostLines,
  toStaffCostLines,
  toTourCostLines
};
