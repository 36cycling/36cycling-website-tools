// Import oude webshopbestellingen (Umbraco, shop 36Cycling) → WooCommerce via mu-plugin 36cycling-legacy-import.php.
// Bron: private/36cycling-orders-2019-2026.json (export uit de Umbraco-backoffice). Persoonsgegevens: logt alleen ID's.
//   node scripts/legacy-import.mjs --dry                 → alleen controleren en samenvatten
//   node scripts/legacy-import.mjs --ids=123,456         → alleen deze oude order-ID's (test)
//   node scripts/legacy-import.mjs                       → alles vanaf FROM met geldige status
//   --replace  bestaande (eerder geïmporteerde) bestellingen opnieuw opbouwen
import { readFile, appendFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const FROM = args.from || "2022-01-01";
const VALID = new Set(["Shipped", "Processing", "Paid"]);
const COUNTRY = { Nederland: "NL", Belgie: "BE", "België": "BE", Germany: "DE", Duitsland: "DE", Italy: "IT", Australia: "AU", "United Kingdom": "GB", Austria: "AT", Ireland: "IE", Spain: "ES", "Czech Republic": "CZ", Denmark: "DK", France: "FR", Switzerland: "CH" };
const P = (p) => new URL("../" + p, import.meta.url);

const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const data = JSON.parse(await readFile(P("private/36cycling-orders-2019-2026.json"), "utf8"));
const products = JSON.parse(await readFile(P("audit/products.json"), "utf8"));
const byOld = {};
for (const p of products) { const m = (p.oldPath || "").match(/\/nl\/shop\/(\d+)\//); if (m) byOld[m[1]] = p.id; }

const cents = (v) => (parseInt(v, 10) || 0) / 100;
const variantMeta = (s) => {
  const meta = {};
  for (const part of String(s || "").split(/,\s*(?=[A-Za-zÀ-ÿ ]+:)/)) {
    const i = part.indexOf(":");
    if (i > 0) meta[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    else if (part.trim()) meta["Variant"] = part.trim();
  }
  return meta;
};
const country = (udi) => COUNTRY[data.countries[udi]] || (data.countries[udi] ? null : "NL");

function build(o) {
  const items = [], fees = [];
  let shipping = 0, shippingTitle = "", sum = 0;
  for (const l of o.lines) {
    const total = cents(l.unitPriceInCents) * (parseInt(l.amount, 10) || 1);
    sum += total;
    // Oude interne namen ("VerzendkostenExpress", "Shipping fee") → nette naam in de taal van de bestelling.
    if (l.isShippingCosts === "1") { shipping += total; shippingTitle = o.language === "en" ? "Shipping" : "Verzendkosten"; continue; }
    if (l.isDiscountLine === "1") { fees.push({ name: (l.description || l.name || "Korting").replace(/^Korting:\s*/i, "Korting: "), total }); continue; }
    const pr = data.products[l.product];
    const meta = variantMeta(l.variant);
    if (l.personalization) meta["Personalisatie"] = l.personalization;
    items.push({ name: l.description || l.name, qty: parseInt(l.amount, 10) || 1, total, product_id: pr ? byOld[String(pr.id)] || 0 : 0, meta });
  }
  const street = [o.street, o.housenumber].filter(Boolean).join(" ").trim();
  const dStreet = [o.deliveryStreet, o.deliveryHousenumber].filter(Boolean).join(" ").trim();
  const billing = { first_name: o.firstname || "", last_name: o.lastname || "", company: o.companyName || "", address_1: street, postcode: o.postalcode || "", city: o.city || "", country: country(o.country) || "", email: (o.eMail || "").trim(), phone: o.telephone || "" };
  const shippingAddr = dStreet
    ? { first_name: billing.first_name, last_name: billing.last_name, company: billing.company, address_1: dStreet, postcode: o.deliveryPostalcode || "", city: o.deliveryCity || "", country: country(o.deliveryCountry) || billing.country }
    : { first_name: billing.first_name, last_name: billing.last_name, company: billing.company, address_1: street, postcode: billing.postcode, city: billing.city, country: billing.country };
  const total = cents(o.totalPriceCents);
  return {
    legacy_id: String(o.list.id), legacy_ref: o.paymentID || "", date: o.orderDate, language: o.language || "nl",
    customer: { email: billing.email, first_name: billing.first_name, last_name: billing.last_name, billing, shipping: shippingAddr },
    billing, shipping: shippingAddr, items, fees, shipping_total: Math.round(shipping * 100) / 100, shipping_title: shipping ? shippingTitle : "",
    total, payment_title: "Oude webshop (36cycling.com)", _diff: Math.round((sum - total) * 100) / 100,
  };
}

const ids = args.ids ? new Set(String(args.ids).split(",")) : null;
const selected = data.orders.filter((o) => ids ? ids.has(String(o.list.id)) : (o.orderDate || "") >= FROM && VALID.has((o.orderStatus || [])[0]) && o.lines.length && (o.eMail || "").includes("@"));
const payloads = selected.map(build);
const linesAll = payloads.flatMap((p) => p.items);
const diffs = payloads.filter((p) => Math.abs(p._diff) > 0.02);
console.log(`${payloads.length} bestellingen | ${new Set(payloads.map((p) => p.billing.email.toLowerCase())).size} klanten | productregels ${linesAll.length}, gekoppeld ${linesAll.filter((i) => i.product_id).length} | bedrag regels ≠ totaal: ${diffs.length}`);
const noCountry = payloads.filter((p) => !p.billing.country).length;
if (noCountry) console.log(`  ${noCountry} zonder herkend land`);
if (args.dry) process.exit(0);

let done = 0, made = 0, existed = 0, newCustomers = 0, errors = 0;
for (const p of payloads) {
  const { _diff, ...body } = p;
  if (args.replace) body.replace = true;
  const r = await fetch(`${cfg.wp.baseUrl}/wp-json/c36/v1/legacy-import`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  done++;
  if (!r.ok) { errors++; await appendFile(P("private/legacy-import.log"), `FOUT oud ${p.legacy_id}: ${r.status} ${JSON.stringify(j).slice(0, 200)}\n`); continue; }
  if (j.status === "bestond al") existed++; else made++;
  if (j.customer_created) newCustomers++;
  await appendFile(P("private/legacy-import.log"), `oud ${p.legacy_id} → order ${j.order_id} (klant ${j.customer_id}${j.customer_created ? ", nieuw" : ""}) ${j.status} €${j.total ?? ""}\n`);
  if (done % 50 === 0) console.log(`  ${done}/${payloads.length}`);
}
console.log(`Klaar: ${made} aangemaakt/opnieuw opgebouwd, ${existed} bestonden al, ${newCustomers} nieuwe klantaccounts, ${errors} fouten (zie private/legacy-import.log)`);
