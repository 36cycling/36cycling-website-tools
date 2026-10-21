// Engelse vertalingen van gebruikte attribuuttermen (pa_maat, pa_maat-broek, pa_maat-shirt) — WPML-gekoppeld.
// Maten blijven gelijk; Nederlandse woorden worden vertaald. Bestaande EN-vertalingen worden bijgewerkt.
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const en = (name) => name
  .replace(/\bpaar\b/g, (m, o, s) => (/^1 paar/.test(s) ? "pair" : "pairs"))
  .replace(/\bJaar\b/g, "years").replace(/\bwit\b/g, "white").replace(/\bzwart\b/g, "black")
  .replace(/^Geen extra's$/, "No extras").replace(/^Met wielerpet \(tijdelijk gratis\)$/, "With cycling cap (temporarily free)");

for (const attr of [3, 2, 4]) {
  const a = await (await fetch(`${W}/wc/v3/products/attributes/${attr}`, { headers: H })).json();
  const terms = await (await fetch(`${W}/wc/v3/products/attributes/${attr}/terms?per_page=100&lang=nl`, { headers: H })).json();
  let n = 0;
  for (const t of terms.filter((t) => t.count > 0)) {
    const trs = await (await fetch(`${W}/c36/v1/translations?element_type=tax_${a.slug}&id=${t.id}`, { headers: H })).json();
    const existing = trs.translations?.en?.term_id;
    const body = { name: en(t.name), slug: t.slug };
    const r = await fetch(`${W}/wc/v3/products/attributes/${attr}/terms${existing ? "/" + existing : ""}?lang=en`, { method: existing ? "PUT" : "POST", headers: H, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { console.log(`✗ ${a.slug} "${t.name}": ${r.status} ${j.message}`); continue; }
    if (!existing) {
      const l = await fetch(`${W}/c36/v1/link`, { method: "POST", headers: H, body: JSON.stringify({ element_type: `tax_${a.slug}`, source_id: t.id, translation_id: j.id, lang: "en", source_lang: "nl" }) });
      if (!l.ok) console.log(`  ! koppelen mislukt ${t.name}: ${l.status}`);
    }
    if (j.name !== t.name || j.slug !== t.slug) console.log(`  ${a.slug}: "${t.name}" → "${j.name}" (slug ${j.slug})`);
    n++;
  }
  console.log(`✓ ${a.slug}: ${n} termen`);
}
