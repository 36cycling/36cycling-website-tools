// Bouw één pagina in WordPress (concept). Regelt media, blok-content,
// hiërarchie (parent), WPML-taal (nl) en Yoast-meta.
// Gebruik: node scripts/build-page.mjs <slug>
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, renderDetail } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url);
const statePath = new URL("state.json", root);
const loadState = async () => (existsSync(statePath) ? JSON.parse(await readFile(statePath, "utf8")) : {});
const saveState = async (s) => writeFile(statePath, JSON.stringify(s, null, 2));

const slug = process.argv[2];
if (!slug) { console.error("Geef een slug op."); process.exit(1); }

const cfg = await loadConfig();
const state = await loadState();
const map = await loadMediaMap();

// Parent-collectiepagina (listing) — voorlopig met intro; grid volgt later.
if (slug === "teamkleding-collectie") {
  const content = `<!-- wp:paragraph -->\n<p>Voor het ontwerpen en produceren van customized wielerkleding voor een team, club of bedrijf hanteren we een collectie wielerkleding voor elke type wielrenner.</p>\n<!-- /wp:paragraph -->`;
  const res = await upsertPage(cfg, {
    id: state[slug]?.id,
    title: "Teamkleding collectie",
    slug,
    content,
    status: "draft",
    lang: "nl",
    meta: {
      _yoast_wpseo_title: "Team wielerkleding collectie",
      _yoast_wpseo_metadesc: "Voor het ontwerpen en produceren van customized wielerkleding voor een team, club of bedrijf hanteren we een collectie wielerkleding voor elke type wielrenner.",
    },
  });
  state[slug] = { id: res.id, link: res.link };
  await saveState(state);
  console.log(`Ouder OK → id ${res.id} | ${res.link} | status ${res.status}`);
  process.exit(0);
}

// Detailpagina.
const page = JSON.parse(await readFile(new URL(`pages/${slug}.json`, root), "utf8"));
const parentId = page.parentSlug ? state[page.parentSlug]?.id : undefined;
if (page.parentSlug && !parentId) {
  console.error(`Ouder "${page.parentSlug}" bestaat nog niet in WP. Bouw die eerst.`);
  process.exit(1);
}

const media = await ensureMedia(cfg, map, page.image);
const content = renderDetail(page, media);
const res = await upsertPage(cfg, {
  id: state[slug]?.id,
  title: page.headings.h1,
  slug: page.seo.slug,
  content,
  status: "draft",
  parent: parentId,
  lang: "nl",
  meta: {
    _yoast_wpseo_title: page.seo.title,
    _yoast_wpseo_metadesc: page.seo.metaDescription,
  },
});

state[slug] = { id: res.id, link: res.link };
await saveState(state);
page.status = { ...page.status, mediaUploaded: true, pageBuilt: true };
await writeFile(new URL(`pages/${slug}.json`, root), JSON.stringify(page, null, 2));

// Yoast-meta terugcontrole.
const yoast = res.yoast_head_json || {};
console.log(`OK → id ${res.id} | ${res.link} | status ${res.status}`);
console.log(`   afbeelding: media-id ${media.id}, alt="${media.alt}"`);
console.log(`   Yoast title in respons: ${res.meta?._yoast_wpseo_title ? "gezet" : "(check nodig)"}`);
