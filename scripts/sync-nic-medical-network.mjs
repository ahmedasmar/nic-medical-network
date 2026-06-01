import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINT = "https://www.nic-pal.com/platform/ajax/medical-network/get-data";
const PER_PAGE = Number(process.env.NIC_PER_PAGE || 100);
const CONCURRENCY = Number(process.env.NIC_SYNC_CONCURRENCY || 4);
const ROOT = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(ROOT, "..");
const DATA_DIR = join(PROJECT_ROOT, "docs", "data");

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&laquo;/g, "<<")
    .replace(/&raquo;/g, ">>")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)));
}

function stripTags(html) {
  return decodeHtml(String(html).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractTel(html) {
  const matches = [...String(html).matchAll(/href=["']tel:([^"']+)["']/gi)]
    .map((match) => decodeHtml(match[1]).trim())
    .filter(Boolean);

  if (matches.length > 0) {
    return matches.join(", ");
  }

  const text = stripTags(html);
  return text === "-" ? "" : text;
}

function parseRows(tableHtml) {
  const rows = [...String(tableHtml).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const providers = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length < 7) {
      continue;
    }

    providers.push({
      city: stripTags(cells[0]),
      name: stripTags(cells[1]),
      careType: stripTags(cells[2]),
      specialty: stripTags(cells[3]),
      location: stripTags(cells[4]),
      workPhone: extractTel(cells[5]),
      mobile: extractTel(cells[6])
    });
  }

  return providers;
}

function dedupeProviders(providers) {
  const seen = new Map();

  for (const provider of providers) {
    const key = [
      provider.city,
      provider.name,
      provider.careType,
      provider.specialty,
      provider.location,
      provider.workPhone,
      provider.mobile
    ].join("|");

    seen.set(key, provider);
  }

  return [...seen.values()];
}

function buildFacet(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
}

async function fetchPage(page) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(PER_PAGE));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "nic-medical-network-sync/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`NIC endpoint returned ${response.status} for page ${page}`);
  }

  const payload = await response.json();
  if (!payload.status) {
    throw new Error(`NIC endpoint returned an unsuccessful payload for page ${page}`);
  }

  return payload;
}

async function mapWithConcurrency(items, limit, task) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await task(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const firstPage = await fetchPage(1);
  const pageNumbers = [];
  for (let page = 2; page <= firstPage.last_page; page += 1) {
    pageNumbers.push(page);
  }

  console.log(`NIC reports ${firstPage.total_count} providers across ${firstPage.last_page} pages.`);

  const remainingPages = await mapWithConcurrency(pageNumbers, CONCURRENCY, async (page) => {
    const payload = await fetchPage(page);
    process.stdout.write(".");
    return payload;
  });
  process.stdout.write("\n");

  const providers = dedupeProviders(
    [firstPage, ...remainingPages].flatMap((page) => parseRows(page.data_table))
  );

  const metadata = {
    sourceName: "National Insurance Company Palestine medical network",
    sourceUrl: "https://www.nic-pal.com/medical-network",
    endpointUrl: ENDPOINT,
    syncedAt: new Date().toISOString(),
    reportedTotal: firstPage.total_count,
    providerCount: providers.length,
    perPage: firstPage.per_page,
    lastPage: firstPage.last_page,
    facets: {
      cities: buildFacet(providers.map((provider) => provider.city)),
      careTypes: buildFacet(providers.map((provider) => provider.careType)),
      specialties: buildFacet(providers.map((provider) => provider.specialty))
    }
  };

  await writeFile(join(DATA_DIR, "providers.json"), `${JSON.stringify(providers, null, 2)}\n`);
  await writeFile(join(DATA_DIR, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(`Wrote ${providers.length} providers to docs/data/providers.json.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

