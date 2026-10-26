// Wekelijkse controle van de website: smoke-test, beschikbare updates en 404's van de afgelopen week.
// Schrijft een rapport (Markdown) naar reports/ en print onderwerpregel + rapport, zodat Claude het kan mailen.
//   node scripts/weekly-check.mjs
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const BASE = cfg.wp.baseUrl;
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const today = process.env.C36_TODAY || new Date().toISOString().slice(0, 10); // C36_TODAY=2026-11-16 om de planning te testen

// Onderdelen waar eigen code/instellingen aan hangen: updates daarvan eerst nakijken / na update extra testen.
const SENSITIVE = /woocommerce|sitepress|wpml|greenshift|blocksy|complianz|wordpress-seo|yoast|mollie|fluent|duracelltomi|gtm4wp|litespeed|redirection/i;

// 1. Smoke-test
const smoke = spawnSync(process.execPath, [fileURLToPath(new URL("./smoke-test.mjs", import.meta.url)), "--json"], { encoding: "utf8" });
let smokeData = null;
try { smokeData = JSON.parse(smoke.stdout); } catch { smokeData = { results: [{ name: "Smoke-test", pass: false, note: (smoke.stderr || smoke.stdout).slice(0, 300) }], versions: {} }; }
const failed = smokeData.results.filter((r) => !r.pass);

// 2. Updates
let upd = null, updError = "";
try {
  const r = await fetch(`${BASE}/wp-json/c36/v1/updates?refresh=1`, { headers: H });
  if (r.ok) upd = await r.json(); else updError = `route gaf ${r.status} (is 36cycling-wpml-rest.php met de updates-route geüpload?)`;
} catch (e) { updError = e.message; }

