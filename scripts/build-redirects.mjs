// Volledige 301-lijst voor de domeinwissel 36cycling.com → nieuwe WordPress-site, als relatieve paden
// (werken op rondevanrotterdam.nl én straks op 36cycling.com). Bronnen:
//   - audit/redirect-voorstel.csv            losse pagina's (301 / 410)
//   - audit/old-categories.json              oude shopcategorieën NL (/nl/fietskleding/...) → nieuwe categorie (term-id)
//   - hreflang="en" van de oude categoriepagina's → oude EN-categorie → nieuwe EN-categorie (urlmap)
//   - audit/products.json (oldPath)          oude producten /nl/shop/<id>/<slug>/ → regex per id, NL én EN
// Alle doelen worden gecontroleerd (moeten 200 geven).
//   node scripts/build-redirects.mjs            → audit/redirects-final.csv + .json
//   node scripts/build-redirects.mjs --import   → ook in de plugin Redirection zetten (groep "Migratie 36cycling.com")
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const IMPORT = process.argv.includes("--import");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const BASE = cfg.wp.baseUrl;
const OLD = "https://www.36cycling.com";
const P = (p) => new URL("../" + p, import.meta.url);
const json = async (p) => JSON.parse(await readFile(P(p), "utf8"));
const path = (u) => new URL(u, BASE).pathname;

const urlmap = await json("translations/en/urlmap.json");
const rules = []; // {source, target, code, regex, note}
const add = (source, target, note, code = 301, regex = false) => rules.push({ source, target, code, regex, note });

// 1. Losse pagina's uit het voorstel (met de beslissingen van daarna).
const DECIDED = {
  "/nl/design-samenwerkingen/": "/nl/wielerkleding-ontwerpen/",
  "/nl/promotions/": "/nl/sportkleding-bedrukken/",
  "/nl/36-cycling-circle-basic/": "/nl/36-cycling-circle/",
  "/nl/36-cycling-circle-basic/bedankt/": "/nl/36-cycling-circle/",
  "/circle/": "/nl/36-cycling-circle/",
  "/36-cycling-circle/": "/nl/36-cycling-circle/",
  "/nl/orderstatus/": "/nl/mijn-account/",
  "/nl/bestelling-volgen/": "/nl/mijn-account/",
  "/privacy/": "/nl/privacy/",
  "/nl/shop/cart/": "/nl/winkelwagen/",
  "/nl/shop/thankyou/": "/nl/shop/",
  // Oude sitemap (Web.config herschreef /sitemap.xml naar /nl/xml-sitemap/) → Yoast-sitemap.
  "/sitemap.xml": "/sitemap_index.xml",
  "/xml-sitemap/": "/sitemap_index.xml",
  "/nl/xml-sitemap/": "/sitemap_index.xml",
  // Restant van een vroegere WPML-instelling voor de rootpagina (bestand bestaat niet meer).
  "/downloads/root-redirect.html": "/nl/",
};
const voorstel = (await readFile(P("audit/redirect-voorstel.csv"), "utf8")).split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(";"));
// Pagina's die op de nieuwe site weer bestaan (geen redirect meer): bedankpagina = meetpunt in Google Tag Manager.
const KEEP = new Set(["/nl/contact/bedankt/"]);
for (const [src, target, action, reason] of voorstel) {
  if (KEEP.has(src)) continue;
  if (action === "301") { if (target.startsWith("/")) add(src, target, "voorstel: " + reason); }
  else if (action === "410 GONE") add(src, "", "410: " + reason, 410);
}
for (const [src, target] of Object.entries(DECIDED)) if (!rules.some((r) => r.source === src)) add(src, target, "besloten");

