// Sokken: maat en aantal (1 paar / 3 paar) als twee kenmerken (Maat x Aantal), zoals product 5185 (23 okt).
// node scripts/sok-aantal.mjs <nl-id> [--apply]
// Losse variaties zonder maat (oude "1 paar"/"3 paar"-opties) gaan eruit; 3 paar per maat met prijs van de oude variatie,
// zonder eigen voorraad (voorraadstatus = die van 1 paar). Proef tenzij --apply; back-up eerst zelf maken. EN volgt via WCML.
import { loadConfig } from "../lib/wp.mjs";
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const B = cfg.wp.baseUrl + "/wp-json/wc/v3";
const api = async (p, method = "GET", body) => { const r = await fetch(B + "/" + p, { method, headers: H, body: body && JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(p + " " + r.status + " " + JSON.stringify(j).slice(0, 300)); return j; };
const ID = +process.argv[2], APPLY = process.argv.includes("--apply");
const MIX = { nl: "3 paar (2x zwart, 1x wit)", en: "3 pairs (2x black, 1x white)" };
const MIXW = { nl: "3 paar (2x wit, 1x zwart)", en: "3 pairs (2x white, 1x black)" };

async function term(names, order) {
  const nl = (await api("products/attributes/6/terms?per_page=100&lang=nl")).find(t => t.name === names.nl);
  if (nl) return nl.name;
  if (!APPLY) return names.nl + " (nieuw)";
  const a = await api("products/attributes/6/terms?lang=nl", "POST", { name: names.nl, menu_order: order });
  const b = await api("products/attributes/6/terms?lang=en", "POST", { name: names.en, menu_order: order });
  const l = await fetch(cfg.wp.baseUrl + "/wp-json/c36/v1/link", { method: "POST", headers: H, body: JSON.stringify({ element_type: "tax_pa_aantal", source_id: a.id, translation_id: b.id, lang: "en", source_lang: "nl" }) });
  console.log("  term", names.nl, a.id, "/", names.en, b.id, "link", l.status);
  return a.name;
}

const p = await api(`products/${ID}`);
const vars = (await api(`products/${ID}/variations?per_page=100`)).sort((a, b) => a.id - b.id);
const maat = p.attributes.find(a => a.id === 3);
const sizes = maat.options.filter(o => !/paar/.test(o));
const sizeVars = sizes.map(s => vars.find(v => v.attributes.find(a => a.id === 3)?.option === s));
const orphans = vars.filter(v => !v.attributes.length);
const kind = v => /mix|2x/i.test(v.sku) ? (/2xwit/i.test(v.sku) ? "mixw" : "mix") : /3paar/i.test(v.sku) ? "3" : "1";
const packs = orphans.filter(v => kind(v) !== "1").map(v => ({ v, k: kind(v) }));
console.log(`#${ID} ${p.name}\n  maten: ${sizes.join(", ")} | losse variaties: ${orphans.map(v => v.id + " " + v.sku + " " + v.regular_price + "/" + (v.sale_price || "-")).join(" | ")}`);
if (sizeVars.some(v => !v)) throw new Error("maatvariatie ontbreekt");
const aantal = ["1 paar"];
for (const { k } of packs) aantal.push(k === "3" ? "3 paar" : await term(k === "mix" ? MIX : MIXW, k === "mix" ? 3 : 4));
const create = [];
sizeVars.forEach((sv, i) => packs.forEach(({ v, k }, j) => create.push({
  attributes: [{ id: 3, option: sizes[i] }, { id: 6, option: aantal[j + 1] }],
  regular_price: v.regular_price, sale_price: v.sale_price || "", manage_stock: false, stock_status: sv.stock_status,
  sku: `${sv.sku}-3paar${k === "3" ? "" : "-" + k}`, image: sv.image?.id ? { id: sv.image.id } : undefined, menu_order: i * 10 + j + 1, status: sv.status,
})));
const update = sizeVars.map((sv, i) => ({ id: sv.id, attributes: [{ id: 3, option: sizes[i] }, { id: 6, option: "1 paar" }], menu_order: i * 10 }));
console.log("  aantal:", aantal.join(" / "));
for (const c of create) console.log("  + ", c.attributes.map(a => a.option).join(" + "), c.regular_price, c.sale_price || "", c.stock_status, c.sku);
console.log("  - verwijderen:", orphans.map(v => v.id).join(", "));
if (!APPLY) process.exit(0);
await api(`products/${ID}`, "PUT", { attributes: [
  { id: 3, position: 0, visible: maat.visible, variation: true, options: sizes },
  { id: 6, position: 1, visible: true, variation: true, options: aantal }] });
const r = await api(`products/${ID}/variations/batch`, "POST", { update, create, delete: orphans.map(v => v.id) });
for (const x of [...(r.update || []), ...(r.create || []), ...(r.delete || [])]) if (x.error) console.log("  FOUT", x.id, x.error.message);
await api(`products/${ID}`, "PUT", { status: p.status });
const after = await api(`products/${ID}/variations?per_page=100`);
console.log("  NL nu:", after.map(v => v.attributes.map(a => a.option).join("+") + " " + v.price + " " + v.stock_status).join(" | "));
const en = p.translations?.en;
if (en) { const ev = await api(`products/${en}/variations?per_page=100&lang=en`); console.log("  EN nu:", ev.map(v => v.attributes.map(a => a.option).join("+") + " " + v.price).join(" | ")); }
