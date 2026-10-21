// SEO-audit: oude 36cycling.com-pagina's vs nieuwe rondevanrotterdam.nl-pagina's.
// Gebruik: node scripts/audit-seo.mjs   → audit/report.json + audit/report.csv
import { load } from "cheerio";
import { readFile, writeFile } from "node:fs/promises";

const OLD = "https://www.36cycling.com";
const NEW = "https://rondevanrotterdam.nl";
const SUFFIX = " | 36 Cycling";
const root = new URL("..", import.meta.url);
const P = (p) => new URL(p, root);
const UA = { "User-Agent": "Mozilla/5.0 (SEO-audit migratie)" };

// ---------- helpers ----------
async function fetchChain(url, max = 6) {
  const chain = [];
  let cur = url;
  for (let i = 0; i < max; i++) {
    const r = await fetch(cur, { redirect: "manual", headers: UA });
    chain.push({ url: cur, status: r.status });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      cur = new URL(r.headers.get("location"), cur).href;
      continue;
    }
    const html = r.status === 200 ? await r.text() : "";
    return { finalUrl: cur, status: r.status, chain, html, xrobots: r.headers.get("x-robots-tag") || "" };
  }
  return { finalUrl: cur, status: "LOOP", chain, html: "", xrobots: "" };
}

const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const words = (s) => norm(s).split(" ").filter((w) => /[a-zA-Z0-9à-ÿ]/.test(w)).length;
const UI_IMG = /logo|icon|loading|close\.gif|shopping|arrow\.png|gravatar|emoji|flag/i;

function extract(html, site) {
  const $ = load(html);
  const meta = (n) => norm($(`meta[name="${n}"]`).attr("content"));
  const prop = (n) => norm($(`meta[property="${n}"]`).attr("content"));
  const out = {
    title: norm($("title").first().text()),
    metaDesc: meta("description"),
    canonical: $('link[rel="canonical"]').attr("href") || "",
    robots: meta("robots"),
    ogTitle: prop("og:title"), ogDesc: prop("og:description"), ogImage: prop("og:image"),
    hreflang: $('link[rel="alternate"][hreflang]').map((_, e) => $(e).attr("hreflang")).get(),
    jsonld: $('script[type="application/ld+json"]').length,
  };
  // content-scope
  $("script,style,noscript,form,header,footer,nav").remove();
  let $scope;
  if (site === "old") {
    $("#loginpopupnew,#formLogin,#formForgot,#formSAF,.popup").remove();
    $scope = $(".umb-grid").length ? $(".umb-grid") : $("body");
  } else {
    $('[class*="ct-popup"],.ct-panel,#offcanvas,[class*="offcanvas"],.ct-header,.ct-footer,[data-id="footer"]').remove();
    $scope = $("main").length ? $("main") : $("body");
  }
  out.h1 = $scope.find("h1").map((_, e) => norm($(e).text())).get();
  if (!out.h1.length) out.h1 = $("h1").map((_, e) => norm($(e).text())).get();
  out.h2 = $scope.find("h2").length;
  out.words = words($scope.text());
  const imgs = $scope.find("img").filter((_, e) => !UI_IMG.test($(e).attr("src") || ""));
  out.imgs = imgs.length;
  out.imgNoAlt = imgs.filter((_, e) => !norm($(e).attr("alt"))).map((_, e) => ($(e).attr("src") || "").split("/").pop()).get();
  out.links = $scope.find("a[href]").map((_, e) => $(e).attr("href")).get();
  return out;
}

async function pool(items, n, fn) {
  const res = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}

// ---------- 1. oude URL's ophalen en naar canonical oplossen ----------
const sitemap = await readFile(P("audit/old-sitemap.xml"), "utf8");
const oldUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
console.log(`Oude sitemap: ${oldUrls.length} URL's — oplossen…`);

const resolved = await pool(oldUrls, 8, async (u) => {
  const r = await fetchChain(u);
  const d = r.status === 200 ? extract(r.html, "old") : null;
  const canon = d?.canonical ? new URL(d.canonical, r.finalUrl).href : r.finalUrl;
  return { sitemapUrl: u, finalUrl: r.finalUrl, oldStatus: r.status, hops: r.chain.length - 1, canonical: canon, data: d };
});

