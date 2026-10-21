// Voegt de ontbrekende categorieën uit audit/category-compare.json toe aan de NL-producten (nooit iets weghalen),
// en zet de huidige hoofdcategorie als Yoast-primaire categorie (kruimelpad blijft gelijk).
// WCML neemt de categorieën bij het opslaan over in de EN-vertaling; het script controleert dat daarna.
// Backup van de oude categorieën in backups/.
//   node scripts/apply-categories.mjs [--dry]
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const DRY = process.argv.includes("--dry");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const rows = JSON.parse(await readFile(new URL("../audit/category-compare.json", import.meta.url), "utf8"));
const backup = [];
let ok = 0, enOk = 0, enChecked = 0;
for (const row of rows) {
  const p = await (await fetch(`${W}/wc/v3/products/${row.id}?lang=nl&_fields=id,name,categories,meta_data`, { headers: H })).json();
  const cur = p.categories.map((c) => c.id);
  const next = [...new Set([...cur, ...row.addIds])];
  const primary = (p.meta_data.find((m) => m.key === "_yoast_wpseo_primary_product_cat") || {}).value;
  backup.push({ id: row.id, categories: cur, primary: primary ?? null });
  if (DRY) { console.log(`${row.name}: ${cur.join(",")} → ${next.join(",")}${primary ? "" : ` (primair ${cur[0]})`}`); continue; }
  const body = { categories: next.map((id) => ({ id })) };
  if (!primary && cur[0]) body.meta_data = [{ key: "_yoast_wpseo_primary_product_cat", value: String(cur[0]) }];
  const r = await fetch(`${W}/wc/v3/products/${row.id}?lang=nl`, { method: "PUT", headers: H, body: JSON.stringify(body) });
  if (r.ok) ok++; else console.log(`✗ ${row.name}: ${r.status} ${(await r.text()).slice(0, 150)}`);
  // EN-vertaling: evenveel categorieën?
  const tr = await (await fetch(`${W}/c36/v1/translations?element_type=post_product&id=${row.id}`, { headers: H })).json();
  const enId = tr.translations?.en?.element_id;
  if (enId) {
    enChecked++;
    const en = await (await fetch(`${W}/wc/v3/products/${enId}?lang=en&_fields=categories`, { headers: H })).json();
    if (en.categories?.length === next.length) enOk++; else console.log(`  EN #${enId} (${row.name}): ${en.categories?.length} i.p.v. ${next.length} categorieën`);
  }
}
if (!DRY) await writeFile(new URL(`../backups/product-categories-${Date.now()}.json`, import.meta.url), JSON.stringify(backup, null, 2));
console.log(DRY ? `${rows.length} producten (dry run)` : `${ok}/${rows.length} NL-producten bijgewerkt | EN gelijk: ${enOk}/${enChecked}`);
