// Zet " | 36 Cycling" achter de Yoast-titel van producten die geen merknaam hebben (20 nov 2026, akkoord Jeroen).
// Titels met "36" erin, lege titels (Yoast-sjabloon) en titels die met de toevoeging langer dan 65 tekens worden, blijven ongemoeid.
//   node scripts/product-seo-merknaam.mjs --lang=nl [--dry]
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const DRY = process.argv.includes("--dry");
const lang = (process.argv.find((a) => a.startsWith("--lang=")) || "--lang=nl").slice(7);
const SUFFIX = " | 36 Cycling", MAX = 65;
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json";
const call = async (m, p, b) => { const r = await fetch(W + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${JSON.stringify(j).slice(0, 300)}`); return j; };

let all = [];
for (let page = 1; ; page++) {
  const r = await call("GET", `/wc/v3/products?lang=${lang}&status=publish&per_page=100&page=${page}&_fields=id,name,meta_data`);
  all = all.concat(r);
  if (r.length < 100) break;
}
const rows = all.map((p) => ({ id: p.id, name: p.name, title: (p.meta_data || []).find((m) => m.key === "_yoast_wpseo_title")?.value || "" }));
const todo = rows.filter((x) => x.title && !/36/.test(x.title) && (x.title + SUFFIX).length <= MAX);
const skipped = rows.filter((x) => x.title && !/36/.test(x.title) && (x.title + SUFFIX).length > MAX);
console.log(`${lang}: ${rows.length} producten, ${todo.length} aanpassen, ${skipped.length} te lang:`, skipped.map((x) => x.title));
if (DRY) { console.log(todo.slice(0, 5).map((x) => x.title + SUFFIX)); process.exit(0); }

await writeFile(new URL(`../backups/product-seo-titles-${lang}-before-2026-11-20.json`, import.meta.url), JSON.stringify(rows, null, 1));
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50);
  const r = await call("POST", `/wc/v3/products/batch?lang=${lang}`, { update: chunk.map((x) => ({ id: x.id, meta_data: [{ key: "_yoast_wpseo_title", value: x.title + SUFFIX }] })) });
  const errs = (r.update || []).filter((u) => u.error);
  console.log(`batch ${i / 50 + 1}: ${chunk.length} bijgewerkt, ${errs.length} fouten`, errs.slice(0, 3).map((e) => JSON.stringify(e.error)));
}
