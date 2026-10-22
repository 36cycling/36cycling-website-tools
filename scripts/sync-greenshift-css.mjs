// Greenshift-opmaak (meta _gspb_post_css) van Nederlandse pagina's/blokken overzetten naar hun Engelse vertaling.
// Waarom: Greenshift maakt de CSS van een pagina pas bij opslaan in de editor. Past Jeroen de NL-pagina aan, dan houdt
// de EN-kopie (zelfde blokken, vertaalde tekst) de oude CSS en valt de opmaak daar uit elkaar.
// Alleen kopiëren als de EN-pagina exact dezelfde Greenshift-blokken (gsbp-id's) heeft; anders melden en overslaan.
//   node scripts/sync-greenshift-css.mjs           → proef: welke EN-items lopen achter
//   node scripts/sync-greenshift-css.mjs --apply   → CSS kopiëren (oude EN-CSS eerst naar backups/)
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const B = cfg.wp.baseUrl + "/wp-json";
const TYPES = [["pages", "post_page"], ["posts", "post_post"], ["blocks", "post_wp_block"], ["ct_content_block", "post_ct_content_block"]];
const ids = (raw) => [...new Set([...raw.matchAll(/"id":"(gsbp-[a-z0-9]+)"/g)].map((m) => m[1]))].sort().join(",");

const report = { same: 0, synced: [], behind: [], structure: [] };
const backup = [];
for (const [type, elType] of TYPES) {
  const list = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`${B}/wp/v2/${type}?per_page=100&page=${page}&lang=nl&status=publish,draft&context=edit&_fields=id,title,meta,content`, { headers: H });
    if (!r.ok) break;
    const j = await r.json();
    if (!j.length) break;
    list.push(...j);
    if (j.length < 100) break;
  }
  for (const nl of list) {
    const css = nl.meta?._gspb_post_css;
    if (!css) continue;
    const t = await (await fetch(`${B}/c36/v1/translations?element_type=${elType}&id=${nl.id}`, { headers: H })).json();
    const enId = t.translations?.en?.element_id;
    if (!enId || enId === nl.id) continue;
    const en = await (await fetch(`${B}/wp/v2/${type}/${enId}?context=edit&_fields=id,title,meta,content`, { headers: H })).json();
    const name = `${type} ${nl.id} "${nl.title.raw}" → EN ${enId}`;
    if ((en.meta?._gspb_post_css || "") === css) { report.same++; continue; }
    if (ids(nl.content.raw) !== ids(en.content.raw)) { report.structure.push(name); continue; }
    report.behind.push(name);
    if (APPLY) {
      backup.push({ type, id: enId, css: en.meta?._gspb_post_css || "" });
      const r = await fetch(`${B}/wp/v2/${type}/${enId}`, { method: "POST", headers: H, body: JSON.stringify({ meta: { _gspb_post_css: css } }) });
      const k = await r.json();
      if (r.ok && k.meta?._gspb_post_css === css) report.synced.push(name); else console.log(`  ✗ ${name}: ${r.status} ${JSON.stringify(k).slice(0, 150)}`);
    }
  }
}
console.log(`Gelijk: ${report.same}. EN loopt achter: ${report.behind.length}${APPLY ? ` (bijgewerkt: ${report.synced.length})` : ""}.`);
for (const n of report.behind) console.log(`  achter: ${n}`);
if (report.structure.length) { console.log("Andere opbouw NL/EN (niet gekopieerd, EN-pagina eerst opnieuw opbouwen met translate-en):"); for (const n of report.structure) console.log(`  ${n}`); }
if (APPLY && backup.length) await writeFile(new URL(`../backups/gspb-css-en-before-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url), JSON.stringify(backup, null, 2));
if (!APPLY) console.log("Proef: niets gewijzigd. Doorvoeren met --apply. Daarna LiteSpeed → Alles opschonen.");
