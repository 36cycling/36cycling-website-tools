// Voeg de Yoast-titel-suffix toe aan ALLE reeds gebouwde pagina's (idempotent).
import { loadConfig } from "../lib/wp.mjs";
import { readFile } from "node:fs/promises";

const cfg = await loadConfig();
const suffix = cfg.seoTitleSuffix;
if (!suffix) { console.error("Geen seoTitleSuffix in config."); process.exit(1); }
const auth = "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64");
const base = cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json/wp/v2/pages";
const state = JSON.parse(await readFile(new URL("../state.json", import.meta.url), "utf8"));

let done = 0, skip = 0, fail = 0;
for (const [key, { id }] of Object.entries(state)) {
  try {
    const g = await fetch(`${base}/${id}?context=edit`, { headers: { Authorization: auth } });
    const j = await g.json();
    const cur = j.meta?._yoast_wpseo_title || "";
    if (!cur) { console.log(`?  ${key}: geen SEO-titel`); fail++; continue; }
    if (cur.endsWith(suffix)) { skip++; continue; }
    const p = await fetch(`${base}/${id}`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { _yoast_wpseo_title: cur + suffix } }),
    });
    if (!p.ok) throw new Error(await p.text());
    console.log(`✓ ${key}: "${cur}${suffix}"`);
    done++;
  } catch (e) { console.log(`✗ ${key}: ${e.message.slice(0, 80)}`); fail++; }
}
console.log(`\nKlaar: ${done} bijgewerkt, ${skip} hadden 'm al, ${fail} fout.`);
