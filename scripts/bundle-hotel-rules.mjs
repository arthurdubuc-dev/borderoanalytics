import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = process.env.BORDERO_WEB_ROOT ?? path.resolve("../../borderoapp");
const out = "src/canonical/hotels";
await mkdir(out, { recursive: true });
const sources = [];
for (const [name, source] of [
  ["hotelPaymentPlan", "src/lib/hotelPayments/hotelPaymentPlan.ts"],
  [
    "settlementJustification",
    "src/lib/hotelPayments/settlementJustification.ts",
  ],
  ["invoiceCalc", "src/domain/hotels/invoiceCalc.ts"],
]) {
  const content = await readFile(path.join(root, source), "utf8");
  const sha256 = createHash("sha256").update(content).digest("hex");
  await writeFile(
    `${out}/${name}.ts`,
    `// Generated from Bordero Web (trailing whitespace normalized) ${source}. Do not edit formulas here.\n// SHA256 ${sha256}\n${content.replace(/[ \t]+$/gm, "")}`,
  );
  sources.push({ path: source, sha256 });
}
await writeFile(`${out}/sources.json`, JSON.stringify(sources, null, 2) + "\n");
