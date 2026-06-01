import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { providerMatchesQuery } from "../docs/search.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const providers = JSON.parse(await readFile(join(ROOT, "docs", "data", "providers.json"), "utf8"));

const scenarios = [
  { query: "ramallah pharmacy", min: 100, note: "English city + English type" },
  { query: "رام الله صيدلية", min: 100, note: "Arabic city + Arabic type" },
  { query: "nablus doctor", min: 300, note: "English city + English type" },
  { query: "نابلس طبيب", min: 300, note: "Arabic city + Arabic type" },
  { query: "دكتور نابلس اسنان", min: 50, note: "Colloquial Arabic doctor + city + specialty" },
  { query: "dentist hebron", min: 20, note: "English specialty + English city" },
  { query: "الخليل اسنان", min: 20, note: "Arabic city + normalized specialty" },
  { query: "heart ramallah", min: 20, note: "English specialty + English city" },
  { query: "قلب رام الله", min: 20, note: "Arabic specialty + Arabic city" },
  { query: "gaza pharmace", min: 50, note: "English city + typo alias for pharmacy" },
  { query: "غزه صيدلية", min: 50, note: "Arabic city + Arabic type" },
  { query: "خالد غزه", min: 1, note: "Arabic provider name + Arabic location" },
  { query: "خالد gaza", min: 1, note: "Arabic provider name + English location" },
  { query: "ramallah doctor heart", min: 20, note: "English city + type + specialty" },
  { query: "رام الله طبيب قلب", min: 20, note: "Arabic city + type + specialty" }
];

let failures = 0;

for (const scenario of scenarios) {
  const matches = providers.filter((provider) => providerMatchesQuery(provider, scenario.query));
  const status = matches.length >= scenario.min ? "PASS" : "FAIL";
  console.log(`${status} ${scenario.query}: ${matches.length} matches (${scenario.note})`);

  if (matches.length < scenario.min) {
    failures += 1;
    console.log(`  Expected at least ${scenario.min} matches.`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
