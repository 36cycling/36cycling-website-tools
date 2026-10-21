// Producten naar het Engels (WCML). Teksten komen uit het vertaalgeheugen (translations/en/*.todo/.en-paren).
// Nieuw EN-product = concept, gekoppeld via translation_of; daarna wordt het NL-origineel opnieuw opgeslagen zodat
// WCML type, prijzen, varianten, voorraad, attributen, categorieën en afbeeldingen synchroniseert.
//   node scripts/translate-products.mjs [--dry] [id …]
import { readFile, writeFile, readdir } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";
import { extractSegments, applyTranslation, makeUrlRewriter } from "../lib/translate.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const only = args.filter((a) => /^\d+$/.test(a)).map(Number);
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const DIR = new URL("../translations/en/", import.meta.url);

const parse = (t) => { const s = {}; const [, ...b] = t.split(/^=== (\d+)[ \t]*$/m); for (let i = 0; i < b.length; i += 2) s[+b[i]] = b[i + 1].replace(/^\r?\n/, "").replace(/\r?\n$/, ""); return s; };
const files = new Set(await readdir(DIR));
const tm = {};
for (const f of files) {
  const m = f.match(/^(.*)\.(nl|todo)\.txt$/); if (!m) continue;
  const enf = m[2] === "nl" ? `${m[1]}.en.txt` : `${m[1]}.todo.en.txt`;
  if (!files.has(enf)) continue;
  const nl = parse(await readFile(new URL(f, DIR), "utf8")), en = parse(await readFile(new URL(enf, DIR), "utf8"));
  for (const [n, t] of Object.entries(nl)) if (en[n] !== undefined && en[n] !== "") tm[t] = en[n].trim() === "=" ? t : en[n];
}
const urlmapFile = new URL("urlmap.json", DIR);
const urlmap = JSON.parse(await readFile(urlmapFile, "utf8"));
const rewrite = makeUrlRewriter(urlmap);
const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const t = (s, label, missing) => { if (!s) return s; if (s in tm) return tm[s]; missing.push(`${label}: ${s.slice(0, 60)}`); return null; };
const html = (s, label, missing) => { if (!s) return s; const r = applyTranslation(s, tm, rewrite); r.missing.forEach((m) => missing.push(`${label}: ${m.slice(0, 60)}`)); return r.content; };

const prods = [];
for (let p = 1; p < 5; p++) {
  const j = await (await fetch(`${W}/wc/v3/products?per_page=100&page=${p}&status=any`, { headers: H })).json();
  if (!j.length) break; prods.push(...j);
}
const nlProds = prods.filter((p) => p.lang === "nl" && (!only.length || only.includes(p.id)));
console.log(`NL-producten: ${nlProds.length}${DRY ? " (proef)" : ""}`);

let ok = 0, fail = 0, i = 0;
async function one(p) {
  const missing = [];
  const meta = Object.fromEntries((p.meta_data || []).map((m) => [m.key, m.value]));
  const name = t(p.name, "naam", missing);
  const body = {
    name, slug: name ? slugify(name) : undefined,
    description: html(p.description, "beschrijving", missing),
    short_description: html(p.short_description, "kort", missing),
    meta_data: ["title", "metadesc", "focuskw"].filter((k) => meta[`_yoast_wpseo_${k}`]).map((k) => ({ key: `_yoast_wpseo_${k}`, value: t(meta[`_yoast_wpseo_${k}`], `yoast ${k}`, missing) })),
  };
  if (missing.length) { fail++; console.log(`✗ #${p.id} ${p.name}: ontbreekt\n   ${missing.join("\n   ")}`); return; }
  if (DRY) { ok++; return; }
  const tr = await (await fetch(`${W}/c36/v1/translations?element_type=post_product&id=${p.id}`, { headers: H })).json();
  const enId = tr.translations?.en?.element_id;
  const r = enId
    ? await fetch(`${W}/wc/v3/products/${enId}`, { method: "PUT", headers: H, body: JSON.stringify(body) })
    : await fetch(`${W}/wc/v3/products?lang=en`, { method: "POST", headers: H, body: JSON.stringify({ ...body, status: "draft", lang: "en", translation_of: p.id }) });
  const j = await r.json();
  if (!r.ok) { fail++; console.log(`✗ #${p.id} ${p.name}: ${r.status} ${j.message}`); return; }
  // NL-origineel opnieuw opslaan → WCML synchroniseert prijs/varianten/voorraad/attributen/categorieën/afbeeldingen.
  await fetch(`${W}/wc/v3/products/${p.id}`, { method: "PUT", headers: H, body: JSON.stringify({ menu_order: p.menu_order }) });
  if (p.status === "publish") urlmap[new URL(p.permalink).pathname] = new URL(j.permalink).pathname.replace(/\?.*$/, "");
  ok++;
  if (++i % 20 === 0) console.log(`… ${i}`);
}
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => { while (next < nlProds.length) await one(nlProds[next++]); }));
if (!DRY) await writeFile(urlmapFile, JSON.stringify(urlmap, null, 2));
console.log(`Klaar: ${ok} goed, ${fail} met problemen.`);
