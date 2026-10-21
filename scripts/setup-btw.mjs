// Btw in WooCommerce: 21% voor alles, prijzen ingevoerd inclusief btw (productprijzen blijven gelijk),
// prijzen getoond inclusief btw. Verzendkosten rekent WooCommerce altijd exclusief btw → kosten omgerekend
// zodat de klant hetzelfde bedrag betaalt (€ 7,95 NL, € 10,50 rest).
//   node scripts/setup-btw.mjs
import { loadConfig } from "../lib/wp.mjs";
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json/wc/v3";
const call = async (method, path, body) => {
  const r = await fetch(W + path, { method, headers: H, body: body && JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
};
const rates = await call("GET", "/taxes?per_page=100");
if (!rates.some((t) => t.rate.startsWith("21") && t.country === "" && t.class === "standard")) {
  const t = await call("POST", "/taxes", { country: "", state: "", rate: "21.0000", name: "Btw", priority: 1, compound: false, shipping: true, class: "standard" });
  console.log(`Btw-tarief aangemaakt: #${t.id} ${t.rate}% (alle landen, ook verzending)`);
} else console.log("Btw-tarief 21% bestond al");
for (const [group, id, value] of [
  ["tax", "woocommerce_prices_include_tax", "yes"],
  ["tax", "woocommerce_tax_display_shop", "incl"],
  ["tax", "woocommerce_tax_display_cart", "incl"],
  ["general", "woocommerce_calc_taxes", "yes"],
]) {
  const r = await call("PUT", `/settings/${group}/${id}`, { value });
  console.log(`${id} = ${r.value}`);
}
const SHIP = { 7.95: "6.5702479", 10.5: "8.6776860" };
for (const z of await call("GET", "/shipping/zones")) {
  for (const m of await call("GET", `/shipping/zones/${z.id}/methods`)) {
    const cur = parseFloat(m.settings?.cost?.value);
    if (m.method_id === "flat_rate" && SHIP[cur]) {
      await call("PUT", `/shipping/zones/${z.id}/methods/${m.instance_id}`, { settings: { cost: SHIP[cur] } });
      console.log(`Verzending ${z.name}: ${cur} (incl.) → ${SHIP[cur]} excl. btw`);
    } else console.log(`Verzending ${z.name}: ${m.settings?.cost?.value} ongewijzigd`);
  }
}