// Uniek per canonical pad; webshop apart.
const byPath = new Map();
const legacy = []; // sitemap-URL's die (via redirect) op een andere URL uitkomen
for (const r of resolved) {
  const path = new URL(r.canonical).pathname;
  if (r.sitemapUrl !== r.finalUrl || new URL(r.sitemapUrl).pathname !== path) legacy.push({ from: r.sitemapUrl, to: r.canonical, hops: r.hops, status: r.oldStatus });
  if (!byPath.has(path) || (r.sitemapUrl === r.canonical)) byPath.set(path, r);
}
const isShop = (p) => /^\/nl\/(shop|fietskleding)\b|^\/(shop|fietskleding)\b/.test(p);
const marketing = [...byPath.entries()].filter(([p, r]) => r.oldStatus === 200 && !isShop(p));
const shop = [...byPath.entries()].filter(([p, r]) => r.oldStatus === 200 && isShop(p));
const oldBroken = [...byPath.entries()].filter(([, r]) => r.oldStatus !== 200);
console.log(`Unieke canonieke pagina's: ${byPath.size} | marketing: ${marketing.length} | webshop: ${shop.length} | oud niet-200: ${oldBroken.length}`);

// ---------- 2. nieuwe pagina's ophalen ----------
const pairs = await pool(marketing, 8, async ([path, o]) => {
  const n = await fetchChain(NEW + path + "?nc=" + Date.now()); n.finalUrl = n.finalUrl.split("?")[0];
  const d = n.status === 200 ? extract(n.html, "new") : null;
  return { path, old: o, newStatus: n.status, newFinal: n.finalUrl, newHops: n.chain.length - 1, xrobots: n.xrobots, nw: d };
});

// ---------- 3. vergelijken ----------
const stripSuffix = (t) => t.replace(/\s*\|\s*36 Cycling\s*$/i, "").replace(/\s*-\s*Just Deploy It!?\s*$/i, "").trim();
const rows = [];
for (const p of pairs) {
  const o = p.old.data, n = p.nw, issues = [];
  if (p.newStatus !== 200) issues.push(`NIEUW ONTBREEKT (HTTP ${p.newStatus})`);
  else {
    if (p.newFinal.replace(/\/$/, "") !== (NEW + p.path).replace(/\/$/, "")) issues.push(`redirect naar ${p.newFinal}`);
    if (/noindex/i.test(n.robots) || /noindex/i.test(p.xrobots)) issues.push("NOINDEX");
    const canonPath = n.canonical ? new URL(n.canonical, p.newFinal).pathname : "";
    if (!n.canonical) issues.push("geen canonical");
    else if (canonPath !== new URL(p.newFinal).pathname) issues.push(`canonical wijst naar ${n.canonical}`);
    if (!n.title) issues.push("geen title");
    else {
      if (/Just Deploy It/i.test(n.title)) issues.push("title = WordPress-standaard (geen Yoast-titel)");
      if (stripSuffix(n.title).toLowerCase() !== stripSuffix(o?.title || "").toLowerCase()) issues.push("title gewijzigd");
      if (n.title.length > 65) issues.push(`title lang (${n.title.length})`);
    }
    if (!n.metaDesc) issues.push("GEEN meta-description");
    else {
      if (o?.metaDesc && norm(n.metaDesc).toLowerCase() !== norm(o.metaDesc).toLowerCase()) issues.push("meta gewijzigd");
      if (n.metaDesc.length > 160) issues.push(`meta lang (${n.metaDesc.length})`);
      if (n.metaDesc.length < 70) issues.push(`meta kort (${n.metaDesc.length})`);
    }
    if (!n.h1.length) issues.push("GEEN H1");
    if (n.h1.length > 1) issues.push(`${n.h1.length}× H1`);
    if (o?.h1?.[0] && n.h1[0] && norm(o.h1[0]).toLowerCase() !== norm(n.h1[0]).toLowerCase()) issues.push("H1 gewijzigd");
    if (n.imgNoAlt.length) issues.push(`${n.imgNoAlt.length} img zonder alt`);
    if (o && o.words > 80 && n.words < o.words * 0.7) issues.push(`MINDER TEKST (${o.words}→${n.words})`);
    if (!n.ogImage) issues.push("geen og:image");
  }
  rows.push({
    path: p.path, newStatus: p.newStatus, issues,
    oldTitle: o?.title || "", newTitle: n?.title || "",
    oldMeta: o?.metaDesc || "", newMeta: n?.metaDesc || "",
    oldH1: o?.h1?.join(" / ") || "", newH1: n?.h1?.join(" / ") || "",
    oldWords: o?.words ?? "", newWords: n?.words ?? "",
    oldImgs: o?.imgs ?? "", newImgs: n?.imgs ?? "", newImgNoAlt: n?.imgNoAlt?.join(" ") || "",
    canonical: n?.canonical || "", robots: n?.robots || "", hreflang: n?.hreflang?.join(",") || "", jsonld: n?.jsonld ?? "",
    links: n?.links || [],
  });
}

