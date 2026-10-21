// Productfeed: koppelt de id's uit de oude Umbraco-feed (audit/old-facebook-feed.xml, kopie van
// https://www.36cycling.com/umbraco/api/site/getFacebookFeed) aan de nieuwe producten, zodat de nieuwe feed
// (mu-plugin 36cycling-feed.php) dezelfde id's gebruikt. Koppelen op EAN, anders op productnaam + maat.
//   node scripts/feed-map.mjs --dry      → alleen tonen wat er gekoppeld wordt
//   node scripts/feed-map.mjs            → opslaan (meta _c36_feed_id / _c36_feed_group / _c36_feed_gender)
//   node scripts/feed-map.mjs --compare  → nieuwe feed naast de oude leggen (ontbrekende id's, prijzen, voorraad)
import { readFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const DRY = process.argv.includes("--dry");
const COMPARE = process.argv.includes("--compare");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const BASE = cfg.wp.baseUrl;

const tag = (it, t) => {
  const open = `<g:${t}>`, i = it.indexOf(open);
  if (i < 0) return it.includes(`<g:${t} />`) ? "" : undefined;
  return it.slice(i + open.length, it.indexOf(`</g:${t}>`, i));
};
const dec = (s) => (s ?? "").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&apos;", "'").replaceAll("&amp;", "&");
const parse = (xml) => xml.split("<item>").slice(1).map((it) => ({
  id: tag(it, "id"), group: tag(it, "item_group_id"), title: dec(tag(it, "title")), gender: tag(it, "gender"), ean: tag(it, "ean"),
  size: dec(tag(it, "size")), price: tag(it, "price"), sale: tag(it, "sale_price"), qty: tag(it, "quantity_to_sell_on_facebook"), link: tag(it, "link"),
}));
const old = parse(await readFile(new URL("../audit/old-facebook-feed.xml", import.meta.url), "utf8"));

if (COMPARE) {
  const r = await fetch(`${BASE}/productfeed.xml?x=${Date.now()}`);
  const now = parse(await r.text());
  const byId = new Map(now.map((i) => [i.id, i]));
  const gone = old.filter((o) => !byId.has(o.id));
  const fresh = now.filter((n) => !old.some((o) => o.id === n.id));
  const diff = (k) => old.filter((o) => byId.has(o.id) && (byId.get(o.id)[k] ?? "") !== (o[k] ?? ""));
  console.log(`Oude feed ${old.length} items, nieuwe feed ${now.length} items (status ${r.status}).`);
  console.log(`\nIn de oude feed, niet in de nieuwe (${gone.length}):`);
  for (const t of [...new Set(gone.map((o) => o.title))]) console.log(`  - ${t}: ${gone.filter((o) => o.title === t).map((o) => o.id).join(", ")}`);
  console.log(`\nNieuw in de feed (${fresh.length}):`);
  for (const t of [...new Set(fresh.map((n) => n.title))]) console.log(`  - ${t}: ${fresh.filter((n) => n.title === t).map((n) => n.id).join(", ")}`);
  for (const k of ["price", "title", "gender", "ean", "size", "qty"]) {
    const d = diff(k);
    console.log(`\nAnders: ${k} (${d.length})`);
    for (const o of d.slice(0, 8)) console.log(`  ${o.id}: oud "${o[k] ?? ""}" → nieuw "${byId.get(o.id)[k] ?? ""}"`);
  }
} else {
  // Nieuwe producten + variaties (NL).
  const products = [];
  for (let page = 1; ; page++) {
    const j = await (await fetch(`${BASE}/wp-json/wc/v3/products?per_page=100&page=${page}&lang=nl&status=any`, { headers: H })).json();
    if (!j.length) break;
    products.push(...j);
  }
  const queue = products.filter((p) => p.type === "variable");
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      p.vars = await (await fetch(`${BASE}/wp-json/wc/v3/products/${p.id}/variations?per_page=100`, { headers: H })).json();
    }
  }));
  const all = products.flatMap((p) => p.type === "variable"
    ? p.vars.map((v) => ({ p, v, size: v.attributes.map((a) => a.option).join(" - ") }))
    : [{ p, v: p, size: "" }]);

  const norm = (s) => (s || "").toLowerCase().trim();
  const size = (s) => (s || "").toUpperCase().replaceAll(" ", "").replace(/^XXXXL$/, "4XL").replace(/^XXXL$/, "3XL").replace(/^XXL$/, "2XL");
  const byEan = new Map();
  for (const a of all) if (a.v.global_unique_id) byEan.set(a.v.global_unique_id, a);
  const used = new Set();
  const items = {};
  const missing = [];
  for (const o of old) {
    let a = o.ean && byEan.get(o.ean);
    let how = "EAN";
    if (!a || used.has(a.v.id) || norm(a.p.name) !== norm(o.title)) {
      const c = all.filter((x) => !used.has(x.v.id) && norm(x.p.name) === norm(o.title) && (!o.size || size(x.size) === size(o.size)));
      a = c.length === 1 ? c[0] : null;
      how = "naam+maat";
    }
    if (!a) { missing.push(o); continue; }
    used.add(a.v.id);
    items[a.v.id] = { _c36_feed_id: o.id };
    if (a.p.type === "variable") items[a.p.id] = { ...(items[a.p.id] || {}), _c36_feed_group: o.group || o.id.split("-")[0], _c36_feed_gender: o.gender || "" };
    else items[a.p.id] = { ...items[a.p.id], _c36_feed_gender: o.gender || "" };
    o.how = how;
  }
  console.log(`Gekoppeld: ${old.length - missing.length} van ${old.length} (EAN ${old.filter((o) => o.how === "EAN").length}, naam+maat ${old.filter((o) => o.how === "naam+maat").length}).`);
  if (missing.length) {
    console.log("Niet gekoppeld (product of maat ontbreekt in de nieuwe shop):");
    for (const t of [...new Set(missing.map((o) => o.title))]) console.log(`  - ${t}: ${missing.filter((o) => o.title === t).map((o) => o.size || o.id).join(", ")}`);
  }
  const loose = all.filter((a) => a.p.status === "publish" && !used.has(a.v.id));
  console.log(`Gepubliceerd zonder oud id (krijgen hun SKU als id): ${loose.length}`);

  if (!DRY) {
    const entries = Object.entries(items);
    let n = 0;
    for (let i = 0; i < entries.length; i += 200) {
      const r = await fetch(`${BASE}/wp-json/c36/v1/feed-map`, { method: "POST", headers: H, body: JSON.stringify({ items: Object.fromEntries(entries.slice(i, i + 200)) }) });
      if (!r.ok) { console.log(`Fout ${r.status}: ${(await r.text()).slice(0, 200)} (is 36cycling-feed.php geüpload?)`); process.exit(1); }
      n += (await r.json()).updated;
    }
    console.log(`Opgeslagen: ${n} producten/variaties. Controle: node scripts/feed-map.mjs --compare`);
  }
}
