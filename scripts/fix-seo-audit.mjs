// Fixes uit de SEO-audit (oktober 2026). Vult alleen LEGE Yoast-velden, behalve
// de 3 dubbele titels die door de migratie zelf gezet zijn.
import { loadConfig, setMediaAlt } from "../lib/wp.mjs";
import { readFile } from "node:fs/promises";

const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const API = cfg.wp.baseUrl + "/wp-json/wp/v2";
const get = async (p) => (await fetch(API + p, { headers: AUTH })).json();
const post = async (p, body) => {
  const r = await fetch(API + p, { method: "POST", headers: { ...AUTH, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${p} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};
const report = JSON.parse(await readFile(new URL("../audit/report.json", import.meta.url), "utf8"));
const old = (path) => report.rows.find((r) => r.path === path) || {};
const withSuffix = (t) => (/36 Cycling/i.test(t) ? t : t + cfg.seoTitleSuffix);
const log = (...a) => console.log(...a);

// 1. Sitenaam
const s = await post("/settings", { title: "36 Cycling" });
log(`✓ Sitenaam → "${s.title}"`);

// 2. SEO-titels + meta's (alleen lege velden vullen)
const seo = [
  { type: "pages", id: 2, title: old("/nl/").oldTitle, desc: old("/nl/").oldMeta },
  { type: "pages", id: 6280, title: old("/nl/wielerkleding-bedrukken/").oldTitle, desc: old("/nl/wielerkleding-bedrukken/").oldMeta },
  { type: "pages", id: 6430, title: old("/nl/sportkleding-bedrukken/").oldTitle, desc: old("/nl/sportkleding-bedrukken/").oldMeta },
  { type: "pages", id: 18, title: old("/nl/contact/").oldTitle, desc: old("/nl/contact/").oldMeta },
  { type: "pages", id: 16, title: "Stories", desc: "Verhalen, tips en nieuws van 36 Cycling: van wielerkleding wassen en de juiste zeem tot de Zesdaagse van Rotterdam en de GP Groot Wintercompetitie." },
  { type: "pages", id: 939, title: "Over 36 Cycling", desc: old("/nl/over-36/").oldMeta, slug: "over-36" },
  { type: "pages", id: 935, title: "Ruilen en Retourneren", desc: "Een aankoop uit onze webshop ruilen of retourneren? Dat kan binnen 2 weken na ontvangst. Lees hoe het werkt en waar je je retour naartoe stuurt.", slug: "ruilen-en-retourneren" },
  { type: "posts", id: 2073, desc: "Kou, regen en kortere dagen: zo blijf je comfortabel fietsen in de herfst. Praktische tips van 36 Cycling over kledinglagen en de juiste fietskleding." },
  { type: "posts", id: 2069, desc: "Sinds 2014 is 36 Cycling official supplier van de wielerkleding tijdens de Zesdaagse van Rotterdam. Lees het verhaal achter de truien in Rotterdam Ahoy." },
  { type: "posts", id: 2077, desc: "Nieuwe baanwedstrijden in Sportpaleis Alkmaar, opgezet door Niki Terpstra, Laurens ten Dam en Reinier Honig. 36 Cycling is trotse kledingpartner." },
  { type: "posts", id: 2084, desc: "Wat is de beste zeem voor jouw wielerbroek? We leggen uit waar je op let en zetten onze zemen op een rij: PARIS HP, DOLOMITI en ENDURANCE JOY.", replaceShort: true },
  { type: "posts", id: 2011, desc: "Hoe zorg je het beste voor je wielerkleding? In drie stappen: vooraf wassen, wassen op maximaal 30 graden en drogen met zorg.", replaceShort: true },
];
for (const x of seo) {
  const cur = await get(`/${x.type}/${x.id}?context=edit&_fields=slug,meta,title`);
  const meta = {}, body = {};
  if (x.title && !cur.meta._yoast_wpseo_title) meta._yoast_wpseo_title = withSuffix(x.title);
  const curDesc = cur.meta._yoast_wpseo_metadesc || "";
  if (x.desc && (!curDesc || (x.replaceShort && curDesc.length < 70))) meta._yoast_wpseo_metadesc = x.desc;
  if (x.slug && cur.slug !== x.slug) body.slug = x.slug;
  if (Object.keys(meta).length) body.meta = meta;
  if (!Object.keys(body).length) { log(`— ${x.type}#${x.id} "${cur.title.raw}": al gevuld, overgeslagen`); continue; }
  const res = await post(`/${x.type}/${x.id}`, body);
  log(`✓ ${x.type}#${x.id} "${cur.title.raw}"${body.slug ? ` slug→${res.slug}` : ""}${meta._yoast_wpseo_title ? ` | title→"${meta._yoast_wpseo_title}"` : ""}${meta._yoast_wpseo_metadesc ? ` | meta (${meta._yoast_wpseo_metadesc.length})` : ""}`);
}

// 3. Dubbele titels: sportvarianten onderscheiden
const state = JSON.parse(await readFile(new URL("../state.json", import.meta.url), "utf8"));
for (const [slug, t] of [["warming-up-broek", "Warming-up broek voor sport ontwerpen en bedrukken"], ["all-season-jack", "All season jack voor sport ontwerpen en bedrukken"], ["wintermuts", "Wintermuts voor sport ontwerpen en bedrukken"]]) {
  const id = state[`sportkleding-collectie/${slug}`].id;
  await post(`/pages/${id}`, { meta: { _yoast_wpseo_title: withSuffix(t) } });
  log(`✓ dubbele titel opgelost: sportkleding-collectie/${slug} → "${withSuffix(t)}"`);
}

// 4. Klantenlogos-blok: lege alts invullen (blok + mediabibliotheek)
const LOGOS = { "customer-stedin.jpg": "Stedin", "customer-dhl.jpg": "DHL", "customer-karcher.jpg": "Kärcher", "customer-quooker.jpg": "Quooker", "customer-als.jpg": "Stichting ALS Nederland", "customer-bicycling.jpg": "Bicycling", "customer-ahoy.jpg": "Rotterdam Ahoy", "customer-schaatsbaan.jpg": "Schaatsbaan Rotterdam", "customer-rpo.jpg": "Rotterdams Philharmonisch Orkest" };
const blk = await get("/blocks/6240?context=edit");
let raw = blk.content.raw, n = 0;
raw = raw.replace(/<img[^>]*>/g, (tag) => {
  const file = ((tag.match(/src="([^"]+)"/) || [])[1] || "").split("/").pop();
  if (LOGOS[file] && /alt=""/.test(tag)) { n++; return tag.replace('alt=""', `alt="${LOGOS[file]}"`); }
  return tag;
});
await post("/blocks/6240", { content: raw });
log(`✓ Klantenlogos-blok: ${n} alt-teksten ingevuld`);
for (const m of await get(`/media?search=customer-&per_page=50&context=edit&_fields=id,source_url,alt_text`)) {
  const f = m.source_url.split("/").pop();
  if (LOGOS[f] && !m.alt_text) { await setMediaAlt(cfg, m.id, LOGOS[f]); log(`  ✓ media #${m.id} ${f} → "${LOGOS[f]}"`); }
}

// 5. Test-/conceptpagina's offline (terug naar concept)
for (const id of [969, 6026]) {
  const r = await post(`/pages/${id}`, { status: "draft" });
  log(`✓ #${id} "${r.title.raw}" → ${r.status}`);
}
