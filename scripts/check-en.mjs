// Controle Engelse site: zoekt Nederlandse teksten in EN-pagina's/berichten/blokken/contentblokken/producten.
// Vergelijkt per item de tekstsegmenten met die van het NL-origineel (NL-segment ongewijzigd in EN = verdacht).
import { loadConfig } from "../lib/wp.mjs";
import { extractSegments } from "../lib/translate.mjs";
const cfg = await loadConfig();
const H = { headers: { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") } };
const W = cfg.wp.baseUrl + "/wp-json";
const DUTCH = /\b(de|het|een|voor|met|van|en|je|jouw|wij|onze|bekijk|meer|bestel|wielerkleding|wielershirt|wielerbroek|bedrukken|ontwerpen)\b/i;
let bad = 0, n = 0;
for (const type of ["pages", "posts", "blocks", "ct_content_block"]) {
  const el = { pages: "post_page", posts: "post_post", blocks: "post_wp_block", ct_content_block: "post_ct_content_block" }[type];
  for (let p = 1; p < 3; p++) {
    const j = await (await fetch(`${W}/wp/v2/${type}?lang=en&per_page=100&page=${p}&status=publish,draft&context=edit&_fields=id,slug,content`, H)).json();
    if (!Array.isArray(j) || !j.length) break;
    for (const x of j) {
      const tr = await (await fetch(`${W}/c36/v1/translations?element_type=${el}&id=${x.id}`, H)).json();
      const nlId = tr.translations?.nl?.element_id; if (!nlId || nlId === x.id) continue;
      n++;
      const nl = (await (await fetch(`${W}/wp/v2/${type}/${nlId}?context=edit&_fields=content`, H)).json()).content?.raw || "";
      const nlSegs = new Set(extractSegments(nl));
      const same = extractSegments(x.content.raw).filter((s) => nlSegs.has(s) && DUTCH.test(s.replace(/<[^>]+>/g, " ")));
      if (same.length) { bad++; console.log(`✗ ${type}/${x.id} ${x.slug}: ${same.length}× NL — ${same.slice(0, 2).map((s) => s.slice(0, 50)).join(" | ")}`); }
    }
  }
}
console.log(`Gecontroleerd: ${n}, met Nederlandse tekst: ${bad}`);
