// Padnavigatie terugzetten in "Archives Hero Section" (Blocksy contentblok 717, kop boven categorie-/shoppagina's)
// en de EN-vertaling. Op 14 okt 2026 bij het bewerken verdwenen; blok uit revisie 5725 (2 sep 2026) ongewijzigd terug,
// direct vóór de titel (blocksy/dynamic-data). Rest van het blok blijft zoals het is. Backup in backups/.
//   node scripts/restore-archive-breadcrumbs.mjs
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const BLOCK = '<!-- wp:blocksy/breadcrumbs {"textColor":"palette-color-8","linkColor":"palette-color-7"} /-->\n\n';

const tr = await (await fetch(`${W}/c36/v1/translations?element_type=post_ct_content_block&id=717`, { headers: H })).json();
const ids = [717, tr.translations?.en?.element_id].filter(Boolean);
for (const id of ids) {
  const url = `${W}/wp/v2/ct_content_block/${id}`;
  const cur = await (await fetch(`${url}?context=edit&_fields=content`, { headers: H })).json();
  let c = cur.content.raw;
  if (c.includes("wp:blocksy/breadcrumbs")) { console.log(`#${id}: padnavigatie staat er al`); continue; }
  const at = c.indexOf("<!-- wp:blocksy/dynamic-data");
  if (at < 0) { console.log(`#${id}: titelblok niet gevonden — niets gewijzigd`); continue; }
  await writeFile(new URL(`../backups/ct_content_block-${id}-${Date.now()}.json`, import.meta.url), JSON.stringify(cur, null, 2));
  c = c.slice(0, at) + BLOCK + c.slice(at);
  const r = await fetch(url, { method: "POST", headers: H, body: JSON.stringify({ content: c }) });
  console.log(`#${id}: ${r.ok ? "padnavigatie teruggezet" : "FOUT " + r.status}`);
}
