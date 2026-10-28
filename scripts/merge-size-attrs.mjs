// Eenmalig (28 okt 2026): de kenmerken "Maat shirt" (pa_maat-shirt) en "Maat broek" (pa_maat-broek) samenvoegen in
// "Maat" (pa_maat), zodat de maatfilter in de winkel alle producten vindt (die filtert alleen op pa_maat).
// Per Nederlands product: maatlijst, standaardkeuze en variaties naar pa_maat (zelfde maten, zelfde variaties, SKU's,
// prijzen en voorraad blijven); WCML neemt het over in de Engelse vertaling. Ontbrekende maten (2XS) worden eerst
// in pa_maat aangemaakt, NL + gekoppelde EN-term. Oude waarden eerst naar backups/.
//   node scripts/merge-size-attrs.mjs                 → proef
//   node scripts/merge-size-attrs.mjs --apply --only=ID → één product
//   node scripts/merge-size-attrs.mjs --apply           → alles
//   node scripts/merge-size-attrs.mjs --apply --resume=backups/….json → back-up van een eerdere run opnieuw toepassen
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const ONLY = +(process.argv.find((a) => a.startsWith("--only=")) || "").slice(7) || 0;
const TO = 3; // pa_maat
const FROM = [4, 2]; // pa_maat-shirt, pa_maat-broek
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const B = W + "/wc/v3";
const get = async (u) => (await fetch(B + u, { headers: H })).json();
const send = async (method, u, body) => {
  const r = await fetch(B + u, { method, headers: H, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${u}: ${r.status} ${j.message}`);
  return j;
};

// 1. Maten die in pa_maat nog ontbreken
const target = await get(`/products/attributes/${TO}/terms?per_page=100&lang=nl`);
const have = new Set(target.map((t) => t.name));
const xs = target.find((t) => t.slug === "xs");
const needed = new Map();
for (const id of FROM) {
  const attr = await get(`/products/attributes/${id}`);
  for (const t of await get(`/products/attributes/${id}/terms?per_page=100&lang=nl`)) {
    if (t.count > 0 && !have.has(t.name)) needed.set(t.name, { slug: t.slug, from: attr.slug });
  }
}
for (const [name, t] of needed) {
  console.log(`Maat ${name} ontbreekt in pa_maat${APPLY ? ": aanmaken (NL + EN)" : ""}`);
  if (!APPLY) continue;
  const nl = await send("POST", `/products/attributes/${TO}/terms?lang=nl`, { name, slug: t.slug, menu_order: xs.menu_order - 1 });
  const en = await send("POST", `/products/attributes/${TO}/terms?lang=en`, { name, slug: t.slug, menu_order: xs.menu_order - 1 });
  const l = await fetch(`${W}/c36/v1/link`, { method: "POST", headers: H, body: JSON.stringify({ element_type: "tax_pa_maat", source_id: nl.id, translation_id: en.id, lang: "en", source_lang: "nl" }) });
  if (!l.ok) throw new Error(`koppelen ${name}: ${l.status}`);
}

// 2. Producten
const products = [];
for (let page = 1; ; page++) {
  const j = await get(`/products?per_page=100&page=${page}&lang=nl&status=any`);
  if (!j.length) break;
  products.push(...j);
}
const todo = products.filter((p) => (!ONLY || p.id === ONLY) && p.attributes.some((a) => FROM.includes(a.id)));
const mapAttr = (a) => (FROM.includes(a.id) ? { id: TO } : { id: a.id, name: a.name });
const RESUME = (process.argv.find((a) => a.startsWith("--resume=")) || "").slice(9); // back-up van een eerdere run opnieuw toepassen
const backup = RESUME ? JSON.parse(await readFile(RESUME, "utf8")) : [];
for (const p of RESUME ? [] : todo) {
  if (p.attributes.some((a) => a.id === TO)) { console.log(`  ! ${p.name} (${p.id}): heeft al Maat, overgeslagen`); continue; }
  const vars = p.type === "variable" ? await get(`/products/${p.id}/variations?per_page=100`) : [];
  backup.push({ product: p.id, name: p.name, attributes: p.attributes, default_attributes: p.default_attributes, variations: vars.map((v) => ({ id: v.id, attributes: v.attributes })) });
}
console.log(`${backup.length} producten: ${backup.map((b) => `${b.name} (${b.variations.length})`).join(", ")}`);
if (!APPLY) { console.log("Proef. Doorvoeren met --apply (eerst --only=ID)."); process.exit(0); }

const file = RESUME ? "../" + RESUME : `../backups/size-attrs-before-merge-2026-10-28${ONLY ? "-" + ONLY : ""}.json`;
if (!RESUME) await writeFile(new URL(file, import.meta.url), JSON.stringify(backup, null, 2));
let ok = 0;
for (const b of backup) {
  try {
    const product = {
      attributes: b.attributes.map((a) => ({ ...mapAttr(a), position: a.position, visible: a.visible, variation: a.variation, options: a.options })),
      default_attributes: b.default_attributes.map((a) => ({ ...mapAttr(a), option: a.option })),
    };
    // Eerst het product: WooCommerce negeert variatiekenmerken die het hoofdproduct (nog) niet heeft.
    await send("PUT", `/products/${b.product}`, product);
    if (b.variations.length) {
      const j = await send("POST", `/products/${b.product}/variations/batch`, {
        update: b.variations.map((v) => ({ id: v.id, attributes: v.attributes.map((a) => ({ ...mapAttr(a), option: a.option })) })),
      });
      const errs = (j.update || []).filter((u) => u.error);
      if (errs.length) throw new Error(errs.map((e) => e.error.message).join("; "));
    }
    // Product als laatste nog eens opslaan: WCML synchroniseert dan de variaties naar de Engelse vertaling.
    await send("PUT", `/products/${b.product}`, product);
    ok++;
  } catch (e) { console.log(`  ✗ ${b.name} (${b.product}): ${e.message}`); }
}
console.log(`Klaar: ${ok} van ${backup.length} producten. Back-up: ${file.slice(3)}`);
