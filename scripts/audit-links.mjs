// Controleert alle links en knoppen in de content van gepubliceerde pagina's/berichten (standaard NL; --lang=en).
// Meldt: lege links (#), knoppen zonder link, links naar het oude domein, interne links die niet (200) werken.
// Uitvoer: audit/links-<lang>.csv
import { loadConfig } from "../lib/wp.mjs";
import { writeFile } from "node:fs/promises";

const lang = (process.argv.find((a) => a.startsWith("--lang=")) || "--lang=nl").slice(7);
const cfg = await loadConfig();
const H = { headers: { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") } };
const W = cfg.wp.baseUrl + "/wp-json/wp/v2";
const SITE = new URL(cfg.wp.baseUrl).host;

const items = [];
for (const type of ["pages", "posts", "blocks"]) {
  for (let p = 1; p < 10; p++) {
    const r = await fetch(`${W}/${type}?lang=${lang}&status=publish${lang === "en" ? ",draft" : ""}&per_page=100&page=${p}&context=edit&_fields=id,slug,link,content,title`, H);
    if (!r.ok) break; const j = await r.json(); if (!j.length) break;
    items.push(...j.map((x) => ({ ...x, type })));
  }
}
const visible = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const rows = [], cache = {};
async function status(url) {
  if (url in cache) return cache[url];
  try { const r = await fetch(url + (url.includes("?") ? "&" : "?") + "nc=" + Date.now(), { redirect: "manual" }); return (cache[url] = r.status + (r.headers.get("location") ? " → " + r.headers.get("location") : "")); }
  catch { return (cache[url] = "fout"); }
}
for (const it of items) {
  const html = it.content.raw.replace(/<!--[\s\S]*?-->/g, "");
  // <a ...>tekst</a>
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = (m[1].match(/\bhref="([^"]*)"/) || [])[1];
    const text = visible(m[2]).slice(0, 60);
    const isButton = /wp-block-button__link|gspb-buttonbox/.test(m[1]);
    let problem = "";
    if (href === undefined) problem = isButton ? "knop zonder link" : "link zonder href";
    else if (href === "#" || href === "") problem = "leeg (#)";
    else if (/36cycling\.com\/(nl|en)\//.test(href)) problem = "oud domein";
    else if (/^\/|rondevanrotterdam\.nl/.test(href) && !/^#/.test(href) && !/\.(pdf|jpg|png|webp)$/i.test(href)) {
      const abs = href.startsWith("/") ? `https://${SITE}${href}` : href;
      const st = await status(abs.split("#")[0]);
      if (!st.startsWith("200")) problem = "werkt niet: " + st;
    }
    if (problem) rows.push({ type: it.type, id: it.id, slug: it.slug, text, href: href ?? "", problem });
  }
}
const cols = ["type", "id", "slug", "text", "href", "problem"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
await writeFile(new URL(`../audit/links-${lang}.csv`, import.meta.url), "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n"));
console.log(`${items.length} items, ${rows.length} problemen → audit/links-${lang}.csv`);
for (const r of rows) console.log(`${r.slug.slice(0, 34).padEnd(34)} | ${r.text.padEnd(40).slice(0, 40)} | ${(r.href || "").slice(0, 55).padEnd(55)} | ${r.problem}`);