// 2. Productcategorieën NL + EN.
const newCats = {};
for (const lang of ["nl"]) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/product_cat?per_page=100&lang=${lang}&_fields=id,slug,link`, { headers: H });
  for (const c of await r.json()) newCats[c.id] = path(c.link);
}
const oldCats = await json("audit/old-categories.json");
for (const [id, c] of Object.entries(oldCats)) {
  const nlNew = newCats[id];
  if (!nlNew) { console.log(`  ! geen nieuwe categorie voor ${c.name} (${id})`); continue; }
  add(path(c.oldUrl), nlNew, `categorie ${c.name}`);
  const html = await (await fetch(c.oldUrl, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const en = html.match(/<link[^>]+href="([^"]+)"[^>]+hreflang="en"/i)?.[1];
  if (en && urlmap[nlNew]) add(path(en), urlmap[nlNew], `categorie ${c.name} (EN)`);
}
// Losse oude categorie-landingspagina's.
const catByName = (re) => Object.entries(oldCats).find(([, c]) => re.test(c.name))?.[0];
add("/nl/fietsbrillen/", newCats[catByName(/brillen/i)] || "/nl/shop/", "oude landingspagina fietsbrillen");
add("/nl/speedonwheels/", newCats[catByName(/speed on wheels/i)] || "/nl/shop/", "oude collectiepagina Speed on Wheels");
add("/nl/kask-helmen/", "/nl/shop/", "oude categorie helmen (geen helmen meer)");

// 3. Producten: /nl/shop/<id>/<slug>/ → regex per oud id (vangt ook oude slug-varianten en de EN-versie).
const products = await json("audit/products.json");
// Staat op de oude site maar niet in de nieuwe shop → naar de categorie korte fietsbroeken dames.
const totalgrip = newCats[catByName(/^korte fietsbroeken dames$/i)];
if (totalgrip) {
  add("^/nl/shop/175638(/.*)?$", totalgrip, "product fietsbroek-dames-totalgrip-zwart (niet in nieuwe shop)", 301, true);
  if (urlmap[totalgrip]) add("^/en/shop/175638(/.*)?$", urlmap[totalgrip], "product fietsbroek-dames-totalgrip-zwart (EN, niet in nieuwe shop)", 301, true);
}
const byOld = products.filter((p) => p.oldPath).map((p) => [p.oldPath, p.slug, p.status]);
for (const [oldPath, slug, status] of byOld) {
  const id = oldPath.match(/^\/nl\/shop\/(\d+)\//)?.[1];
  if (!id) continue;
  const nl = `/nl/shop/${slug}/`;
  add(`^/nl/shop/${id}(/.*)?$`, status === "private" ? "/nl/shop/" : nl, `product ${slug}`, 301, true);
  const en = urlmap[nl];
  if (en) add(`^/en/shop/${id}(/.*)?$`, status === "private" ? "/en/cycling-clothing/" : en, `product ${slug} (EN)`, 301, true);
}

// 4. Doelen controleren.
const uniq = [...new Set(rules.filter((r) => r.code === 301).map((r) => r.target))];
const bad = new Map();
const queue = [...uniq];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const t = queue.shift();
    const r = await fetch(BASE + t, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => ({ status: "fout" }));
    if (r.status !== 200) bad.set(t, r.status);
  }
}));
for (const r of rules) if (bad.has(r.target)) r.note += ` [DOEL ${bad.get(r.target)}]`;
// Geen bron die al een bestaande pagina is (behalve regex).
console.log(`${rules.length} regels: ${rules.filter((r) => r.code === 301 && !r.regex).length} vaste 301, ${rules.filter((r) => r.regex).length} product-regex, ${rules.filter((r) => r.code === 410).length} × 410`);
if (bad.size) console.log("Doelen die geen 200 geven:", Object.fromEntries(bad));

const csv = ["bron;doel;code;regex;toelichting", ...rules.map((r) => [r.source, r.target, r.code, r.regex ? "ja" : "", r.note].join(";"))].join("\n");
await writeFile(P("audit/redirects-final.csv"), "﻿" + csv);
await writeFile(P("audit/redirects-final.json"), JSON.stringify(rules, null, 2));
console.log("→ audit/redirects-final.csv");

if (IMPORT) {
  if (bad.size) { console.log("Niet geïmporteerd: eerst de doelen hierboven oplossen."); process.exit(1); }
  const R = `${BASE}/wp-json/redirection/v1`;
  const groups = (await (await fetch(`${R}/group?per_page=100`, { headers: H })).json()).items || [];
  let group = groups.find((g) => g.name === "Migratie 36cycling.com");
  if (!group) group = (await (await fetch(`${R}/group`, { method: "POST", headers: H, body: JSON.stringify({ name: "Migratie 36cycling.com", moduleId: 1 }) })).json()).items?.find((g) => g.name === "Migratie 36cycling.com");
  const existing = new Set();
  for (let page = 0; ; page++) {
    const j = await (await fetch(`${R}/redirect?per_page=200&page=${page}&filterBy[group]=${group.id}`, { headers: H })).json();
    for (const it of j.items || []) existing.add(it.url);
    if (!j.items?.length || existing.size >= j.total) break;
  }
  let n = 0;
  for (const r of rules) {
    if (existing.has(r.source)) continue;
    const body = {
      url: r.source, title: r.note.slice(0, 100), group_id: group.id, match_type: "url", regex: r.regex,
      action_type: r.code === 410 ? "error" : "url", action_code: r.code, action_data: { url: r.target },
      match_data: { source: { flag_query: "ignore", flag_case: true, flag_trailing: true, flag_regex: r.regex } },
    };
    const res = await fetch(`${R}/redirect`, { method: "POST", headers: H, body: JSON.stringify(body) });
    if (!res.ok) { console.log(`  ✗ ${r.source}: ${res.status} ${(await res.text()).slice(0, 200)}`); continue; }
    n++;
  }
  console.log(`Geïmporteerd: ${n} (al aanwezig: ${existing.size}) in groep ${group.name} (#${group.id})`);
}
