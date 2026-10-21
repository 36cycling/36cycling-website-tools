// Kortingsprijzen overnemen van de oude Umbraco-shop. De oude feed bevat alleen kortingen in euro's (en dan als
// kortingsBEDRAG), geen procentuele kortingen; daarom lezen we per product de knop "In winkelwagen" op de oude
// productpagina: data-orgprice (normaal), data-price (nu), data-discountperc / data-discount.
// De kortingsprijs wordt per variatie berekend op de normale prijs van die variatie (dus ook goed bij toeslagen,
// zoals "3 paar"), met dezelfde afronding als de oude site.
// Alleen zolang www.36cycling.com nog de oude Umbraco-site is.
//   node scripts/price-sync.mjs            → proef: toont alle verschillen
//   node scripts/price-sync.mjs --apply    → kortingsprijzen bijwerken (oude waarden eerst naar backups/)
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const OLD = "https://www.36cycling.com";
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const B = cfg.wp.baseUrl + "/wp-json/wc/v3";
const UA = { "User-Agent": "Mozilla/5.0 (36cycling price-sync)" };

// 1. Oude productpagina's (één per product) via de oude feed
const xml = await (await fetch(`${OLD}/umbraco/api/site/getFacebookFeed`, { headers: UA })).text();
const pages = new Map();
for (const it of xml.split("<item>").slice(1)) {
  const link = it.slice(it.indexOf("<g:link>") + 8, it.indexOf("</g:link>"));
  const m = link.match(/^https:..www.36cycling.com.nl.shop.([0-9]+)./);
  if (!m) { console.log("Dit is niet de oude Umbraco-feed; na de domeinwissel kan dit script niet meer."); process.exit(1); }
  if (!pages.has(m[1])) pages.set(m[1], link);
}
const old = new Map();
const queue = [...pages.entries()];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const [grp, link] = queue.shift();
    const r = await fetch(link, { headers: UA, redirect: "manual" });
    if (r.status !== 200) continue; // niet zichtbaar op de oude site
    const btn = (await r.text()).match(/class="btn btnAddToCart[^"]*"[^>]*>/)?.[0] || "";
    const a = (k) => parseInt(btn.match(new RegExp(`data-${k}="([0-9-]*)"`))?.[1] || "0", 10);
    old.set(grp, { org: a("orgprice") / 100, price: a("price") / 100, perc: a("discountperc"), disc: a("discount") / 100 });
  }
}));

// 2. Nieuwe producten (NL) met hun oude productnummer
const products = [];
for (let page = 1; ; page++) {
  const j = await (await fetch(`${B}/products?per_page=100&page=${page}&lang=nl&status=any`, { headers: H })).json();
  if (!j.length) break;
  products.push(...j);
}
const meta = (p, k) => p.meta_data.find((m) => m.key === k)?.value;
const expected = (regular, o) => {
  if (!regular) return "";
  if (o.perc > 0) {
    // In centen en afronden zoals de oude site (C#: half naar even): 14,95 -70% = 4,48; 9,95 -50% = 4,98.
    const n = Math.round(regular * 100) * (100 - o.perc), q = Math.floor(n / 100), r = n % 100;
    return ((r > 50 || (r === 50 && q % 2 === 1) ? q + 1 : q) / 100).toFixed(2);
  }
  if (o.disc > 0) return (regular - o.disc).toFixed(2);
  return "";
};
const changes = [];
for (const p of products) {
  const o = old.get(meta(p, "_c36_feed_group") || meta(p, "_c36_feed_id"));
  if (!o) continue;
  const items = p.type === "variable" ? await (await fetch(`${B}/products/${p.id}/variations?per_page=100`, { headers: H })).json() : [p];
  for (const v of items) {
    const want = expected(parseFloat(v.regular_price), o);
    if ((v.sale_price || "") !== want) changes.push({ p, v, from: v.sale_price || "", to: want, o });
  }
}
const withSale = [...old.values()].filter((o) => o.price < o.org).length;
console.log(`Oude pagina's met prijs: ${old.size}, waarvan met korting: ${withSale}. Kortingsprijs anders: ${changes.length} variaties/producten.`);
for (const c of changes) {
  const size = c.v.attributes?.map((a) => a.option).join(" ") || "";
  const why = c.o.perc > 0 ? `-${c.o.perc}%` : c.o.disc > 0 ? `-€${c.o.disc.toFixed(2)}` : "geen korting meer";
  console.log(`  ${c.p.name}${size ? " " + size : ""}: ${c.v.regular_price} | korting ${c.from || "-"} → ${c.to || "-"} (${why})`);
}

if (!APPLY) console.log("Proef: niets gewijzigd. Bijwerken met --apply.");
else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await writeFile(new URL(`../backups/sale-prices-before-${stamp}.json`, import.meta.url),
    JSON.stringify(changes.map((c) => ({ product: c.p.id, id: c.v.id, regular: c.v.regular_price, sale: c.from })), null, 2));
  const byProduct = new Map();
  for (const c of changes) byProduct.set(c.p.id, [...(byProduct.get(c.p.id) || []), c]);
  let ok = 0;
  for (const [pid, list] of byProduct) {
    const p = list[0].p;
    if (p.type === "variable") {
      const j = await (await fetch(`${B}/products/${pid}/variations/batch`, { method: "POST", headers: H, body: JSON.stringify({ update: list.map((c) => ({ id: c.v.id, sale_price: c.to })) }) })).json();
      ok += (j.update || []).filter((u) => !u.error).length;
      // NL-product opslaan: WCML zet de prijzen dan ook in de Engelse vertaling.
      await fetch(`${B}/products/${pid}`, { method: "PUT", headers: H, body: JSON.stringify({ status: p.status }) });
    } else {
      const r = await fetch(`${B}/products/${pid}`, { method: "PUT", headers: H, body: JSON.stringify({ sale_price: list[0].to }) });
      if (r.ok) ok++;
    }
  }
  console.log(`Bijgewerkt: ${ok} van ${changes.length}. Oude waarden in backups/sale-prices-before-${stamp}.json. Daarna: LiteSpeed → Alles opschonen.`);
}
