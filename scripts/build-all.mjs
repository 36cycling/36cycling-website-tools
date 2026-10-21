// Bouw alle kindpagina's uit de manifest die nog niet in state.json staan.
// Prestige (al gebouwd/handmatig aangepast) wordt zo automatisch overgeslagen.
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, renderDetail, saveMediaMap } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url);
const statePath = new URL("state.json", root);
const state = existsSync(statePath) ? JSON.parse(await readFile(statePath, "utf8")) : {};
const manifest = JSON.parse(await readFile(new URL("pages/manifest.json", root), "utf8"));
const cfg = await loadConfig();
const map = await loadMediaMap();

const parentId = state["teamkleding-collectie"]?.id;
if (!parentId) { console.error("Ouderpagina ontbreekt in state. Bouw eerst teamkleding-collectie."); process.exit(1); }

let built = 0, skipped = 0;
for (const child of manifest.tree.children) {
  const slug = child.slug;
  try {
    const page = JSON.parse(await readFile(new URL(`pages/${slug}.json`, root), "utf8"));
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
      meta: { _yoast_wpseo_title: page.seo.title, _yoast_wpseo_metadesc: page.seo.metaDescription },
    });
    state[slug] = { id: res.id, link: res.link };
    await writeFile(statePath, JSON.stringify(state, null, 2));
    page.status = { ...page.status, mediaUploaded: true, pageBuilt: true };
    await writeFile(new URL(`pages/${slug}.json`, root), JSON.stringify(page, null, 2));
    console.log(`✓ ${slug}  → id ${res.id}  (media ${media.id}, alt="${media.alt}")`);
    built++;
  } catch (e) {
    console.log(`✗ ${slug}: ${e.message}`);
  }
}
await saveMediaMap(map);
console.log(`\nKlaar: ${built} gebouwd, ${skipped} overgeslagen.`);
