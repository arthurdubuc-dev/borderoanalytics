import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.env.BORDERO_WEB_ROOT ?? path.resolve("../../borderoapp");
const { build } = await import(
  path.join(root, "node_modules/esbuild/lib/main.js")
);
const provenance = [];
async function source(relative) {
  const text = await readFile(path.join(root, relative), "utf8");
  provenance.push({
    path: relative,
    sha256: createHash("sha256").update(text).digest("hex"),
  });
  return ts.createSourceFile(
    relative,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}
function fn(sf, name) {
  const node = sf.statements.find(
    (s) => ts.isFunctionDeclaration(s) && s.name?.text === name,
  );
  if (!node) throw new Error("Missing owning function " + name);
  return node.getText(sf).replace(/^export /, "");
}
const staff = await source("src/hooks/useStaffCosts.ts"),
  hotels = await source("src/hooks/useProjectHotels.ts");
let hotelBody;
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(hotels) === "nightRows"
  ) {
    hotelBody = node.initializer.arguments[0].body.getText(hotels);
  }
  ts.forEachChild(node, visit);
}
visit(hotels);
if (!hotelBody) throw new Error("Hotel projection not found");
const imp = (name, file) =>
  `import {${name}} from ${JSON.stringify(path.join(root, file))};`;
const entry = [
  imp(
    "computeBordereauCalculations",
    "src/domain/finance/canonical/adapters/bordereauCalculationsService.ts",
  ),
  imp("resolvePlateauCosts", "src/domain/tourEconomics/plateauView.ts"),
  imp(
    "toTourCostLines, toStaffCostLines, toHotelCostLines",
    "src/domain/tourEconomics/costLines.ts",
  ),
  imp("resolveHotelCityTaxRate", "src/domain/hotels/invoiceCalc.ts"),
  imp("resolveEffectiveStatus", "src/utils/hotelStatus.ts"),
  imp("extractCityName", "src/utils/osm.ts"),
  ...[
    "calculateTeamMemberCost",
    "calculateInvoiceTotals",
    "computeStaffCostLineTotal",
  ].map((n) => fn(staff, n)),
  ...[
    "sanitizeRate",
    "sanitizeRates",
    "convertRoadbookRatesToHotelRates",
    "calculateNightTotals",
    "formatRatesBreakdown",
  ].map((n) => fn(hotels, n)),
  `function calculateHotelRows(tourDays:any[],hotelEntries:any[],stayByEntryId:Map<string,any>) ${hotelBody}`,
  "export {computeBordereauCalculations,resolvePlateauCosts,toTourCostLines,toStaffCostLines,toHotelCostLines,computeStaffCostLineTotal,calculateHotelRows};",
].join("\n");
const out = "supabase/functions/mobile-dashboard/canonical.mjs";
await mkdir(path.dirname(out), { recursive: true });
const result = await build({
  stdin: {
    contents: entry,
    resolveDir: root,
    sourcefile: "bordero-mobile-canonical-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  alias: { "@": path.join(root, "src") },
  write: false,
  metafile: true,
  drop: ["console"],
  legalComments: "none",
});
await writeFile(
  out,
  "// Generated from Bordero Web. Do not edit formulas here. See scripts/bundle-canonical.mjs.\n" +
    result.outputFiles[0].text,
);
for (const file of Object.keys(result.metafile.inputs)) {
  if (file.endsWith("bordero-mobile-canonical-entry.ts")) continue;
  try {
    const content = await readFile(file, "utf8");
    provenance.push({
      path: path.relative(root, file),
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  } catch {}
}
await writeFile(
  "supabase/functions/mobile-dashboard/canonical-sources.json",
  JSON.stringify(
    { generatedAt: new Date().toISOString(), sources: provenance },
    null,
    2,
  ) + "\n",
);
console.log(
  "Canonical Web services bundled; no React or database credentials.",
);
