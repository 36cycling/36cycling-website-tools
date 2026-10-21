// Bedankpagina's /nl/contact/bedankt/ en /en/contact/thank-you/ (zelfde URL's en tekst als de oude site).
// Google Tag Manager meet contact- en offerteaanvragen aan een bezoek aan deze pagina's (trigger form_submit_contact:
// referrer bevat "contact"; form_submit_offerte: referrer bevat "teamleader"). Daarna sturen de contactformulieren
// (Fluent Forms 1, 2 → NL; 4, 5 → EN) door naar deze pagina's. noindex.
//   node scripts/build-bedankt.mjs
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { blocks } from "../lib/build.mjs";

const { paragraph, buttons, breadcrumbs } = blocks;
const cfg = await loadConfig();
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const STATE = new URL("../state.json", import.meta.url);
const call = async (method, path, body) => {
  const r = await fetch(W + path, { method, headers: H, body: body && JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
};
const h1 = (t) => `<!-- wp:heading {"level":1,"fontSize":"x-large"} -->\n<h1 class="wp-block-heading has-x-large-font-size">${t}</h1>\n<!-- /wp:heading -->`;

const PAGES = {
  nl: {
    parent: 18, slug: "bedankt", title: "Bedankt", forms: [1, 2],
    content: [breadcrumbs(), h1("Bedankt"),
      paragraph("We hebben uw bericht in goede orde ontvangen. Dank u wel voor je interesse.<br>U ontvangt zo snel mogelijk een reactie."),
      paragraph("Team 36 Cycling"),
      buttons([{ text: "Naar de homepage", href: "/nl/" }, { text: "Bekijk de shop", href: "/nl/shop/" }])],
  },
  en: {
    parent: 6512, slug: "thank-you", title: "Thank you", forms: [4, 5],
    content: [breadcrumbs(), h1("Thank you"),
      paragraph("Your message has been sent. You will receive a response as soon as possible."),
      paragraph("Team 36 Cycling"),
      buttons([{ text: "To the homepage", href: "/en/" }, { text: "Visit the shop", href: "/en/cycling-clothing/" }])],
  },
};

const state = JSON.parse(await readFile(STATE, "utf8"));
const ids = {};
for (const [lang, p] of Object.entries(PAGES)) {
  const key = `bedankt-${lang}`;
  const res = await upsertPage(cfg, {
    id: state[key]?.id, title: p.title, slug: p.slug, parent: p.parent, lang, status: "publish",
    content: p.content.join("\n\n"),
    meta: { _yoast_wpseo_title: p.title, "_yoast_wpseo_meta-robots-noindex": "1" },
  });
  ids[lang] = res.id;
  state[key] = { id: res.id, link: res.link };
  console.log(`${lang}: ${res.id} ${res.status} ${res.link}`);
}
await call("POST", "/c36/v1/link", { element_type: "post_page", source_id: ids.nl, translation_id: ids.en, lang: "en", source_lang: "nl" });
await writeFile(STATE, JSON.stringify(state, null, 2));

// Formulieren: na verzenden doorsturen naar de bedankpagina (backup van de oude instellingen in backups/).
for (const [lang, p] of Object.entries(PAGES)) {
  for (const formId of p.forms) {
    const [cur] = await call("GET", `/fluentform/v1/settings/${formId}?meta_key=formSettings`);
    await writeFile(new URL(`../backups/fluentform-${formId}-formSettings-${Date.now()}.json`, import.meta.url), JSON.stringify(cur, null, 2));
    const value = { ...cur.value, confirmation: { ...cur.value.confirmation, redirectTo: "customPage", customPage: ids[lang] } };
    await call("POST", `/fluentform/v1/settings/${formId}`, { meta_key: "formSettings", meta_id: cur.id, value: JSON.stringify(value) });
    const [after] = await call("GET", `/fluentform/v1/settings/${formId}?meta_key=formSettings`);
    console.log(`formulier ${formId} → ${after.value.confirmation.redirectTo} ${after.value.confirmation.customPage}`);
  }
}
