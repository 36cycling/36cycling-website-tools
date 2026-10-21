// Voorraad overnemen van de oude Umbraco-shop, via de oude productfeed. De feed geeft per maat de voorraad
// (veld "Voorraad"/amountInStock in Umbraco, zonder aftrek van "gereserveerd"; steekproef 21 okt 2026: 61/61 gelijk).
// Koppeling via het oude feed-id (meta _c36_feed_id, gezet met scripts/feed-map.mjs), dus niet op maatnaam of EAN.
// Alleen draaien zolang www.36cycling.com nog de oude Umbraco-site is (na de domeinwissel geeft dat adres de nieuwe feed).
//   node scripts/stock-sync.mjs               → proef: toont wat er verandert (ook prijsverschillen)
//   node scripts/stock-sync.mjs --apply       → voorraad bijwerken (oude waarden eerst naar backups/)
//   node scripts/stock-sync.mjs --apply --prices → ook normale prijs en kortingsprijs gelijkzetten aan de oude shop
//   --file=pad/naar/feed.xml                  → een opgeslagen feed gebruiken in plaats van de live feed
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const PRICES = process.argv.includes("--prices");
const FILE = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
const OLD_FEED = "https://www.36cycling.com/umbraco/api/site/getFacebookFeed";
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const B = cfg.wp.baseUrl + "/wp-json/wc/v3";

// 1. Oude feed
const xml = FILE ? await readFile(FILE, "utf8") : await (await fetch(OLD_FEED, { headers: { "User-Agent": "Mozilla/5.0 (36cycling stock-sync)" } })).text();
const tag = (it, t) => {
  const open = `<g:${t}>`, i = it.indexOf(open);
  return i < 0 ? "" : it.slice(i + open.length, it.indexOf(`</g:${t}>`, i));
};
const old = xml.split("<item>").slice(1).map((it) => ({
  id: tag(it, "id"), title: tag(it, "title"), size: tag(it, "size"), link: tag(it, "link"),
  qty: parseInt(tag(it, "quantity_to_sell_on_facebook"), 10) || 0, price: parseFloat(tag(it, "price")) || 0,
  // Let op: sale_price in de oude feed is het kortingsBEDRAG (65.00 met sale_price 15.00 = nu 50.00), 0.00 = geen korting.
  discount: parseFloat(tag(it, "sale_price")) || 0,
}));
if (!old.length || !old.every((o) => /^https:..www.36cycling.com.nl.shop.[0-9]+./.test(o.link))) {
  console.log("Dit is niet de oude Umbraco-feed (geen /nl/shop/<nummer>/-links). Na de domeinwissel kan dit script niet meer; gebruik dan --file met een eerder opgeslagen feed.");
  process.exit(1);
}
if (!FILE) await writeFile(new URL(`../backups/old-feed-${new Date().toISOString().slice(0, 10)}.xml`, import.meta.url), xml);

// 2. Nieuwe producten en variaties (NL) met hun oude feed-id
const products = [];
for (let page = 1; ; page++) {
  const j = await (await fetch(`${B}/products?per_page=100&page=${page}&lang=nl&status=any`, { headers: H })).json();
  if (!j.length) break;
  products.push(...j);
}
const queue = products.filter((p) => p.type === "variable");
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    p.vars = await (await fetch(`${B}/products/${p.id}/variations?per_page=100`, { headers: H })).json();
  }
}));
const byFeedId = new Map();
for (const p of products) {
  for (const v of p.type === "variable" ? p.vars : [p]) {
    const fid = v.meta_data?.find((m) => m.key === "_c36_feed_id")?.value;
    if (fid) byFeedId.set(fid, { p, v });
  }
}

// 3. Vergelijken
const changes = [], priceDiffs = [], unmapped = [];
for (const o of old) {
  const hit = byFeedId.get(o.id);
  if (!hit) { unmapped.push(o); continue; }
  const { p, v } = hit;
  const target = Math.max(0, o.qty);
  if (!v.manage_stock || v.stock_quantity !== target) changes.push({ p, v, o, from: v.manage_stock ? v.stock_quantity : "niet beheerd", to: target });
  const sale = o.discount > 0 ? (o.price - o.discount).toFixed(2) : "";
  if ((o.price && Math.abs(parseFloat(v.regular_price || 0) - o.price) > 0.001) || (v.sale_price || "") !== sale) priceDiffs.push({ p, v, o, sale });
}
const label = ({ p, o }) => `${p.name}${o.size ? " " + o.size : ""}`;
console.log(`Oude feed: ${old.length} maten. Gekoppeld: ${old.length - unmapped.length}. Voorraad anders: ${changes.length}. Prijs anders: ${priceDiffs.length}.`);
for (const c of changes) console.log(`  voorraad ${label(c)}: ${c.from} → ${c.to}`);
for (const d of priceDiffs) console.log(`  prijs ${label(d)}: nieuw ${d.v.regular_price}${d.v.sale_price ? " → " + d.v.sale_price : ""} / oud ${d.o.price.toFixed(2)}${d.sale ? " → " + d.sale : ""}`);
if (unmapped.length) console.log(`Niet gekoppeld (staat niet in de nieuwe shop): ${[...new Set(unmapped.map((o) => o.title))].join("; ")}`);

// Steekproef om in de Umbraco-backoffice na te kijken
const sample = old.filter((o) => byFeedId.has(o.id) && o.qty > 0).sort(() => Math.random() - 0.5).slice(0, 5);
console.log("Steekproef (vergelijk in Umbraco → product → maat → Voorraad):");
for (const o of sample) console.log(`  ${o.title}${o.size ? " " + o.size : ""}: ${o.qty}`);

if (!APPLY) { console.log("Proef: niets gewijzigd. Bijwerken met --apply."); }
else {
  // 4. Bijwerken, per product in één batch; oude waarden eerst bewaren
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await writeFile(new URL(`../backups/stock-before-${stamp}.json`, import.meta.url),
    JSON.stringify(changes.map((c) => ({ product: c.p.id, id: c.v.id, sku: c.v.sku, stock: c.v.stock_quantity, manage: c.v.manage_stock, regular_price: c.v.regular_price })), null, 2));
  const groups = new Map();
  const add = (p, upd) => { const g = groups.get(p.id) || []; g.push(upd); groups.set(p.id, g); };
  for (const c of changes) add(c.p, { id: c.v.id, manage_stock: true, stock_quantity: c.to });
  if (PRICES) for (const d of priceDiffs) add(d.p, { id: d.v.id, regular_price: d.o.price.toFixed(2), sale_price: d.sale });
  let ok = 0, fail = 0;
  for (const [pid, updates] of groups) {
    const p = products.find((x) => x.id === pid);
    // Meerdere wijzigingen voor dezelfde variatie samenvoegen
    const merged = Object.values(updates.reduce((a, u) => ({ ...a, [u.id]: { ...(a[u.id] || {}), ...u } }), {}));
    const url = p.type === "variable" ? `${B}/products/${pid}/variations/batch` : `${B}/products/batch`;
    const j = await (await fetch(url, { method: "POST", headers: H, body: JSON.stringify({ update: merged }) })).json();
    for (const u of j.update || []) u.error ? (fail++, console.log(`  ✗ ${p.name}: ${u.error.message}`)) : ok++;
  }
  console.log(`Bijgewerkt: ${ok}, fouten: ${fail}. Oude waarden in backups/stock-before-${stamp}.json. Daarna: LiteSpeed → Alles opschonen.`);
}
