// Wekelijkse controle van de website: smoke-test, beschikbare updates en 404's van de afgelopen week.
// Schrijft een rapport (Markdown) naar reports/ en print onderwerpregel + rapport, zodat Claude het kan mailen.
//   node scripts/weekly-check.mjs
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const BASE = cfg.wp.baseUrl;
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const today = new Date().toISOString().slice(0, 10);

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

// Rapport
const lines = [];
const updCount = upd ? upd.core.length + upd.plugins.length + upd.themes.length : 0;
const issues = failed.length + (updError ? 1 : 0);
const subject = `Websitecontrole 36cycling ${today}: ` + (issues ? `${issues} probleem/problemen` : "site in orde") + (updCount ? `, ${updCount} update(s)` : ", geen updates");
lines.push(`# ${subject}`, "", `Site: ${BASE}`, "");
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
lines.push("", "## Voorstel");
const advice = [];
if (failed.length) advice.push("Mislukte controles nakijken (zie boven) — mogelijk door een update of wijziging.");
if (upd?.plugins?.some((p) => SENSITIVE.test(p.file + p.name))) advice.push("Updates met ⚠️: bijwerken op een rustig moment en daarna `node scripts/smoke-test.mjs` draaien.");
else if (updCount) advice.push("Updates kunnen worden bijgewerkt; daarna de smoke-test draaien.");
if (top404.length) advice.push("Terugkerende 404's van oude URL's: redirect toevoegen (Gereedschap → Redirection).");
lines.push(...(advice.length ? advice.map((a) => `- ${a}`) : ["- Niets te doen."]));
lines.push("", `_Thema: ${smokeData.versions?.thema || "?"} · plugins: ${smokeData.versions?.plugins || "?"}_`);

const report = lines.join("\n");
await mkdir(new URL("../reports/", import.meta.url), { recursive: true });
await writeFile(new URL(`../reports/weekly-${today}.md`, import.meta.url), report);
console.log(`SUBJECT: ${subject}\n\n${report}`);
