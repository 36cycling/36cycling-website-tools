// Engelse versie van het hoofdmenu (WPML-gekoppeld). Items verwijzen naar de EN-vertaling van dezelfde pagina/categorie.
// Bestaat het EN-menu al, dan worden de items opnieuw opgebouwd.
import { loadConfig } from "../lib/wp.mjs";

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const NL_MENU = 28;
// NL-menu-item-id → EN-label
const LABELS = {
  1984: "Custom Teamwear", 6282: "Custom cycling clothing", 1982: "Team cycling wear collection", 1987: "Sportswear collection",
  5739: "Shop", 5624: "Men", 5629: "Cycling jerseys", 5630: "Short sleeve", 5631: "Long sleeve", 5625: "Cycling shorts",
  5626: "Bib shorts", 5627: "Bib tights", 5628: "Cycling jackets", 5616: "Women", 5621: "Cycling jerseys", 5622: "Short sleeve",
  5623: "Long sleeve", 5617: "Cycling shorts", 5618: "Bib shorts", 5619: "Bib tights", 5620: "Cycling jackets", 5605: "Accessories",
  5609: "Cycling glasses", 5610: "Cycling gloves", 5612: "Shoe covers", 5611: "Cycling socks", 5608: "Base layers",
  5607: "Arm and leg warmers", 5615: "Caps and hats", 5614: "Bags", 5613: "Sportswear",
  945: "About 36", 944: "Stories", 943: "Contact", 1969: "Request a quote",
};
const elType = (i) => (i.type === "taxonomy" ? `tax_${i.object}` : `post_${i.object}`);
const enOf = async (i) => {
  const j = await (await fetch(`${W}/c36/v1/translations?element_type=${elType(i)}&id=${i.object_id}`, { headers: H })).json();
  const t = j.translations?.en; return t ? (i.type === "taxonomy" ? t.term_id : t.element_id) : null;
};

const items = await (await fetch(`${W}/wp/v2/menu-items?menus=${NL_MENU}&per_page=100`, { headers: H })).json();
// EN-menu zoeken of aanmaken + koppelen
let enMenu = (await (await fetch(`${W}/c36/v1/translations?element_type=tax_nav_menu&id=${NL_MENU}`, { headers: H })).json()).translations?.en?.term_id;
if (!enMenu) {
  const r = await fetch(`${W}/wp/v2/menus?lang=en`, { method: "POST", headers: H, body: JSON.stringify({ name: "Main Menu EN" }) });
  const m = await r.json(); if (!r.ok) throw new Error(`menu: ${r.status} ${m.message}`);
  enMenu = m.id;
  const l = await fetch(`${W}/c36/v1/link`, { method: "POST", headers: H, body: JSON.stringify({ element_type: "tax_nav_menu", source_id: NL_MENU, translation_id: enMenu, lang: "en", source_lang: "nl" }) });
  console.log(`EN-menu #${enMenu} aangemaakt, koppelen: ${l.status}`);
} else {
  for (const it of await (await fetch(`${W}/wp/v2/menu-items?menus=${enMenu}&per_page=100`, { headers: H })).json())
    await fetch(`${W}/wp/v2/menu-items/${it.id}?force=true`, { method: "DELETE", headers: H });
  console.log(`EN-menu #${enMenu} bestaat, items opnieuw opbouwen`);
}
const map = {};
for (const i of items.sort((a, b) => a.menu_order - b.menu_order)) {
  const obj = await enOf(i);
  if (!obj) { console.log(`! geen EN-vertaling voor ${i.title.rendered} (${i.object} ${i.object_id})`); continue; }
  const body = { menus: enMenu, title: LABELS[i.id] || i.title.rendered, type: i.type, object: i.object, object_id: obj, parent: i.parent ? map[i.parent] || 0 : 0, menu_order: i.menu_order, status: "publish" };
  const r = await fetch(`${W}/wp/v2/menu-items?lang=en`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) { console.log(`✗ ${body.title}: ${r.status} ${j.message}`); continue; }
  map[i.id] = j.id;
  console.log(`✓ ${"  ".repeat(depth(i))}${body.title}`);
}
function depth(i) { let d = 0, p = i.parent; while (p) { d++; p = items.find((x) => x.id === p)?.parent; } return d; }
