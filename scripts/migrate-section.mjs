// Volledige sectie-migratie: crawl → extract → bouw parent + kinderen + grid.
// Gebruik: node scripts/migrate-section.mjs <section-slug>
// Bv.: node scripts/migrate-section.mjs sportkleding-collectie
import { load } from "cheerio";
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, renderDetail, renderCollectionGrid } from "../lib/build.mjs";
import { extractHead, discoverChildren, extractDetail } from "../lib/extract.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const OLD = "https://www.36cycling.com";
const NEW = "https://rondevanrotterdam.nl";
const section = process.argv[2];
if (!section) { console.error("Geef een sectie-slug op."); process.exit(1); }

const root = new URL("..", import.meta.url);
const P = (p) => new URL(p, root);
const readJSON = async (p) => JSON.parse(await readFile(P(p), "utf8"));
const writeJSON = (p, o) => writeFile(P(p), JSON.stringify(o, null, 2));

const cfg = await loadConfig();
const map = await loadMediaMap();
const state = existsSync(P("state.json")) ? await readJSON("state.json") : {};
const saveState = () => writeJSON("state.json", state);

await mkdir(P(`pages/${section}`), { recursive: true });
await mkdir(P(`raw/${section}`), { recursive: true });

const fetchCache = async (url, cachePath) => {
  if (existsSync(P(cachePath))) return readFile(P(cachePath), "utf8");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  const html = await r.text();
  await writeFile(P(cachePath), html);
  return html;
};

// 1. Sectiepagina crawlen.
const secHtml = await fetchCache(`${OLD}/nl/${section}/`, `raw/${section}.html`);
const head = extractHead(secHtml);
const children = discoverChildren(secHtml, section);
console.log(`Sectie "${section}": ${head.title} — ${children.length} kindpagina's`);
await writeJSON(`pages/${section}/manifest.json`, { section, head, children });

// 2. Kinderen extraheren.
for (const child of children) {
  const html = await fetchCache(child.oldUrl, `raw/${section}/${child.slug}.html`);
  const data = extractDetail(html, child);
  await writeJSON(`pages/${section}/${child.slug}.json`, data);
}
console.log("Extractie klaar.");

// 3. Parent-container aanmaken (zodat kinderen kunnen nesten).
const parentRes = await upsertPage(cfg, {
  id: state[section]?.id,
  title: head.h1 || head.title,
  slug: section,
  content: `<!-- wp:paragraph -->\n<p>${head.metaDescription}</p>\n<!-- /wp:paragraph -->`,
  status: "draft", lang: "nl",
  meta: { _yoast_wpseo_title: head.title, _yoast_wpseo_metadesc: head.metaDescription },
});
state[section] = { id: parentRes.id, link: parentRes.link };
await saveState();
const parentId = parentRes.id;

// 4. Kinderen bouwen.
let built = 0;
for (const child of children) {
  const key = `${section}/${child.slug}`;
  const page = await readJSON(`pages/${section}/${child.slug}.json`);
  if (!page.image) { console.log(`  ⚠ geen afbeelding: ${child.slug} — overslaan`); continue; }
  const media = await ensureMedia(cfg, map, page.image);
  const res = await upsertPage(cfg, {
    id: state[key]?.id,
    title: page.headings.h1, slug: page.seo.slug, content: renderDetail(page, media),
    status: "draft", parent: parentId, lang: "nl",
    meta: { _yoast_wpseo_title: page.seo.title, _yoast_wpseo_metadesc: page.seo.metaDescription },
  });
  state[key] = { id: res.id, link: res.link };
  await saveState();
  console.log(`  ✓ ${child.slug} → id ${res.id} (media ${media.id}, alt="${media.alt}")`);
  built++;
}

// 5. Hero (eerste content-afbeelding van de sectiepagina) + grid.
const $ = load(secHtml);
let heroSrc = null;
$("img").each((_, el) => { const s = $(el).attr("src") || ""; if (!heroSrc && /\/(media|fotos)\//.test(s)) heroSrc = s.startsWith("http") ? s : OLD + s; });
const hero = heroSrc ? await ensureMedia(cfg, map, { src: heroSrc, alt: `${head.h1 || section} assortiment` }) : null;

const firstParagraph = (html) => {
  const t = load(`<div>${html}</div>`)("p").first().text().trim().replace(/\s+/g, " ");
  return t.length > 160 ? t.slice(0, 157).replace(/\s\S*$/, "") + "…" : t;
};
const items = [];
for (const child of children) {
  const page = await readJSON(`pages/${section}/${child.slug}.json`);
  if (!page.image) continue;
  items.push({ h1: page.headings.h1, media: map[page.image.src.split("?")[0]], snippet: firstParagraph(page.contentHtml), href: child.newPath });
}
await upsertPage(cfg, {
  id: parentId, title: head.h1 || head.title, slug: section,
  content: renderCollectionGrid({ intro: head.metaDescription, hero, items }),
  status: "draft", lang: "nl",
  meta: { _yoast_wpseo_title: head.title, _yoast_wpseo_metadesc: head.metaDescription },
});

// 6. Redirects bijwerken.
const csv = await readFile(P("redirects.csv"), "utf8");
const extra = [`${OLD}/nl/${section}/,${NEW}/nl/${section}/,draft`];
for (const c of children) extra.push(`${c.oldUrl},${NEW}${c.newPath},draft`);
const toAdd = extra.filter((l) => !csv.includes(l.split(",")[0])).join("\n");
if (toAdd) await writeFile(P("redirects.csv"), csv + toAdd + "\n");

console.log(`\nKlaar: parent id ${parentId} + ${built} kinderen + grid (${items.length} producten, hero=${hero ? hero.id : "geen"}).`);
