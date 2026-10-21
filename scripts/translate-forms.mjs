// Engelse Fluent Forms: kopieën 4/5/6 van NL-formulieren 1/2/3 vertalen (velden, meldingen, knop, bevestiging).
// Kaart NL→EN-formulier staat in translations/en/forms.json (gebruikt door translate-en.mjs bij apply).
import { loadConfig } from "../lib/wp.mjs";
import { writeFile } from "node:fs/promises";

const cfg = await loadConfig();
const A = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const F = cfg.wp.baseUrl + "/wp-json/fluentform/v1";
const PAIRS = { 1: 4, 2: 5, 3: 6 };
const TITLES = { 4: "Contact form (EN)", 5: "Contact form Quick (EN)", 6: "36 Cycling Circle – sign up (EN)" };
const T = {
  "Naam": "Name", "Voornaam": "First name", "Achternaam": "Last name", "tussenvoegsel": "Middle name", "Tussenvoegsel": "Middle name",
  "E-mail": "E-mail", "E-mailadres": "E-mail address", "Telefoon": "Phone", "Telefoonnummer": "Phone number", "Aantal": "Quantity",
  "Om hoeveel kledingstukken gaat het ongeveer?": "Approximately how many items are we talking about?",
  "Bericht": "Message", "Schrijf hier uw vraag of bericht": "Write your question or message here",
  "Schrijf hier om hoeveel stuks het gaat, welke kleding u wenst, wat de leverdatum is, etc.": "Tell us how many pieces, which clothing you would like, your preferred delivery date, etc.",
  "Versturen": "Send", "Aanmelden": "Sign up",
  "Vul je voornaam in": "Please enter your first name", "Vul je achternaam in": "Please enter your last name",
  "Vul je e-mailadres in": "Please enter your e-mail address", "Vul een geldig e-mailadres in": "Please enter a valid e-mail address",
  "This field is required": "This field is required", "This field must contain a valid email": "This field must contain a valid e-mail address",
  "Dit veld is vereist": "This field is required", "Dit veld moet een een numerieke waarde bevatten": "This field must contain a numeric value",
  "Validatie mislukt voor minimum waarde": "The value is below the minimum", "Validatie mislukt voor maximale waarde": "The value is above the maximum",
  "Validatie mislukt voor beperkte cijfers": "Too many digits",
};
const CONFIRM = {
  4: '<h3 style="text-align: center;">Thank you for your message.</h3>\n<p style="text-align: center;">We will get back to you soon!</p>',
  5: '<h3 style="text-align: center;">Thank you for your message.</h3>\n<p style="text-align: center;">We will get back to you soon!</p>',
  6: "<p><strong>Welcome to the 36 Cycling Circle!</strong></p><p>You're signed up. From now on, with this e-mail address you get 10% off the collection on every order in our web shop and free cycling socks on orders from € 50.</p>",
  3: "<p><strong>Welkom bij de 36 Cycling Circle!</strong></p><p>Je bent aangemeld. Vanaf nu krijg je met dit e-mailadres bij elke bestelling in onze webshop 10% korting op de collectie en gratis fietssokken bij bestellingen vanaf € 50.</p>",
};
const missing = new Set();
const tr = (s) => { if (!s || typeof s !== "string") return s; if (T[s]) return T[s]; if (/[a-z]/i.test(s) && !/^[a-z_]+$/.test(s)) missing.add(s); return s; };
// Recursief: labels, placeholders, admin-labels, validatie- en hulpteksten.
const KEYS = /^(label|placeholder|admin_field_label|help_message|message|text)$/;
function walk(o) {
  if (Array.isArray(o)) return o.forEach(walk);
  if (!o || typeof o !== "object") return;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" && KEYS.test(k)) o[k] = tr(v);
    else walk(v);
  }
}
const post = (path, data) => fetch(F + path, { method: "POST", headers: { ...A, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data) });

for (const en of Object.values(PAIRS)) {
  const f = await (await fetch(`${F}/forms/${en}`, { headers: A })).json();
  const ff = JSON.parse(f.form_fields);
  walk(ff.fields); walk(ff.submitButton);
  const r = await post(`/forms/${en}`, { title: TITLES[en], status: "published", formFields: JSON.stringify(ff), form_fields: JSON.stringify(ff) });
  console.log(`form ${en} velden: ${r.status}`);
}
for (const id of [4, 5, 6, 3]) {
  const s = (await (await fetch(`${F}/settings/${id}?meta_key=formSettings`, { headers: A })).json())[0];
  s.value.confirmation.messageToShow = CONFIRM[id];
  const r = await post(`/settings/${id}`, { meta_key: "formSettings", meta_id: String(s.id), value: JSON.stringify(s.value) });
  console.log(`form ${id} bevestiging: ${r.status}`);
}
if (missing.size) console.log("Niet vertaald:", [...missing]);
await writeFile(new URL("../translations/en/forms.json", import.meta.url), JSON.stringify(PAIRS, null, 2));
const feeds = await (await fetch(`${F}/integrations/6/form-integrations`, { headers: A })).json();
console.log("form 6 koppelingen:", JSON.stringify((feeds.feeds || []).map((x) => `${x.provider} list ${x.feed?.list_id} tags ${x.feed?.tag_ids}`)));
