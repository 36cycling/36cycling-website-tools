// Volgorde van de producten in de winkel (WooCommerce "Standaard sortering" = menu_order), NL + EN gelijk.
// Groepen: shirts → broeken → jacks → overige kleding → accessoires → sokken; binnen een groep op populariteit
// (aantal verkocht, incl. de geïmporteerde Umbraco-bestellingen), daarna nieuwste eerst. Stappen van 10, zodat je in
// WooCommerce → Producten → Sorteren nog met de hand kunt schuiven. Opnieuw draaien zet alles weer volgens deze regels.
//   node scripts/sort-products.mjs            → proef (toont de volgorde)
//   node scripts/sort-products.mjs --apply    → doorvoeren
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const get = (p) => fetch(W + p, { headers: H }).then((r) => r.json());

const GROUPS = ["Shirts", "Broeken", "Jacks", "Overige kleding", "Accessoires", "Sokken"];
const has = (p, re) => p.categories.some((c) => re.test(c.slug));
function group(p) {
  const n = p.name;
  if (/\bsok/i.test(n) || has(p, /sokken/)) return 5;
  if (has(p, /accessoires|handschoenen|petten|brillen|overschoenen|arm-en-been|tassen/) || /handschoen|overschoen|teenwarmer|muts|bril|hoes/i.test(n)) return 4;
  if (has(p, /onderkleding|sportkleding/) || /t-shirt|hoodie|ondershirt/i.test(n)) return 3;
  if (/jack|windstopper/i.test(n)) return 2;
  if (has(p, /fietsshirts/) || /wielershirt|fietsshirt|jersey/i.test(n)) return 0;
  if (has(p, /fietsbroeken/) || /broek|short/i.test(n)) return 1;
  if (has(p, /fietsjacks/)) return 2;
  return 3;
}

const nl = [];
for (let page = 1; ; page++) {
  const j = await get(`/wc/v3/products?per_page=100&page=${page}&lang=nl&status=any`);
  if (!j.length) break;
  nl.push(...j);
}
nl.sort((a, b) => group(a) - group(b) || b.total_sales - a.total_sales || b.date_created.localeCompare(a.date_created));
const plan = nl.map((p, i) => ({ id: p.id, name: p.name, group: GROUPS[group(p)], status: p.status, stock: p.stock_status, sales: p.total_sales, from: p.menu_order, to: (i + 1) * 10 }));

for (const g of GROUPS) {
  const items = plan.filter((x) => x.group === g && x.status === "publish" && x.stock === "instock");
  console.log(`\n${g} (${items.length} in de winkel): ` + items.slice(0, 8).map((x) => `${x.name} (${x.sales})`).join(" · ") + (items.length > 8 ? " …" : ""));
}
if (!APPLY) { console.log("\nProef. Doorvoeren met --apply."); process.exit(0); }

let ok = 0;
for (const x of plan) {
  const tr = await get(`/c36/v1/translations?element_type=post_product&id=${x.id}`);
  const en = tr.translations?.en?.element_id || tr.translations?.en?.id;
  const ids = [x.id, en].filter(Boolean);
  for (const id of ids) {
    const r = await fetch(`${W}/wc/v3/products/${id}`, { method: "PUT", headers: H, body: JSON.stringify({ menu_order: x.to }) });
    if (!r.ok) console.log(`  ✗ ${x.name} (${id}): ${r.status}`);
  }
  if (!en) console.log(`  ! geen EN-vertaling: ${x.name}`);
  ok++;
}
await writeFile(new URL("../reports/sort-products-plan.json", import.meta.url), JSON.stringify(plan, null, 2));
console.log(`\nKlaar: ${ok} producten (NL + EN).`);
