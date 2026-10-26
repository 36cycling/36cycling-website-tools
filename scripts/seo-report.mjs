// SEO-posities uit Google Search Console: afgelopen 7 dagen tegenover de 7 dagen daarvoor.
// Search Console loopt ± 3 dagen achter, dus de periode eindigt 3 dagen geleden.
// Schrijft Markdown naar stdout (wordt opgenomen in het weekrapport); met --json de ruwe cijfers.
//   node scripts/seo-report.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { gscAvailable, gscClient } from "../lib/gsc.mjs";

// Zoektermen die we altijd willen zien (ook als ze geen klikken hadden).
const WATCH = [
  "wielerkleding bedrukken", "wielershirt bedrukken", "wielerkleding ontwerpen", "custom wielerkleding",
  "teamkleding wielrennen", "wielerkleding team", "fietskleding", "wielershirt", "36 cycling",
];
const JSON_OUT = process.argv.includes("--json");

const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const cur = { startDate: day(9), endDate: day(3) };
const prev = { startDate: day(16), endDate: day(10) };
const fmtPos = (p) => (p ? p.toFixed(1).replace(".", ",") : "–");
const delta = (now, before) => {
  if (!now && !before) return "–";
  if (!now || !before) return before ? "weg" : "nieuw";
  const d = before - now; // positief = gestegen (lagere positie is beter)
  return Math.abs(d) < 0.5 ? "=" : d > 0 ? `▲ ${d.toFixed(1).replace(".", ",")}` : `▼ ${(-d).toFixed(1).replace(".", ",")}`;
};

if (!(await gscAvailable())) {
  console.log("## SEO (Google Search Console)\nNog niet gekoppeld: sleutel `private/gsc-service-account.json` ontbreekt (zie Obsidian → Werkwijzen → SEO-rapport).");
  process.exit(0);
}

const lines = ["## SEO (Google Search Console)"];
try {
  const gsc = await gscClient();
  const q = (range, dims, extra = {}) => gsc.query({ ...range, dimensions: dims, rowLimit: 1000, dataState: "final", ...extra });
  const [tNow] = await q(cur, []);
  const [tPrev] = await q(prev, []);
  const qNow = await q(cur, ["query"]), qPrev = await q(prev, ["query"]);
  const pNow = await q(cur, ["page"]), pPrev = await q(prev, ["page"]);
  const map = (rows) => new Map(rows.map((r) => [r.keys[0], r]));
  const mqPrev = map(qPrev), mqNow = map(qNow), mpPrev = map(pPrev);

  const pct = (a, b) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "");
  lines.push(`Periode ${cur.startDate} t/m ${cur.endDate}, vergeleken met de week ervoor (${gsc.site}).`, "");
  lines.push("| | Deze week | Week ervoor | Verschil |", "| --- | --- | --- | --- |");
  lines.push(`| Klikken | ${tNow?.clicks ?? 0} | ${tPrev?.clicks ?? 0} | ${pct(tNow?.clicks ?? 0, tPrev?.clicks ?? 0)} |`);
  lines.push(`| Vertoningen | ${tNow?.impressions ?? 0} | ${tPrev?.impressions ?? 0} | ${pct(tNow?.impressions ?? 0, tPrev?.impressions ?? 0)} |`);
  lines.push(`| Gem. positie | ${fmtPos(tNow?.position)} | ${fmtPos(tPrev?.position)} | ${delta(tNow?.position, tPrev?.position)} |`, "");

  lines.push("### Vaste zoektermen", "| Zoekterm | Positie | Verschil | Klikken | Vertoningen |", "| --- | --- | --- | --- | --- |");
  for (const w of WATCH) {
    const n = mqNow.get(w), p = mqPrev.get(w);
    lines.push(`| ${w} | ${fmtPos(n?.position)} | ${delta(n?.position, p?.position)} | ${n?.clicks ?? 0} | ${n?.impressions ?? 0} |`);
  }
  lines.push("");

  lines.push("### Top 15 zoektermen (klikken)", "| Zoekterm | Klikken | Positie | Verschil |", "| --- | --- | --- | --- |");
  for (const r of [...qNow].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 15)) {
    lines.push(`| ${r.keys[0]} | ${r.clicks} | ${fmtPos(r.position)} | ${delta(r.position, mqPrev.get(r.keys[0])?.position)} |`);
  }
  lines.push("");

  // Grootste stijgers en dalers (alleen zoektermen met genoeg vertoningen om iets te zeggen)
  const moves = qNow.filter((r) => r.impressions >= 20 && mqPrev.get(r.keys[0])?.impressions >= 20)
    .map((r) => ({ k: r.keys[0], now: r.position, d: mqPrev.get(r.keys[0]).position - r.position }));
  const up = moves.filter((m) => m.d >= 2).sort((a, b) => b.d - a.d).slice(0, 5);
  const down = moves.filter((m) => m.d <= -2).sort((a, b) => a.d - b.d).slice(0, 5);
  lines.push("### Opvallend");
  if (!up.length && !down.length) lines.push("Geen grote verschuivingen (≥ 2 posities bij zoektermen met 20+ vertoningen).");
  for (const m of up) lines.push(`- ▲ ${m.k}: nu ${fmtPos(m.now)} (${m.d.toFixed(1).replace(".", ",")} hoger)`);
  for (const m of down) lines.push(`- ▼ ${m.k}: nu ${fmtPos(m.now)} (${(-m.d).toFixed(1).replace(".", ",")} lager)`);

  // Pagina's die flink minder klikken kregen (signaal na de livegang: kwijtgeraakte posities of foute redirect)
  const lost = pPrev.filter((r) => r.clicks >= 5).map((r) => ({ url: r.keys[0], before: r.clicks, now: map(pNow).get(r.keys[0])?.clicks ?? 0 }))
    .filter((r) => r.now <= r.before / 2).sort((a, b) => b.before - a.before).slice(0, 5);
  if (lost.length) {
    lines.push("", "### Pagina's met minder dan de helft van de klikken");
    for (const l of lost) lines.push(`- ${l.url.replace(/^https?:\/\/[^/]+/, "")}: ${l.before} → ${l.now}`);
  }

  await mkdir(new URL("../reports/", import.meta.url), { recursive: true });
  await writeFile(new URL(`../reports/seo-${cur.endDate}.json`, import.meta.url), JSON.stringify({ cur, prev, total: { now: tNow, prev: tPrev }, queries: qNow, pages: pNow }, null, 1));
  if (JSON_OUT) { console.log(JSON.stringify({ total: tNow, watch: WATCH.map((w) => [w, mqNow.get(w)?.position ?? null]) })); process.exit(0); }
} catch (e) {
  lines.push(`Kon Search Console niet lezen: ${e.message}`);
}
console.log(lines.join("\n"));
