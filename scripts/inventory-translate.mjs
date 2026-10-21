// Inventaris voor de Engelse vertaling: alle NL-content op de nieuwe site + de Engelse URL die de oude site
// (via <link hreflang="en">) bij hetzelfde pad gebruikte. Uitvoer: audit/translate-inventory.csv/json
import { load } from "cheerio";
import { loadConfig } from "../lib/wp.mjs";
import { writeFile } from "node:fs/promises";

const cfg = await loadConfig();
const H = { headers: { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") } };
const W = cfg.wp.baseUrl + "/wp-json";
const words = (html) => load(`<div>${html || ""}</div>`)("div").text().split(/\s+/).filter(Boolean).length;
async function all(path) { const out = []; for (let p = 1; p < 30; p++) { const r = await fetch(`${W}${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${p}`, H); if (!r.ok) break; const j = await r.json(); if (!j.length) break; out.push(...j); } return out; }
async function pool(items, n, fn) { const r = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; r[k] = await fn(items[k]); } })); return r; }
const oldEn = async (path) => {
  try { const r = await fetch("https://www.36cycling.com" + path); if (!r.ok) return ""; const $ = load(await r.text());
    const en = $('link[hreflang="en"]').attr("href") || ""; return en.replace(/^https?:\/\/(www\.)?36cycling\.com/, ""); } catch { return ""; }
};

const rows = [];
for (const [type, path] of [["page", "/wp/v2/pages?status=publish,draft,private&context=edit&lang=nl"], ["post", "/wp/v2/posts?status=publish,draft,private&context=edit&lang=nl"]]) {
  for (const p of await all(path)) rows.push({ type, id: p.id, status: p.status, title: p.title.raw, path: new URL(p.link).pathname.includes("?") ? "" : new URL(p.link).pathname, words: words(p.content.raw) });
}
const prods = await all("/wc/v3/products?status=any&lang=nl");
for (const p of prods) rows.push({ type: "product", id: p.id, status: p.status, title: p.name, path: p.status === "publish" ? new URL(p.permalink).pathname : "", words: words(p.description) + words(p.short_description) });
for (const c of await all("/wc/v3/products/categories?lang=nl")) rows.push({ type: "product_cat", id: c.id, status: "", title: c.name, path: "", words: words(c.description) });
for (const c of await all("/wp/v2/categories?lang=nl")) rows.push({ type: "category", id: c.id, status: "", title: c.name, path: new URL(c.link).pathname, words: words(c.description) });

await pool(rows.filter((r) => r.path && /^(page|post)$/.test(r.type)), 6, async (r) => { r.oldEn = await oldEn(r.path); });
await writeFile(new URL("../audit/translate-inventory.json", import.meta.url), JSON.stringify(rows, null, 2));
const cols = ["type", "id", "status", "title", "path", "words", "oldEn"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
await writeFile(new URL("../audit/translate-inventory.csv", import.meta.url), "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n"));

const sum = {}; for (const r of rows) { const k = r.type + (r.status ? ":" + r.status : ""); sum[k] ??= { n: 0, words: 0 }; sum[k].n++; sum[k].words += r.words; }
console.table(sum);
const pp = rows.filter((r) => /^(page|post)$/.test(r.type) && r.status === "publish");
console.log(`Gepubliceerde pagina's/berichten: ${pp.length}, met oude Engelse URL: ${pp.filter((r) => r.oldEn).length}`);
for (const r of pp) console.log(r.type.padEnd(5), r.path.padEnd(70), r.oldEn || "—");
