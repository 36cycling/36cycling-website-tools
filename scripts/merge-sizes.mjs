// Eenmalig (21 okt 2026): maatnotatie gelijktrekken in het kenmerk Maat (pa_maat): XXL → 2XL, XXXL → 3XL.
// Past per Nederlands product de maatlijst en de variaties aan; WCML neemt het over in de Engelse vertaling.
// SKU's blijven ongewijzigd (koppeling voorraad/feed loopt via id's). Oude waarden eerst naar backups/.
//   node scripts/merge-sizes.mjs            → proef
//   node scripts/merge-sizes.mjs --apply    → doorvoeren
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const MAP = { XXL: "2XL", XXXL: "3XL" };
const ATTR = 3; // pa_maat
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const B = cfg.wp.baseUrl + "/wp-json/wc/v3";
const get = async (u) => (await fetch(B + u, { headers: H })).json();

const products = [];
for (let page = 1; ; page++) {
  const j = await get(`/products?per_page=100&page=${page}&lang=nl&status=any&type=variable`);
  if (!j.length) break;
  products.push(...j);
}
const todo = products.filter((p) => p.attributes.some((a) => a.id === ATTR && a.options.some((o) => MAP[o])));
const backup = [];
let ok = 0;
for (const p of todo) {
  const vars = await get(`/products/${p.id}/variations?per_page=100`);
  const attr = p.attributes.find((a) => a.id === ATTR);
  const clash = attr.options.filter((o) => MAP[o] && attr.options.includes(MAP[o]));
  if (clash.length) { console.log(`  ! ${p.name}: heeft zowel ${clash.join("/")} als ${clash.map((c) => MAP[c]).join("/")}, overgeslagen`); continue; }
  const changeVars = vars.filter((v) => v.attributes.some((a) => a.id === ATTR && MAP[a.option]));
  console.log(`${p.name}: ${attr.options.join(", ")} → ${attr.options.map((o) => MAP[o] || o).join(", ")} (${changeVars.length} variaties)`);
  backup.push({ product: p.id, attributes: p.attributes, variations: changeVars.map((v) => ({ id: v.id, attributes: v.attributes })) });
  if (!APPLY) continue;
  const attributes = p.attributes.map((a) => a.id === ATTR ? { ...a, options: a.options.map((o) => MAP[o] || o) } : a);
  const r1 = await fetch(`${B}/products/${p.id}/variations/batch`, { method: "POST", headers: H, body: JSON.stringify({
    update: changeVars.map((v) => ({ id: v.id, attributes: v.attributes.map((a) => a.id === ATTR ? { id: a.id, option: MAP[a.option] || a.option } : { id: a.id, name: a.name, option: a.option }) })),
  }) });
  const j1 = await r1.json();
  const errs = (j1.update || []).filter((u) => u.error);
  // Product als laatste opslaan: WCML synchroniseert dan de variaties naar de Engelse vertaling.
  const r2 = await fetch(`${B}/products/${p.id}`, { method: "PUT", headers: H, body: JSON.stringify({ attributes }) });
  if (r2.ok && !errs.length) ok++; else console.log(`  ✗ ${p.name}: ${r2.status} ${errs.map((e) => e.error.message).join("; ")}`);
}
if (APPLY) {
  await writeFile(new URL(`../backups/sizes-before-merge-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url), JSON.stringify(backup, null, 2));
  console.log(`Klaar: ${ok} van ${todo.length} producten.`);
} else console.log(`Proef: ${todo.length} producten. Doorvoeren met --apply.`);
