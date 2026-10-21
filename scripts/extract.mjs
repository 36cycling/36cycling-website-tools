// Verbatim-extractor voor 36cycling detailpagina's (Umbraco-template).
// Leest ruwe HTML (met cache in raw/) en schrijft pages/<slug>.json.
// Gebruik: node scripts/extract.mjs [slug1 slug2 ...]   (leeg = alle kinderen uit manifest)
import { load } from "cheerio";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const OLD = "https://www.36cycling.com";
const root = new URL("..", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("pages/manifest.json", root), "utf8"));

const abs = (u) => (u?.startsWith("http") ? u : `${OLD}${u || ""}`);

async function getHtml(slug, url) {
  const cache = new URL(`raw/${slug}.html`, root);
  if (existsSync(cache)) return readFile(cache, "utf8");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const html = await res.text();
  await writeFile(cache, html);
  return html;
}

function extract(html, entry) {
  const $ = load(html);
  const canonical = $('link[rel="canonical"]').attr("href") || entry.oldUrl;

  const $h1 = $("h1").first();
  const contentHtml = ($h1.parent().html() || "").trim();

  // Productafbeelding: eerste <img> in een .story met /media of /fotos in de src.
  let image = null;
  $("div.story img").each((_, el) => {
    if (image) return;
    const src = $(el).attr("src") || "";
    if (/\/(media|fotos)\//.test(src)) {
      image = { src: abs(src), alt: $(el).attr("alt") ?? "" };
    }
  });

  // Eigenschappen-lijst (verbatim).
  const features = [];
  $h1.parent().find("ul li").each((_, el) => features.push($(el).text().trim()));

  // PDF-assets (maattabellen etc.) uit de content.
  const assets = [];
  $h1.parent().find('a[href$=".pdf"]').each((_, el) => {
    assets.push({ label: $(el).text().trim(), url: abs($(el).attr("href")) });
  });

  return {
    source: { url: canonical, cms: "Umbraco", crawledAt: new Date().toISOString().slice(0, 10) },
    parentSlug: entry.parentSlug || "teamkleding-collectie",
    seo: {
      title: $("title").text().trim(),
      metaDescription: $('meta[name="description"]').attr("content")?.trim() || "",
      ogTitle: $('meta[property="og:title"]').attr("content")?.trim() || "",
      ogDescription: $('meta[property="og:description"]').attr("content")?.trim() || "",
      slug: entry.slug,
    },
    headings: {
      h1: $h1.text().trim(),
      sections: $h1.parent().find("h2").map((_, el) => $(el).text().trim()).get(),
    },
    features,
    contentHtml,
    image,
    assets,
    redirect: { from: canonical, to: `https://rondevanrotterdam.nl${entry.newPath}` },
    status: { extracted: true, mediaUploaded: false, pageBuilt: false, verified: false },
  };
}

const wanted = process.argv.slice(2);
const targets = manifest.tree.children.filter((c) => !wanted.length || wanted.includes(c.slug));
await mkdir(new URL("raw/", root), { recursive: true });

for (const entry of targets) {
  try {
    const html = await getHtml(entry.slug, entry.oldUrl);
    const data = extract(html, entry);
    await writeFile(new URL(`pages/${entry.slug}.json`, root), JSON.stringify(data, null, 2));
    const ok = data.headings.h1 && data.image && data.seo.metaDescription;
    console.log(`${ok ? "OK " : "?? "} ${entry.slug}  | h1="${data.headings.h1}" | img=${data.image ? "ja" : "NEE"} | meta=${data.seo.metaDescription ? "ja" : "NEE"}`);
  } catch (e) {
    console.log(`FOUT ${entry.slug}: ${e.message}`);
  }
}
