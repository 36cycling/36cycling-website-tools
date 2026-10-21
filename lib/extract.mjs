// Gedeelde extractie-logica voor 36cycling Umbraco-pagina's.
import { load } from "cheerio";

const OLD = "https://www.36cycling.com";
const abs = (u) => (u?.startsWith("http") ? u : `${OLD}${u || ""}`);

// <title> + meta-description van een sectie-/overzichtspagina.
export function extractHead(html) {
  const $ = load(html);
  return {
    title: $("title").text().trim(),
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || "",
    h1: $("h1").first().text().trim(),
  };
}

// Ontdek de directe kindpagina's onder /nl/<section>/ (één niveau diep).
export function discoverChildren(html, section) {
  const re = new RegExp(`href="/nl/${section}/([^"/]+)/"`, "g");
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      slug,
      title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      oldUrl: `${OLD}/nl/${section}/${slug}/`,
      newPath: `/nl/${section}/${slug}/`,
      parentSlug: section,
    });
  }
  return out;
}

// Verbatim-extractie van een STORY-artikel (hero + afwisselende tekst/beeld-kolommen).
export function extractStory(html, entry) {
  const $ = load(html);
  const heroEl = $(".lazy-bg").first();
  const heroSrc = heroEl.attr("lazy-src") ? abs(heroEl.attr("lazy-src").split("?")[0]) : null;
  const hero = { src: heroSrc, title: heroEl.find(".text-block .title").text().trim() };

  // Eén kolom → {type,...} of null. Hero-afbeelding wordt overgeslagen (= featured image).
  const parseCol = ($col) => {
    const bg = $col.find(".lazy-bg").first();
    if (bg.length && bg.attr("lazy-src")) {
      const src = abs(bg.attr("lazy-src").split("?")[0]);
      return src === heroSrc ? null : { type: "image", src };
    }
    const img = $col.find("img").filter((_, el) => /\/(media|fotos)\//.test($(el).attr("src") || "")).first();
    if (img.length) {
      const src = abs(($(img).attr("src") || "").split("?")[0]);
      if (src && src !== heroSrc) return { type: "image", src };
    }
    // Volledige kolominhoud (alinea's, lijsten, kopjes) bewaren.
    const inner = ($col.html() || "").trim();
    if (/<(p|ul|ol|h[1-6])[ >]/i.test(inner)) return { type: "text", html: inner };
    return null;
  };

  const rows = [];
  $(".story").each((_, st) => {
    const cols = [];
    // Zowel volle-breedte (col-md-12) als 2-koloms (col-md-6), in documentvolgorde.
    $(st).find(".col-md-12.column > div, .col-md-6.column > div").each((_, col) => {
      const item = parseCol($(col));
      if (item) cols.push(item);
    });
    if (cols.length) rows.push(cols);
  });
  const canonical = $('link[rel="canonical"]').attr("href") || entry.oldUrl;
  return {
    slug: entry.slug,
    seo: {
      title: $("title").text().trim(),
      metaDescription: $('meta[name="description"]').attr("content")?.trim() || "",
    },
    hero, rows,
    redirect: { from: canonical, to: `https://rondevanrotterdam.nl${entry.newPath}` },
    status: { extracted: true, built: false },
  };
}

// Verbatim-extractie van een detailpagina (story-template).
export function extractDetail(html, entry) {
  const $ = load(html);
  const canonical = $('link[rel="canonical"]').attr("href") || entry.oldUrl;
  const $h1 = $("h1").first();

  let image = null;
  $("div.story img").each((_, el) => {
    if (image) return;
    const src = $(el).attr("src") || "";
    if (/\/(media|fotos)\//.test(src)) image = { src: abs(src), alt: $(el).attr("alt") ?? "" };
  });

  const assets = [];
  $h1.parent().find('a[href$=".pdf"]').each((_, el) =>
    assets.push({ label: $(el).text().trim(), url: abs($(el).attr("href")) }));

  return {
    source: { url: canonical, cms: "Umbraco", crawledAt: new Date().toISOString().slice(0, 10) },
    parentSlug: entry.parentSlug,
    seo: {
      title: $("title").text().trim(),
      metaDescription: $('meta[name="description"]').attr("content")?.trim() || "",
      ogTitle: $('meta[property="og:title"]').attr("content")?.trim() || "",
      ogDescription: $('meta[property="og:description"]').attr("content")?.trim() || "",
      slug: entry.slug,
    },
    headings: { h1: $h1.text().trim(), sections: $h1.parent().find("h2").map((_, el) => $(el).text().trim()).get() },
    features: $h1.parent().find("ul li").map((_, el) => $(el).text().trim()).get(),
    contentHtml: ($h1.parent().html() || "").trim(),
    image,
    assets,
    redirect: { from: canonical, to: `https://rondevanrotterdam.nl${entry.newPath}` },
    status: { extracted: true, mediaUploaded: false, pageBuilt: false, verified: false },
  };
}
