// Haalt van de oude site per productcategorie de SEO-titel, meta-omschrijving en SEO-tekst (koppen, alinea's, lijsten) op.
// Uitvoer: audit/old-categories.json  { nlTermId: { name, oldUrl, title, metadesc, html, words } }
import { load } from "cheerio";
import { loadConfig } from "../lib/wp.mjs";
import { writeFile } from "node:fs/promises";

const cfg = await loadConfig();
const H = { headers: { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") } };
const cats = await (await fetch(`${cfg.wp.baseUrl}/wp-json/wp/v2/product_cat?lang=nl&per_page=100&_fields=id,name,link`, H)).json();
const SKIP = /inloggen|vriend of vriendin|wachtwoord|winkelwagen|nieuwsbrief/i;
const norm = (s) => s.replace(/\s+/g, " ").trim();
const fixLinks = (h) => norm(h).replace(/<a [^>]*href="([^"]*)"[^>]*>/g, (m, u) =>
  `<a href="${u.replace(/^https?:\/\/(www\.)?36cycling\.com/, "").replace(/^\/nl\/fietskleding\//, "/nl/categorie/fietskleding/")}">`);
const out = {};
for (const c of cats) {
  const oldUrl = "https://www.36cycling.com" + new URL(c.link).pathname.replace("/nl/categorie/", "/nl/");
  const r = await fetch(oldUrl);
  if (!r.ok) { out[c.id] = { name: c.name, oldUrl, status: r.status }; continue; }
  const $ = load(await r.text());
  const title = $("title").text().trim(), metadesc = ($('meta[name="description"]').attr("content") || "").trim();
  $("script,style,header,footer,nav,form").remove();
  const parts = [];
  $("h2,h3,p,ul,ol").each((_, e) => {
    if (!/^(ul|ol)$/.test(e.tagName) && $(e).parents("ul,ol").length) return;
    const t = norm($(e).text());
    if (!t || SKIP.test(t)) return;
    // Blok dat alleen uit links bestaat = oude subcategorie-navigatie → overslaan.
    const linkText = $(e).find("a").map((_, a) => $(a).text()).get().join("").replace(/\s+/g, "");
    if (linkText && linkText === t.replace(/\s+/g, "")) return;
    if (e.tagName === "p" && t.length > 40) parts.push(`<p>${fixLinks($(e).html())}</p>`);
    else if (/^(ul|ol)$/.test(e.tagName)) {
      const lis = $(e).children("li").map((_, li) => `<li>${fixLinks($(li).html())}</li>`).get();
      if (lis.length && t.length > 20) parts.push(`<${e.tagName}>${lis.join("")}</${e.tagName}>`);
    } else if (/^h[23]$/.test(e.tagName)) parts.push({ h: e.tagName, t });
  });
  // Koppen zonder volgende tekst weglaten.
  const html = parts.filter((p, i) => typeof p === "string" || typeof parts[i + 1] === "string")
    .map((p) => (typeof p === "string" ? p : `<${p.h}>${p.t}</${p.h}>`)).join("\n");
  out[c.id] = { name: c.name, oldUrl, title, metadesc, html, words: html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length };
  console.log(`${c.id} ${c.name.padEnd(28)} titel ${title ? "✓" : "-"} meta ${metadesc ? "✓" : "-"} tekst ${out[c.id].words} w`);
}
await writeFile(new URL("../audit/old-categories.json", import.meta.url), JSON.stringify(out, null, 1));
