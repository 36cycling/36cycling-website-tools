// Zet SEO van productcategorieën: NL uit de oude site (audit/old-categories.json), EN via het vertaalgeheugen.
// Yoast-titel/-meta + SEO-tekst (term meta c36_seo_text, getoond onder de producten) via POST c36/v1/term-seo.
//   node scripts/category-seo.mjs [--dry]
import { readFile, readdir } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";
import { applyTranslation, makeUrlRewriter } from "../lib/translate.mjs";

const DRY = process.argv.includes("--dry");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const DIR = new URL("../translations/en/", import.meta.url);
const parse = (t) => { const s = {}; const [, ...b] = t.split(/^=== (\d+)[ \t]*$/m); for (let i = 0; i < b.length; i += 2) s[+b[i]] = b[i + 1].replace(/^\r?\n/, "").replace(/\r?\n$/, ""); return s; };
const files = new Set(await readdir(DIR)); const tm = {};
for (const f of files) {
  const m = f.match(/^(.*)\.(nl|todo)\.txt$/); if (!m) continue;
  const enf = m[2] === "nl" ? `${m[1]}.en.txt` : `${m[1]}.todo.en.txt`; if (!files.has(enf)) continue;
  const nl = parse(await readFile(new URL(f, DIR), "utf8")), en = parse(await readFile(new URL(enf, DIR), "utf8"));
  for (const [n, t] of Object.entries(nl)) if (en[n] !== undefined && en[n] !== "") tm[t] = en[n].trim() === "=" ? t : en[n];
}
const rewrite = makeUrlRewriter(JSON.parse(await readFile(new URL("urlmap.json", DIR), "utf8")));
const old = JSON.parse(await readFile(new URL("../audit/old-categories.json", import.meta.url), "utf8"));
// Ontbrekende oude titels/meta's aanvullen (categorieën die op de oude site geen eigen SEO hadden).
const FALLBACK = {
  129: { title: "36 Accessoires | 36 Cycling", metadesc: "Accessoires van 36 Cycling: van iPad-hoes tot tas. Maak je wieleroutfit compleet met de accessoires uit onze eigen collectie." },
  130: { title: "Wielerkleding Speed on Wheels | 36 Cycling", metadesc: "Speed on Wheels: de wielerkleding- en lifestylecollectie van 36 Cycling en Niki Terpstra. Shirts, broeken, jacks, sokken en meer." },
  134: { title: "Volt Collection | 36 Cycling", metadesc: "De Volt-collectie van 36 Cycling: wielershirts in zwart met neon geel. Aerodynamische snit, ergonomische pasvorm en pre-dyed stoffen." },
};
// Yoast-velden + Yoast-indexable van de term direct zetten (plugin schrijft buiten de WPML-filters om).
const post = async (body, lang = "nl") => {
  if (DRY) return { ok: true };
  const r = await fetch(`${W}/c36/v1/term-seo?lang=${lang}`, { method: "POST", headers: H, body: JSON.stringify({ ...body, cleanup: true }) });
  const j = await r.json();
  return { ok: r.ok, status: r.status, j };
};
let missing = 0;
for (const [nlId, o] of Object.entries(old)) {
  const title = /36 Cycling/.test(o.title || "") ? o.title : FALLBACK[nlId]?.title || o.title;
  const metadesc = o.metadesc || FALLBACK[nlId]?.metadesc || "";
  const nl = { taxonomy: "product_cat", term_id: +nlId, title, metadesc };
  const tr = await (await fetch(`${W}/c36/v1/translations?element_type=tax_product_cat&id=${nlId}`, { headers: H })).json();
  const enId = tr.translations?.en?.term_id;
  const t = (s) => (!s ? s : s in tm ? tm[s] : (missing++, console.log(`  ontbreekt: ${s.slice(0, 60)}`), s));
  const r1 = await post(nl);
  let enMsg = "geen EN-term";
  if (enId) {
    const r2 = await post({ taxonomy: "product_cat", term_id: enId, title: t(title), metadesc: t(metadesc) }, "en");
    enMsg = r2.ok ? `EN #${enId} ✓` : `EN fout ${r2.status}`;
  }
  console.log(`${r1.ok ? "✓" : "✗ " + r1.status} ${o.name.padEnd(28)} ${String(o.words || 0).padStart(4)} w | ${enMsg}`);
}
console.log(missing ? `${missing} teksten zonder vertaling` : "Alle teksten vertaald.");
