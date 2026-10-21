// Migreer 36cycling stories → WordPress berichten (/nl/stories/<slug>/).
// Gebruik: node scripts/migrate-stories.mjs [slug]   (leeg = alle 5)
import { loadConfig, upsertPost, ensureCategory } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, renderStory } from "../lib/build.mjs";
import { extractStory } from "../lib/extract.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const OLD = "https://www.36cycling.com";
const NEW = "https://rondevanrotterdam.nl";
const root = new URL("..", import.meta.url);
const P = (p) => new URL(p, root);

const STORIES = [
  "36-cycling-x-zesdaagse-van-rotterdam",
  "fietskleding-in-de-herfst",
  "gp-groot-wintercompetitie",
  "wielerkleding-wassen",
  "zemen",
];

const cfg = await loadConfig();
const map = await loadMediaMap();
const state = existsSync(P("state.json")) ? JSON.parse(await readFile(P("state.json"), "utf8")) : {};
await mkdir(P("raw/stories"), { recursive: true });
await mkdir(P("pages/stories"), { recursive: true });

// Categorieën aanmaken (NL) + koppeling per story.
const catWieler = await ensureCategory(cfg, { name: "Wielerkleding", slug: "wielerkleding", lang: "nl" });
const catNieuws = await ensureCategory(cfg, { name: "Nieuws & events", slug: "nieuws-events", lang: "nl" });
const NIEUWS = new Set(["gp-groot-wintercompetitie", "36-cycling-x-zesdaagse-van-rotterdam"]);
console.log(`Categorieën: Wielerkleding=${catWieler}, Nieuws & events=${catNieuws}`);

// Alt-tekst afleiden uit de bijbehorende stap-tekst.
const labelFrom = (html) => {
  // Alleen een label gebruiken als een alinea BEGINT met een korte <strong>-kop.
  const m = (html || "").match(/<p[^>]*>\s*<strong>(.*?)<\/strong>/i);
  if (!m) return "";
  const label = m[1].replace(/&nbsp;/g, " ").replace(/^\s*stap\s*\d+\s*[:.\-]?\s*/i, "").trim();
  if (label.length < 3 || label.length > 35 || /^\d+$/.test(label)) return ""; // geen zin/nummer
  return label;
};

const only = process.argv[2];
const targets = only ? STORIES.filter((s) => s === only) : STORIES;

for (const slug of targets) {
  const oldUrl = `${OLD}/nl/stories/${slug}/`;
  const cache = P(`raw/stories/${slug}.html`);
  const html = existsSync(cache) ? await readFile(cache, "utf8") : await (async () => {
    const r = await fetch(oldUrl); if (!r.ok) throw new Error(`${oldUrl} → ${r.status}`);
    const t = await r.text(); await writeFile(cache, t); return t;
  })();

  const story = extractStory(html, { slug, oldUrl, newPath: `/nl/stories/${slug}/` });
  await writeFile(P(`pages/stories/${slug}.json`), JSON.stringify(story, null, 2));

  // Afbeeldingen uploaden met gegenereerde alt (afgeleid uit de bijbehorende tekst).
  const altBase = story.seo.title;
  const hero = story.hero.src ? await ensureMedia(cfg, map, { src: story.hero.src, alt: story.hero.title || altBase, updateAlt: true }) : null;
  const resolved = {};
  for (const row of story.rows) {
    const textCol = row.find((c) => c.type === "text");
    const label = textCol ? labelFrom(textCol.html) : "";
    for (const c of row) {
      if (c.type === "image" && !resolved[c.src]) {
        const alt = label ? `${altBase} – ${label}` : altBase;
        resolved[c.src] = await ensureMedia(cfg, map, { src: c.src, alt, updateAlt: true });
      }
    }
  }

  const content = renderStory(story, resolved);
  const res = await upsertPost(cfg, {
    id: state[`stories/${slug}`]?.id,
    title: story.seo.title, slug, content, status: "draft", lang: "nl",
    featured_media: hero ? hero.id : undefined,
    categories: [NIEUWS.has(slug) ? catNieuws : catWieler],
    meta: { _yoast_wpseo_title: story.seo.title, _yoast_wpseo_metadesc: story.seo.metaDescription },
  });
  state[`stories/${slug}`] = { id: res.id, link: res.link, type: "post" };
  await writeFile(P("state.json"), JSON.stringify(state, null, 2));

  const csv = await readFile(P("redirects.csv"), "utf8");
  const line = `${oldUrl},${NEW}/nl/stories/${slug}/,draft`;
  if (!csv.includes(oldUrl)) await writeFile(P("redirects.csv"), csv + line + "\n");

  const imgs = Object.keys(resolved).length + (hero ? 1 : 0);
  console.log(`✓ ${slug} → post ${res.id} | hero=${hero ? hero.id : "geen"} | ${story.rows.length} rijen | ${imgs} afbeeldingen`);
}