// 3. 404's van de afgelopen 7 dagen (Redirection-logboek), gegroepeerd per URL
let top404 = [], err404 = "";
try {
  const r = await fetch(`${BASE}/wp-json/redirection/v1/404?per_page=200&groupBy=url&orderby=count&direction=desc`, { headers: H });
  if (r.ok) {
    const j = await r.json();
    // Alleen URL's die nu nog steeds een 404 geven (opgeloste/omgeleide URL's niet meer melden),
    // en bekende ruis van bots overslaan.
    const IGNORE = ["/llms.txt", "/llms-full.txt", "/.well-known/", "/wp-login.php", "/xmlrpc.php"];
    for (const i of j.items || []) {
      if (top404.length >= 10) break;
      if (IGNORE.some((p) => i.url.startsWith(p))) continue;
      const now = await fetch(`${BASE}${i.url}`, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (36cycling weekly-check)" } }).catch(() => null);
      if (now && now.status !== 404 && now.status !== 410) continue;
      top404.push({ url: i.url, count: +i.count || 1 });
    }
  }
  else err404 = `status ${r.status}`;
} catch (e) { err404 = e.message; }

// 4. Greenshift-opmaak: lopen Engelse kopieën achter op de Nederlandse pagina (na bewerken in de editor)?
const gs = spawnSync(process.execPath, [fileURLToPath(new URL("./sync-greenshift-css.mjs", import.meta.url))], { encoding: "utf8" });
const gsBehind = (gs.stdout.match(/^  achter: .*$/gm) || []).map((l) => l.replace("  achter: ", ""));
const gsStructure = gs.stdout.includes("Andere opbouw") ? gs.stdout.split("Andere opbouw")[1].split("\n").slice(1).filter((l) => l.startsWith("  ")).map((l) => l.trim()) : [];

// 4b. Prijzen NL/EN: WCML zet de weergaveprijs van een Engels variabel product soms niet bij als de NL-versie wijzigt
// (dan toont de Engelse winkel geen prijs). Vergelijken op SKU via de Store API.
let priceDiffs = [], priceError = "";
try {
  const all = async (lang) => {
    let out = [];
    for (let p = 1; p < 10; p++) {
      const url = `${BASE}/wp-json/wc/store/v1/products?per_page=100&page=${p}&lang=${lang}`;
      const j = await fetch(url).catch(() => fetch(url)).then((r) => r.json()); // 1× opnieuw bij een verbroken verbinding
      if (!Array.isArray(j) || !j.length) break;
      out = out.concat(j);
    }
    return out;
  };
  const [nl, en] = [await all("nl"), await all("en")];
  const enBySku = new Map(en.map((p) => [p.sku, p]));
  for (const p of nl) {
    const e = enBySku.get(p.sku);
    if (e && p.prices.price !== e.prices.price) priceDiffs.push(`${e.name.replace(/&#8211;/g, "–")} (EN ${e.id}): NL € ${p.prices.price / 100}, EN € ${e.prices.price / 100}`);
  }
} catch (e) { priceError = e.cause?.code || e.message; }

// 5. SEO-posities uit Google Search Console (scripts/seo-report.mjs)
const seo = spawnSync(process.execPath, [fileURLToPath(new URL("./seo-report.mjs", import.meta.url))], { encoding: "utf8" });
const seoSection = (seo.stdout || "").trim() || `## SEO (Google Search Console)\nKon het SEO-rapport niet maken: ${(seo.stderr || "").slice(0, 300)}`;

// 6. Planning (data/planning.json): wat is deze week aan de beurt?
// Voorwaarde "seo-stabiel": gemiddelde positie verschuift < 1,5 en klikken dalen < 25% t.o.v. de week ervoor.
let planning = [], planError = "";
try {
  const plan = JSON.parse(await readFile(new URL("../data/planning.json", import.meta.url), "utf8"));
  const seoFiles = (await readdir(new URL("../reports/", import.meta.url)).catch(() => [])).filter((f) => /^seo-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  let stable = null;
  if (seoFiles.length) {
    const s = JSON.parse(await readFile(new URL(`../reports/${seoFiles.at(-1)}`, import.meta.url), "utf8"));
    const n = s.total?.now, p = s.total?.prev;
    if (n && p) stable = { ok: Math.abs(n.position - p.position) < 1.5 && (!p.clicks || n.clicks >= p.clicks * 0.75), d: (n.position - p.position).toFixed(1).replace(".", ",") };
  }
  for (const it of plan.items.filter((i) => !i.done && i.vanaf <= today)) {
    let status = "nu aan de beurt";
    if (it.voorwaarde === "seo-stabiel") {
      status = stable === null ? "nu aan de beurt (SEO-cijfers onbekend, zelf even kijken)"
        : stable.ok ? "nu aan de beurt: de posities zijn stabiel" : `nog even wachten: de posities bewegen nog (gem. positie ${stable.d} t.o.v. vorige week)`;
    }
    if (it.uiterlijk) status += ` · uiterlijk ${it.uiterlijk}`;
    planning.push({ ...it, status });
  }
} catch (e) { planError = e.message; }

// Rapport
const lines = [];
const updCount = upd ? upd.core.length + upd.plugins.length + upd.themes.length : 0;
const issues = failed.length + (updError ? 1 : 0);
const subject = `Websitecontrole 36cycling ${today}: ` + (issues ? `${issues} probleem/problemen` : "site in orde") + (updCount ? `, ${updCount} update(s)` : ", geen updates");
lines.push(`# ${subject}`, "", `Site: ${BASE}`, "");
lines.push("## Nu aan de beurt");
if (planError) lines.push(`Kon de planning niet lezen: ${planError}`);
else if (!planning.length) lines.push("Niets gepland voor deze week.");
for (const it of planning) lines.push(`- **${it.titel}** (${it.status}): ${it.wat}`);
lines.push("");
lines.push("## Controle van de site");
lines.push(failed.length ? `**${failed.length} van ${smokeData.results.length} controles mislukt:**` : `Alle ${smokeData.results.length} controles in orde (pagina's NL/EN, winkel, cookiebalk, padnavigatie, redirects, eigen routes).`);
for (const f of failed) lines.push(`- ✗ ${f.name}${f.note ? ` — ${f.note}` : ""}`);
lines.push("");
lines.push("## Updates");
if (updError) lines.push(`Kon updates niet ophalen: ${updError}`);
else if (!updCount) lines.push(`Geen updates. WordPress ${upd.wordpress}, PHP ${upd.php}.`);
else {
  for (const c of upd.core) lines.push(`- **WordPress** ${upd.wordpress} → ${c.version}`);
  for (const p of upd.plugins) lines.push(`- **${p.name}** ${p.current} → ${p.new}${p.active ? "" : " (inactief)"}${SENSITIVE.test(p.file + p.name) ? " — ⚠️ eigen code/instellingen hangen hieraan: na bijwerken extra testen" : ""}`);
  for (const t of upd.themes) lines.push(`- **Thema ${t.name}** ${t.current} → ${t.new}${t.active ? " (actief)" : " (ongebruikt — liever verwijderen)"}`);
}
if (upd?.translations) lines.push(`- ${upd.translations} vertaalupdate(s)`);
if (upd?.inactive_themes?.length) lines.push("", `Ongebruikte thema's (advies: verwijderen): ${upd.inactive_themes.join(", ")}`);
lines.push("");
lines.push("## Niet gevonden (404) — top 10");
if (err404) lines.push(`Kon het 404-logboek niet lezen: ${err404}`);
else if (!top404.length) lines.push("Geen 404's gelogd.");
else for (const i of top404) lines.push(`- ${i.url} (${i.count}×)`);
lines.push("", "## Engelse pagina's: opmaak en opbouw");
if (!gsBehind.length && !gsStructure.length) lines.push("Engelse kopieën lopen gelijk met de Nederlandse (opmaak en blokken).");
for (const n of gsBehind) lines.push(`- Opmaak loopt achter: ${n}`);
for (const n of gsStructure) lines.push(`- Andere opbouw dan NL (EN-pagina bijwerken): ${n}`);
lines.push("", "## Prijzen NL/EN");
if (priceError) lines.push(`Kon de prijzen niet vergelijken: ${priceError}`);
else if (!priceDiffs.length) lines.push("Alle Engelse producten hebben dezelfde prijs als de Nederlandse.");
for (const d of priceDiffs) lines.push(`- ${d}`);
lines.push("", seoSection);
lines.push("", "## Voorstel");
const advice = [];
if (failed.length) advice.push("Mislukte controles nakijken (zie boven) — mogelijk door een update of wijziging.");
if (upd?.plugins?.some((p) => SENSITIVE.test(p.file + p.name))) advice.push("Updates met ⚠️: bijwerken op een rustig moment en daarna `node scripts/smoke-test.mjs` draaien.");
else if (updCount) advice.push("Updates kunnen worden bijgewerkt; daarna de smoke-test draaien.");
if (gsBehind.length) advice.push("Engelse opmaak gelijkzetten: `node scripts/sync-greenshift-css.mjs --apply`, daarna LiteSpeed legen.");
if (gsStructure.length) advice.push("Nederlandse pagina is aangepast; Engelse versie bijwerken (translate-en) en daarna de opmaak gelijkzetten.");
if (priceDiffs.length) advice.push("Engelse prijs wijkt af: Engels product opnieuw opslaan (WooCommerce → Producten, taal EN → Bijwerken), daarna LiteSpeed legen.");
if (top404.length) advice.push("Terugkerende 404's van oude URL's: redirect toevoegen (Gereedschap → Redirection).");
lines.push(...(advice.length ? advice.map((a) => `- ${a}`) : ["- Niets te doen."]));
lines.push("", `_Thema: ${smokeData.versions?.thema || "?"} · plugins: ${smokeData.versions?.plugins || "?"}_`);

const report = lines.join("\n");
await mkdir(new URL("../reports/", import.meta.url), { recursive: true });
await writeFile(new URL(`../reports/weekly-${today}.md`, import.meta.url), report);
console.log(`SUBJECT: ${subject}\n\n${report}`);