// Dubbele titles/metas op de nieuwe site.
const dupe = (key) => {
  const m = new Map();
  for (const r of rows) if (r[key]) m.set(r[key], [...(m.get(r[key]) || []), r.path]);
  return [...m.entries()].filter(([, v]) => v.length > 1);
};

// ---------- 4. interne links op nieuwe pagina's ----------
const internal = new Set();
for (const r of rows) for (const h of r.links) {
  if (!h || h.startsWith("#") || /^(mailto|tel|javascript):/i.test(h)) continue;
  try {
    const u = new URL(h, NEW + r.path);
    if (u.hostname === "rondevanrotterdam.nl" || u.hostname === "www.36cycling.com") { u.hash = ""; internal.add(u.href); }
  } catch {}
}
const linkStatus = await pool([...internal], 8, async (u) => {
  const r = await fetchChain(u);
  return { url: u, status: r.status, final: r.finalUrl };
});
const brokenLinks = linkStatus.filter((l) => l.status !== 200);
const linkSources = (u) => rows.filter((r) => r.links.some((h) => { try { const x = new URL(h, NEW + r.path); x.hash = ""; return x.href === u; } catch { return false; } })).map((r) => r.path);

// ---------- 5. Yoast-sitemap ----------
const smIndex = await (await fetch(NEW + "/nl/sitemap_index.xml", { headers: UA })).text();
const smUrls = [];
for (const sm of [...smIndex.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) {
  const x = await (await fetch(sm, { headers: UA })).text();
  smUrls.push(...[...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
}
const notInSitemap = rows.filter((r) => r.newStatus === 200 && !smUrls.some((u) => new URL(u).pathname === r.path)).map((r) => r.path);

// ---------- 6. legacy-URL's (zonder /nl/) op de nieuwe site ----------
const legacyCheck = await pool(legacy.filter((l) => !isShop(new URL(l.to).pathname)), 8, async (l) => {
  const path = new URL(l.from).pathname;
  const r = await fetchChain(NEW + path);
  return { ...l, newTest: NEW + path, newStatus: r.status, newFinal: r.finalUrl };
});

const report = {
  generated: new Date().toISOString(),
  counts: { oldSitemap: oldUrls.length, uniquePages: byPath.size, marketing: marketing.length, shop: shop.length, oldNon200: oldBroken.length },
  rows, dupTitles: dupe("newTitle"), dupMetas: dupe("newMeta"),
  brokenLinks: brokenLinks.map((b) => ({ ...b, on: linkSources(b.url) })),
  notInSitemap, legacy: legacyCheck, shopPaths: shop.map(([p]) => p), oldBroken: oldBroken.map(([p, r]) => ({ path: p, status: r.oldStatus })),
  newSitemapCount: smUrls.length,
};
await writeFile(P("audit/report.json"), JSON.stringify(report, null, 2));
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
const cols = ["path", "newStatus", "issues", "oldTitle", "newTitle", "oldMeta", "newMeta", "oldH1", "newH1", "oldWords", "newWords", "oldImgs", "newImgs", "newImgNoAlt", "canonical", "robots"];
await writeFile(P("audit/report.csv"), "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(c === "issues" ? r.issues.join(" | ") : r[c])).join(";"))].join("\n"));
console.log("Klaar → audit/report.json + audit/report.csv");
