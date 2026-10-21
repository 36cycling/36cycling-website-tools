// Bouwstenen: media-upload (met dedup) + omzetten van geëxtraheerde
// content naar Gutenberg-blok-markup in de stijl van template 969 (patroon 04).
import { load } from "cheerio";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { uploadMedia, setMediaAlt } from "./wp.mjs";

const root = new URL("..", import.meta.url);
const mapPath = new URL("media-map.json", root);

export async function loadMediaMap() {
  if (existsSync(mapPath)) return JSON.parse(await readFile(mapPath, "utf8"));
  return {};
}
export async function saveMediaMap(map) {
  await writeFile(mapPath, JSON.stringify(map, null, 2));
}

// Download een externe afbeelding en upload naar WP; hergebruik via media-map.
// Strip ALTIJD de query (?width=...&crop=...) → we halen het ORIGINELE
// root-bestand op, niet een uitgesneden/verkleinde crop.
export async function ensureMedia(cfg, map, { src, alt, updateAlt }) {
  const cleanSrc = src.split("?")[0];
  if (map[cleanSrc]) {
    // Alt bijwerken op reeds geüploade media als expliciet gevraagd.
    if (updateAlt && alt && map[cleanSrc].alt !== alt) {
      await setMediaAlt(cfg, map[cleanSrc].id, alt);
      map[cleanSrc].alt = alt;
      await saveMediaMap(map);
    }
    return map[cleanSrc];
  }
  const res = await fetch(cleanSrc);
  if (!res.ok) throw new Error(`Download mislukt ${cleanSrc} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const filename = decodeURIComponent(cleanSrc.split("/").pop());
  const localPath = new URL(`media/${filename}`, root);
  await writeFile(localPath, buf);
  const media = await uploadMedia(cfg, {
    filePath: localPath,
    filename,
    altText: alt || "",
    title: filename.replace(/\.[a-z]+$/i, "").replace(/[-_]/g, " "),
  });
  const entry = { id: media.id, url: media.source_url, alt: media.alt_text };
  map[cleanSrc] = entry;
  await saveMediaMap(map);
  return entry;
}

// ---------- Blok-helpers ----------
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const heading = (text, level = 2, { size } = {}) => {
  const id = slug(text);
  const attrs = { ...(level !== 2 ? { level } : {}), ...(size ? { fontSize: size } : {}), anchor: id };
  const cls = `wp-block-heading${size ? ` has-${size}-font-size` : ""}`;
  return `<!-- wp:heading ${JSON.stringify(attrs)} -->\n<h${level} id="${id}" class="${cls}">${text}</h${level}>\n<!-- /wp:heading -->`;
};
const breadcrumbs = () => `<!-- wp:blocksy/breadcrumbs /-->`;
const paragraph = (html) => `<!-- wp:paragraph -->\n<p>${html}</p>\n<!-- /wp:paragraph -->`;
const list = (itemsHtml, ordered = false) => {
  const tag = ordered ? "ol" : "ul";
  const attrs = ordered ? ' {"ordered":true}' : "";
  return `<!-- wp:list${attrs} -->\n<${tag} class="wp-block-list">` +
    itemsHtml.map((i) => `<!-- wp:list-item -->\n<li>${i}</li>\n<!-- /wp:list-item -->`).join("\n\n") +
    `</${tag}>\n<!-- /wp:list -->`;
};

// Zet losse content-HTML (p, ul, ol, h1-h6) om naar Gutenberg-blokken, in volgorde.
function htmlToBlocks(html) {
  const $ = load(`<div id="r">${html}</div>`);
  const out = [];
  $("#r").children().each((_, el) => {
    const tag = (el.tagName || "").toLowerCase();
    const $el = $(el);
    if (/^h[1-6]$/.test(tag)) { out.push(heading($el.text().trim(), Math.max(2, +tag[1]))); return; }
    if (tag === "ul" || tag === "ol") {
      out.push(list($el.find("> li").map((_, li) => $(li).html().trim()).get(), tag === "ol"));
      return;
    }
    const inner = ($el.html() || "").trim();
    if (inner && inner.replace(/&nbsp;|\s/g, "").length) out.push(paragraph(inner));
  });
  return out.join("\n\n");
}
// href optioneel → maakt de foto aanklikbaar (linkt naar de detailpagina).
const image = ({ id, url, alt }, href) => {
  const img = `<img src="${url}" alt="${(alt || "").replace(/"/g, "&quot;")}" class="wp-image-${id}"/>`;
  const inner = href ? `<a href="${href}">${img}</a>` : img;
  const dest = href ? "custom" : "none";
  return `<!-- wp:image {"id":${id},"sizeSlug":"full","linkDestination":"${dest}"} -->\n` +
    `<figure class="wp-block-image size-full">${inner}</figure>\n<!-- /wp:image -->`;
};

