// Vergelijkt de categorie-indeling van producten op de oude site met WooCommerce.
// Oude site: per categoriepagina (audit/old-categories.json → oldUrl) de productlinks /nl/shop/<oud-id>/ verzamelen.
// Nieuw: categorieën per product (NL) uit WooCommerce. Een categorie telt als "aanwezig" als het product erin staat
// of in een subcategorie ervan (WooCommerce toont producten uit subcategorieën ook op de bovenliggende pagina).
// Uitvoer: audit/category-compare.json + .csv met per product de ontbrekende (meest specifieke) categorieën.
//   node scripts/compare-categories.mjs
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const W = cfg.wp.baseUrl + "/wp-json/wc/v3";
const P = (p) => new URL("../" + p, import.meta.url);
const oldCats = JSON.parse(await readFile(P("audit/old-categories.json"), "utf8"));
const products = JSON.parse(await readFile(P("audit/products.json"), "utf8"));
const newByOld = {};
for (const p of products) { const m = (p.oldPath || "").match(/\/nl\/shop\/(\d+)\//); if (m) newByOld[m[1]] = p.id; }

// Categorieboom (NL)
const cats = {};
for (let page = 1; ; page++) {
  const r = await (await fetch(`${W}/products/categories?per_page=100&page=${page}&lang=nl`, { headers: H })).json();
  if (!r.length) break;
  for (const c of r) cats[c.id] = { id: c.id, name: c.name, parent: c.parent };
}
const ancestors = (id) => { const out = []; let c = cats[id]; while (c && c.parent) { out.push(c.parent); c = cats[c.parent]; } return out; };
const path = (id) => [...ancestors(id).reverse(), id].map((x) => cats[x]?.name || x).join(" › ");

// Oude site: categorie → producten
const oldMembership = {}; // nieuw product-id → Set(nieuwe categorie-id's volgens oude site)
const unknownOld = new Set();
for (const [catId, c] of Object.entries(oldCats)) {
  const html = await (await fetch(c.oldUrl, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const ids = [...new Set([...html.matchAll(/href="\/nl\/shop\/(\d+)\//g)].map((m) => m[1]))];
  for (const oid of ids) {
    const pid = newByOld[oid];
    if (!pid) { unknownOld.add(oid); continue; }
    (oldMembership[pid] ||= new Set()).add(+catId);
  }
  console.log(`${path(+catId).padEnd(60)} ${ids.length} producten`);
}

// Nieuw: categorieën per product
const current = {}, names = {};
for (let page = 1; ; page++) {
  const r = await (await fetch(`${W}/products?per_page=100&page=${page}&lang=nl&status=any&_fields=id,name,categories,status`, { headers: H })).json();
  if (!r.length) break;
  for (const p of r) { current[p.id] = p.categories.map((c) => c.id); names[p.id] = p.name; }
}

const rows = [];
for (const [pid, oldSet] of Object.entries(oldMembership)) {
  const cur = current[pid] || [];
  const covered = new Set(cur.flatMap((c) => [c, ...ancestors(c)]));
  let missing = [...oldSet].filter((c) => !covered.has(c));
  // Alleen de meest specifieke: laat een ontbrekende categorie weg als een ontbrekende subcategorie hem al dekt.
  missing = missing.filter((c) => !missing.some((m) => m !== c && ancestors(m).includes(c)));
  if (missing.length) rows.push({ id: +pid, name: names[pid], now: cur.map(path), add: missing.map(path), addIds: missing });
}
rows.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(P("audit/category-compare.json"), JSON.stringify(rows, null, 2));
await writeFile(P("audit/category-compare.csv"), "﻿" + ["product_id;product;nu in;toevoegen", ...rows.map((r) => [r.id, r.name, r.now.join(" | "), r.add.join(" | ")].join(";"))].join("\n"));
console.log(`\n${rows.length} producten missen categorieën t.o.v. de oude site (${Object.keys(oldMembership).length} vergeleken; ${unknownOld.size} oude productlinks zonder nieuw product)`);
