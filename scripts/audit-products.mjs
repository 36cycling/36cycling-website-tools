// Audit WooCommerce-producten: alt-teksten, SEO-titel/meta, H1, og:image, beschrijving,
// structured data — en vergelijking met de oude Umbraco-productpagina (zelfde slug).
// Gebruik: node scripts/audit-products.mjs → audit/products.json + audit/products.csv
import { load } from "cheerio";
import { loadConfig } from "../lib/wp.mjs";
import { readFile, writeFile } from "node:fs/promises";

const cfg = await loadConfig();
const H = { headers: { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") } };
const B = cfg.wp.baseUrl + "/wp-json/wc/v3";
const root = new URL("..", import.meta.url);
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const words = (html) => norm(load(`<div>${html || ""}</div>`)("div").text()).split(" ").filter(Boolean).length;
async function pool(items, n, fn) { const r = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; r[k] = await fn(items[k]); } })); return r; }

// Producten ophalen
let prods = [];
for (let p = 1; p < 10; p++) {
  const r = await fetch(`${B}/products?per_page=100&page=${p}&status=any`, H);
  const j = await r.json(); if (!Array.isArray(j) || !j.length) break; prods.push(...j);
}
// Varianten: tellen hoeveel er een eigen afbeelding zonder alt hebben
const oldMap = JSON.parse(await readFile(new URL("audit/shop-urls.json", root), "utf8")).oldShop
  .filter((p) => /^\/nl\/shop\/\d+\/.+/.test(p)).reduce((m, p) => (m[p.split("/").filter(Boolean).pop()] = p, m), {});

const page = async (url) => {
  try { const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (audit)" } }); return r.ok ? await r.text() : null; } catch { return null; }
};
const parse = (html, site) => {
  const $ = load(html);
  const meta = (n) => norm($(`meta[name="${n}"]`).attr("content"));
  const o = {
    title: norm($("title").first().text()), metaDesc: meta("description"),
    ogImage: norm($('meta[property="og:image"]').attr("content")),
    h1: $("h1").map((_, e) => norm($(e).text())).get(),
    schemaProduct: $('script[type="application/ld+json"]').toArray().some((e) => /"@type"\s*:\s*"Product"|"Product"/.test($(e).html() || "")),
  };
  const scope = site === "old" ? $("body") : $(".product, main").first();
  const imgs = scope.find("img").filter((_, e) => !/logo|icon|loading|close\.gif|shopping|payment|flag/i.test($(e).attr("src") || $(e).attr("data-src") || ""));
  o.imgs = imgs.length;
  o.imgNoAlt = imgs.filter((_, e) => !norm($(e).attr("alt"))).length;
  o.imgAlts = imgs.map((_, e) => norm($(e).attr("alt"))).get().filter(Boolean).slice(0, 3);
  return o;
};

console.log(`Producten: ${prods.length} — pagina's ophalen…`);
const rows = await pool(prods, 8, async (p) => {
  const yoast = Object.fromEntries((p.meta_data || []).filter((m) => /^_yoast_wpseo_(title|metadesc|focuskw)$/.test(m.key)).map((m) => [m.key.replace("_yoast_wpseo_", ""), m.value]));
  const gallery = p.images || [];
  const r = {
    id: p.id, name: p.name, slug: p.slug, status: p.status, type: p.type,
    yoastTitle: yoast.title || "", yoastMeta: yoast.metadesc || "",
    descWords: words(p.description), shortWords: words(p.short_description),
    galleryImgs: gallery.length, galleryNoAlt: gallery.filter((i) => !norm(i.alt)).length,
    cats: (p.categories || []).map((c) => c.name).join(", "),
  };
  if (p.status === "publish") {
    const h = await page(p.permalink + (p.permalink.includes("?") ? "&" : "?") + "nc=" + Date.now());
    if (h) Object.assign(r, Object.fromEntries(Object.entries(parse(h, "new")).map(([k, v]) => ["new_" + k, v])));
  }
  const oldPath = oldMap[p.slug];
  r.oldPath = oldPath || "";
  if (oldPath) {
    const h = await page("https://www.36cycling.com" + oldPath);
    if (h) {
      const o = parse(h, "old"); const $ = load(h);
      Object.assign(r, Object.fromEntries(Object.entries(o).map(([k, v]) => ["old_" + k, v])));
      $("header,footer,script,style,nav,form").remove();
    }
  }
  return r;
});

await writeFile(new URL("audit/products.json", root), JSON.stringify(rows, null, 2));
const cols = ["id", "status", "name", "cats", "galleryImgs", "galleryNoAlt", "descWords", "shortWords", "yoastTitle", "new_title", "old_title", "yoastMeta", "new_metaDesc", "old_metaDesc", "new_h1", "new_ogImage", "new_schemaProduct", "oldPath"];
const esc = (v) => `"${String(Array.isArray(v) ? v.join(" / ") : v ?? "").replace(/"/g, '""')}"`;
await writeFile(new URL("audit/products.csv", root), "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n"));
console.log("Klaar → audit/products.json + audit/products.csv");
