// Bouw de collectie-overzichtspagina (ouder 1778) als grid van alle producten.
import { load } from "cheerio";
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, renderCollectionGrid } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const cfg = await loadConfig();
const map = await loadMediaMap();
const state = JSON.parse(await readFile(new URL("state.json", root), "utf8"));
const manifest = JSON.parse(await readFile(new URL("pages/manifest.json", root), "utf8"));

const firstParagraph = (html) => {
  const $ = load(`<div>${html}</div>`);
  const t = $("p").first().text().trim().replace(/\s+/g, " ");
  return t.length > 160 ? t.slice(0, 157).replace(/\s\S*$/, "") + "…" : t;
};

// Hero-afbeelding (assortiment) — kreeg op de oude site geen alt; nu wel.
const hero = await ensureMedia(cfg, map, {
  src: "https://www.36cycling.com/media/ebllqp1r/wielerkleding-assortiment.jpg",
  alt: "assortiment customized wielerkleding",
});

const items = [];
for (const child of manifest.tree.children) {
  const page = JSON.parse(await readFile(new URL(`pages/${child.slug}.json`, root), "utf8"));
  const media = map[page.image.src.split("?")[0]];
  items.push({
    h1: page.headings.h1,
    media,
    snippet: firstParagraph(page.contentHtml),
    href: child.newPath, // /nl/teamkleding-collectie/<slug>/ (relatief → werkt)
  });
}

const intro = "Voor het ontwerpen en produceren van customized wielerkleding voor een team, club of bedrijf hanteren we een collectie wielerkleding voor elke type wielrenner.";
const content = renderCollectionGrid({ intro, hero, items });

const res = await upsertPage(cfg, {
  id: state["teamkleding-collectie"].id,
  title: "Teamkleding collectie",
  slug: "teamkleding-collectie",
  content,
  status: "draft",
  lang: "nl",
  meta: {
    _yoast_wpseo_title: "Team wielerkleding collectie",
    _yoast_wpseo_metadesc: "Voor het ontwerpen en produceren van customized wielerkleding voor een team, club of bedrijf hanteren we een collectie wielerkleding voor elke type wielrenner.",
  },
});
console.log(`Collectiepagina bijgewerkt → id ${res.id} | ${items.length} producten in grid | hero-alt="${hero.alt}"`);
