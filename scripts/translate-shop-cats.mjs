// Productcategorieën naar het Engels (WPML-gekoppeld). Slugs volgen de oude Engelse site waar mogelijk.
// Werkt bestaande EN-vertalingen bij in plaats van dubbel aan te maken. Schrijft NL→EN-paden naar translations/en/urlmap.json.
import { loadConfig } from "../lib/wp.mjs";
import { readFile, writeFile } from "node:fs/promises";

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";

// NL-term-id → [EN-naam, EN-slug]
const CATS = {
  41: ["Cycling clothing", "cycling-clothing"],
  42: ["Men", "men"],
  82: ["Women", "ladies"],
  90: ["Accessories", "accessories"],
  130: ["Speed on Wheels", "speed-on-wheels"],
  134: ["Volt Collection", "volt-collection"],
  67: ["Men's cycling jerseys", "cycling-jerseys-men"],
  68: ["Short sleeve cycling jerseys", "cycling-jerseys-short-sleeves"],
  78: ["Long sleeve cycling jerseys", "cycling-jerseys-long-sleeves"],
  43: ["Men's cycling shorts", "men-s-legwear"],
  44: ["Men's bib shorts", "cycling-bib-shorts-men"],
  61: ["Men's bib tights", "cycling-bib-tights-men"],
  79: ["Men's cycling jackets", "cycling-jackets"],
  86: ["Women's cycling jerseys", "ladies-cycling-jerseys"],
  87: ["Women's short sleeve cycling jerseys", "ladies-cycling-jerseys-short-sleeves"],
  88: ["Women's long sleeve cycling jerseys", "ladies-cycling-jerseys-long-sleeves"],
  83: ["Women's cycling shorts", "ladies-leg-wear"],
  84: ["Women's bib shorts", "ladies-bib-shorts"],
  85: ["Women's bib tights", "ladies-bib-tights"],
  89: ["Women's cycling jackets", "ladies-cycling-jackets"],
  129: ["36 Accessories", "36-accessories"],
  122: ["Arm and leg warmers", "arm-leg-warmers"],
  116: ["Base layers", "base-layers"],
  91: ["Cycling glasses", "cycling-glasses"],
  117: ["Cycling gloves", "cycling-gloves"],
  92: ["Cycling socks", "cycling-socks"],
  118: ["Shoe covers", "shoe-covers"],
  127: ["Sportswear", "sportswear"],
  128: ["Bags", "bags"],
  126: ["Caps and hats", "hats-caps"],
};

const nl = await (await fetch(`${W}/wp/v2/product_cat?lang=nl&per_page=100&_fields=id,name,slug,parent,description,link`, { headers: H })).json();
const byId = Object.fromEntries(nl.map((c) => [c.id, c]));
const depth = (c) => (c.parent ? 1 + depth(byId[c.parent]) : 0);
const tr = async (id) => (await (await fetch(`${W}/c36/v1/translations?element_type=tax_product_cat&id=${id}`, { headers: H })).json()).translations?.en?.term_id;

const urlmapFile = new URL("../translations/en/urlmap.json", import.meta.url);
const urlmap = JSON.parse(await readFile(urlmapFile, "utf8"));
const enId = {};
for (const c of [...nl].sort((a, b) => depth(a) - depth(b))) {
  const [name, slug] = CATS[c.id] || [];
  if (!name) { console.log(`! geen vertaling voor #${c.id} ${c.name}`); continue; }
  const parent = c.parent ? enId[c.parent] : 0;
  const existing = await tr(c.id);
  const r = await fetch(`${W}/wp/v2/product_cat${existing ? "/" + existing : ""}?lang=en`, { method: "POST", headers: H, body: JSON.stringify({ name, slug, parent }) });
  const t = await r.json();
  if (!r.ok) { console.log(`✗ ${c.name}: ${r.status} ${t.message}`); continue; }
  enId[c.id] = t.id;
  if (!existing) {
    const l = await fetch(`${W}/c36/v1/link`, { method: "POST", headers: H, body: JSON.stringify({ element_type: "tax_product_cat", source_id: c.id, translation_id: t.id, lang: "en", source_lang: "nl" }) });
    if (!l.ok) console.log(`  ! koppelen mislukt ${l.status}`);
  }
  const fresh = await (await fetch(`${W}/wp/v2/product_cat/${t.id}?_fields=link,slug`, { headers: H })).json();
  urlmap[new URL(c.link).pathname] = new URL(fresh.link).pathname;
  console.log(`✓ ${c.name.padEnd(28)} → ${name.padEnd(38)} ${new URL(fresh.link).pathname}`);
}
await writeFile(urlmapFile, JSON.stringify(urlmap, null, 2));
