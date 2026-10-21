// Zet de SEO-tekst van elke productcategorie in het standaard beschrijvingsveld (NL uit de oude site, EN uit c36_seo_text
// van de EN-term). Schrijft per taal met ?lang=, zodat WPML het id niet omzet. Controleert daarna beide talen.
import { readFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const old = JSON.parse(await readFile(new URL("../audit/old-categories.json", import.meta.url), "utf8"));
const { applyTranslation, makeUrlRewriter } = await import("../lib/translate.mjs");
const { readdir } = await import("node:fs/promises");
const DIR = new URL("../translations/en/", import.meta.url);
const parse = (t) => { const s = {}; const [, ...b] = t.split(/^=== (\d+)[ \t]*$/m); for (let i = 0; i < b.length; i += 2) s[+b[i]] = b[i + 1].replace(/^\r?\n/, "").replace(/\r?\n$/, ""); return s; };
const files = new Set(await readdir(DIR)); const tm = {};
for (const f of files) { const m = f.match(/^(.*)\.(nl|todo)\.txt$/); if (!m) continue; const enf = m[2] === "nl" ? `${m[1]}.en.txt` : `${m[1]}.todo.en.txt`; if (!files.has(enf)) continue;
  const nl = parse(await readFile(new URL(f, DIR), "utf8")), en = parse(await readFile(new URL(enf, DIR), "utf8"));
  for (const [n, t] of Object.entries(nl)) if (en[n] !== undefined && en[n] !== "") tm[t] = en[n].trim() === "=" ? t : en[n]; }
const rewrite = makeUrlRewriter(JSON.parse(await readFile(new URL("urlmap.json", DIR), "utf8")));
// Via c36/v1/term-description: de gewone REST-route haalt H2's, alinea's en lijsten weg.
const set = async (id, lang, description) => (await fetch(`${W}/c36/v1/term-description?lang=${lang}`, { method: "POST", headers: H, body: JSON.stringify({ taxonomy: "product_cat", term_id: +id, description }) })).ok;
const get = async (id, lang) => (await (await fetch(`${W}/wp/v2/product_cat/${id}?lang=${lang}&context=edit&_fields=description`, { headers: H })).json()).description || "";
let n = 0, bad = 0;
for (const [nlId, o] of Object.entries(old)) {
  if (!o.html) continue;
  const enId = (await (await fetch(`${W}/c36/v1/translations?element_type=tax_product_cat&id=${nlId}`, { headers: H })).json()).translations?.en?.term_id;
  const en = applyTranslation(o.html, tm, rewrite).content;
  // Niet over aanpassingen van de gebruiker heen schrijven: alleen als de huidige tekst (zonder opmaak) gelijk is.
  const plain = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const curNl = await get(nlId, "nl"), curEn = enId ? await get(enId, "en") : "";
  const editedNl = curNl && plain(curNl) !== plain(o.html), editedEn = curEn && plain(curEn) !== plain(en);
  if (editedNl || editedEn) { console.log(`- ${o.name}: overgeslagen, tekst is aangepast (${editedNl ? "NL" : ""}${editedEn ? " EN" : ""})`); continue; }
  await set(nlId, "nl", o.html); if (enId) await set(enId, "en", en);
  const dn = await get(nlId, "nl"), de = enId ? await get(enId, "en") : "";
  const h2 = (s) => (s.match(/<h2/g) || []).length, want = h2(o.html);
  const okNl = /Fiets|fiets|wieler|Wieler|36 Cycling/.test(dn) && !/ cycling clothing /i.test(dn.slice(0, 300)) && h2(dn) === want,
    okEn = !enId || /cycling|Cycling/.test(de) && dn !== de && h2(de) === want;
  n++; if (!okNl || !okEn) bad++;
  console.log(`${okNl && okEn ? "✓" : "✗"} ${o.name.padEnd(28)} NL ${dn.length} tekens | EN #${enId} ${de.length} tekens${dn === de ? " (GELIJK — fout)" : ""}`);
}
console.log(`${n} categorieën, ${bad} problemen`);