// Grid-kolom: onderrand 1px + ruimte eronder (streepje behouden), zónder inspring-padding.
const gridColumn = (inner) => {
  const attrs = '{"style":{"spacing":{"padding":{"bottom":"var:preset|spacing|40"}},"border":{"bottom":{"width":"1px"}}}}';
  const style = 'border-bottom-width:1px;padding-bottom:var(--wp--preset--spacing--40)';
  return `<!-- wp:column ${attrs} -->\n<div class="wp-block-column" style="${style}">${inner}</div>\n<!-- /wp:column -->`;
};
const buttons = (items) => `<!-- wp:buttons -->\n<div class="wp-block-buttons">` +
  items.map((b, i) => {
    const style = i === 0 ? "is-style-fill" : "is-style-outline";
    const href = b.href ? ` href="${b.href}"${/^https?:/.test(b.href) ? ' rel="noopener" target="_blank"' : ""}` : "";
    return `<!-- wp:button {"className":"${style}"} -->\n<div class="wp-block-button ${style}"><a class="wp-block-button__link wp-element-button"${href}>${b.text}</a></div>\n<!-- /wp:button -->`;
  }).join("\n\n") + `</div>\n<!-- /wp:buttons -->`;

// Kale kolom, zonder inspring-padding (op verzoek overal verwijderd).
const column = (inner) => `<!-- wp:column -->\n<div class="wp-block-column">${inner}</div>\n<!-- /wp:column -->`;
const columns = (cols) => `<!-- wp:columns -->\n<div class="wp-block-columns">${cols.join("\n\n")}</div>\n<!-- /wp:columns -->`;

// Losse blok-helpers herbruikbaar maken (bv. voor bespoke pagina's).
export const blocks = { heading, paragraph, list, image, buttons, column, gridColumn, columns, breadcrumbs };

// Zet geëxtraheerde detailpagina-content om naar het 2-koloms blokpatroon.
// media = {id,url,alt} van de reeds geüploade afbeelding.
export function renderDetail(page, media) {
  const $ = load(`<div id="r">${page.contentHtml}</div>`);
  const $r = $("#r");
  // H1 = productnaam, grootte x-large (zoals handmatig ingesteld op Prestige).
  const textBlocks = [heading(page.headings.h1, 1, { size: "x-large" })];

  $r.children().each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const $el = $(el);
    if (tag === "h1") return; // al toegevoegd
    if (tag === "h2") { textBlocks.push(heading($el.text().trim(), 3, { size: "medium" })); return; }
    if (tag === "ul") { textBlocks.push(list($el.find("li").map((_, li) => $(li).html().trim()).get())); return; }
    if (tag === "p") {
      const btns = $el.find('a[class*="btn"]');
      if (btns.length) {
        textBlocks.push(buttons(btns.map((_, a) => ({ text: $(a).text().trim(), href: $(a).attr("href") })).get()));
      } else {
        textBlocks.push(paragraph($el.html().trim()));
      }
      return;
    }
    textBlocks.push(paragraph($el.html().trim()));
  });

  // Padnavigatie (breadcrumbs) bovenaan, daarna de 2-koloms opmaak.
  return [
    breadcrumbs(),
    columns([
      column(image(media), { pad: true }),
      column(textBlocks.join("\n\n"), { pad: true }),
    ]),
  ].join("\n\n");
}

// Story-artikel: afwisselende tekst/beeld-kolommen (hero = featured image, apart gezet).
// resolved = { <src>: {id,url,alt} } van reeds geüploade afbeeldingen.
export function renderStory(story, resolved) {
  const out = [breadcrumbs()];
  const colContent = (c) => c.type === "image" ? image(resolved[c.src]) : htmlToBlocks(c.html);
  for (const row of story.rows) {
    if (row.length === 1) {
      out.push(colContent(row[0])); // volle breedte
    } else {
      out.push(columns(row.map((c) => column(colContent(c)))));
    }
  }
  return out.join("\n\n");
}

// Overzichtspagina: hero + intro + grid van producten (3 per rij),
// elk met foto, titel, korte tekst en 'Meer info'-knop → detailpagina.
// Spiegelt patroon 03 uit template 969.
export function renderCollectionGrid({ intro, hero, items }) {
  const blocks = [breadcrumbs()];
  if (hero) blocks.push(image(hero));
  if (intro) blocks.push(paragraph(intro));
  for (let i = 0; i < items.length; i += 3) {
    const rowCols = items.slice(i, i + 3).map((it) =>
      gridColumn([
        image(it.media, it.href), // foto aanklikbaar → detailpagina
        heading(it.h1, 4),
        paragraph(it.snippet),
        buttons([{ text: "Meer info", href: it.href }]),
      ].join("\n\n"))
    );
    blocks.push(columns(rowCols));
  }
  return blocks.join("\n\n");
}
