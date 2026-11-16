// Maatonderzoek: formulier waarmee klanten doorgeven welke maat ze dragen (gegevens voor een betrouwbare maattabel en de maatwijzer).
// Maakt/werkt bij: 6 lichaamstekeningen (media), Fluent Forms NL + EN, en de pagina's /nl/maatonderzoek/ en /en/size-survey/.
// Nieuwe pagina's worden als CONCEPT aangemaakt; een bestaande pagina houdt zijn status. noindex.
// Inzendingen: Fluent Forms → Inzendingen (geen melding per mail, geen doorsturen naar de bedankpagina: dat is het meetpunt voor contact).
//   node scripts/build-maatonderzoek.mjs            → alles
//   node scripts/build-maatonderzoek.mjs --forms    → alleen de formulieren bijwerken (velden, teksten, bevestiging, opmaak)
//   node scripts/build-maatonderzoek.mjs --css      → alleen de eigen opmaak van de formulieren bijwerken (velden blijven zoals ze in het beheer staan)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadConfig, upsertPage, uploadMedia } from "../lib/wp.mjs";
import { blocks } from "../lib/build.mjs";

const ONLY_CSS = process.argv.includes("--css");
const ONLY_FORMS = ONLY_CSS || process.argv.includes("--forms");
const { paragraph, breadcrumbs } = blocks;
const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const W = cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json";
const F = W + "/fluentform/v1";
const ROOT = new URL("..", import.meta.url);
const STATE = new URL("state.json", ROOT);
const state = JSON.parse(await readFile(STATE, "utf8"));
const mine = (state.maatonderzoek ||= { forms: {}, media: {} });
const save = () => writeFile(STATE, JSON.stringify(state, null, 2));

async function ff(method, path, data) {
  const r = await fetch(F + path, {
    method, headers: { ...AUTH, ...(data ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: data ? new URLSearchParams(data) : undefined,
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${String(t).slice(0, 300)}`);
  return j;
}
async function wp(method, path, body) {
  const r = await fetch(W + path, { method, headers: { ...AUTH, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

// ---------- 1. Tekeningen ----------
const IMG = ["bovenlichaam-smal", "bovenlichaam-gemiddeld", "bovenlichaam-breed", "buik-vlak", "buik-gemiddeld", "buik-rond", "meten-borst", "meten-taille", "meten-heup"];
for (const naam of IMG) {
  if (mine.media[naam]) continue;
  const bestand = `maatwijzer-${naam}.png`;
  const m = await uploadMedia(cfg, {
    filePath: new URL(`media/maatwijzer/${bestand}`, ROOT), filename: bestand,
    altText: `Tekening ${naam.replace("-", " ")}`, title: `Maatwijzer ${naam.replace("-", " ")}`,
  });
  mine.media[naam] = { id: m.id, url: m.source_url };
  await save();
  console.log(`media ${naam} → ${m.id}`);
}
const img = (naam) => mine.media[naam].url;

// ---------- 2. Teksten ----------
const MATEN = ["2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const T = {
  nl: {
    title: "Maatonderzoek (NL)", verplicht: "Maak een keuze", vulIn: "Vul dit veld in", getal: "Vul een getal in",
    tussen: (lo, hi, e) => `Vul een waarde in tussen ${lo} en ${hi} ${e}`,
    pasvorm: "Welke pasvorm draag je?", heren: "Heren", dames: "Dames",
    lengte: "Lengte", gewicht: "Gewicht",
    bouw: "Hoe is je bovenlichaam gebouwd?", smal: "Smal", gemiddeld: "Gemiddeld", breed: "Breed",
    buik: "Hoe ziet je buik er van opzij uit?", vlak: "Vlak", rond: "Rond",
    pas: "Hoe draag je wielerkleding het liefst?", strak: "Strak", normaal: "Normaal", ruim: "Ruim",
    kleding: "Je kleding van 36 Cycling",
    kledingUitleg: "Vul in wat je draagt. Heb je alleen een shirt of alleen een broek? Kies dan bij het andere 'Heb ik niet'.",
    shirtMaat: "Welke maat shirt draag je?", shirtZit: "Hoe zit dat shirt?",
    broekMaat: "Welke maat broek draag je?", broekZit: "Hoe zit die broek?",
    geen: "Heb ik niet", zitStrak: "Iets te strak", zitGoed: "Precies goed", zitRuim: "Iets te ruim",
    extra: "Extra (optioneel)",
    extraUitleg: "Overslaan mag: je kunt nu al versturen. Wat je hier wel invult, maakt de maattabel nog preciezer.",
    leeftijd: "Leeftijd", jaar: "jaar",
    ander: "Welke maat draag je bij een ander merk?", anderVb: "Bijvoorbeeld: AGU L, Castelli XL",
    opmerking: "Opmerking", opmerkingVb: "Bijvoorbeeld: shirt te kort, bretels trekken",
    meetlint: "Meetlint bij de hand?",
    meetlintUitleg: "Meet op de huid of over dunne kleding, lint horizontaal en niet strak aangetrokken. Eén of twee maten invullen mag ook.",
    borst: "Borstomtrek", taille: "Taille", heup: "Heupomtrek",
    meetBorst: "Meet rond het breedste deel van je borst, net onder je oksels.",
    meetTaille: "Meet rond het smalste deel van je middel, meestal net boven je navel.",
    meetHeup: "Meet rond het breedste deel van je heupen en billen.",
    knop: "Verstuur",
    bedankt: "<h3>Bedankt voor je hulp!</h3>\n<p>Je antwoorden zijn goed aangekomen. Dankzij jou wordt onze maattabel weer een stukje betrouwbaarder.</p>",
  },
  en: {
    title: "Maatonderzoek (EN)", verplicht: "Please make a choice", vulIn: "Please fill in this field", getal: "Please enter a number",
    tussen: (lo, hi, e) => `Please enter a value between ${lo} and ${hi} ${e}`,
    pasvorm: "Which fit do you wear?", heren: "Men", dames: "Women",
    lengte: "Height", gewicht: "Weight",
    bouw: "How is your upper body built?", smal: "Slim", gemiddeld: "Average", breed: "Broad",
    buik: "What does your belly look like from the side?", vlak: "Flat", rond: "Round",
    pas: "How do you prefer to wear cycling clothing?", strak: "Tight", normaal: "Regular", ruim: "Loose",
    kleding: "Your 36 Cycling clothing",
    kledingUitleg: "Tell us what you wear. Do you only have a jersey or only bib shorts? Then choose 'I don't have one' for the other.",
    shirtMaat: "Which jersey size do you wear?", shirtZit: "How does that jersey fit?",
    broekMaat: "Which bib shorts size do you wear?", broekZit: "How do those bib shorts fit?",
    geen: "I don't have one", zitStrak: "A little too tight", zitGoed: "Just right", zitRuim: "A little too loose",
    extra: "Extra (optional)",
    extraUitleg: "Feel free to skip this: you can already send the form. Anything you do fill in makes the size chart even more accurate.",
    leeftijd: "Age", jaar: "years",
    ander: "Which size do you wear in another brand?", anderVb: "For example: AGU L, Castelli XL",
    opmerking: "Comment", opmerkingVb: "For example: jersey too short, straps pull",
    meetlint: "Got a tape measure at hand?",
    meetlintUitleg: "Measure on the skin or over thin clothing, keep the tape horizontal and don't pull it tight. Filling in just one or two measurements is fine too.",
    borst: "Chest", taille: "Waist", heup: "Hips",
    meetBorst: "Measure around the fullest part of your chest, just under your armpits.",
    meetTaille: "Measure around the narrowest part of your waist, usually just above your navel.",
    meetHeup: "Measure around the fullest part of your hips and buttocks.",
    knop: "Send",
    bedankt: "<h3>Thank you for your help!</h3>\n<p>Your answers have arrived safely. Thanks to you, our size chart just became a little more reliable.</p>",
  },
};

// ---------- 3. Velden ----------
function bouwVelden(t) {
  let n = 0;
  const key = () => `el_3600000${String(++n).padStart(3, "0")}`;
  const req = (aan, message) => ({ required: { value: aan, message, global_message: message, global: false } });
  const zichtbaarAls = (veld) => ({ type: "any", status: true, conditions: [{ field: veld, operator: "!=", value: "geen" }] });

  const keuze = (name, label, opties, { beeld = false, layout = "ff_list_buttons", verplicht = true, als = null } = {}) => ({
    index: 8, element: "input_radio", uniqElKey: key(),
    attributes: { type: "radio", name, value: "" },
    settings: {
      dynamic_default_value: "", container_class: "", label, admin_field_label: name, label_placement: "", display_type: "", help_message: "",
      randomize_options: "no",
      advanced_options: opties.map(([value, lab, image]) => ({ label: lab, value, calc_value: "", image: image || "" })),
      calc_value_status: false, enable_image_input: beeld, values_visible: false,
      enable_other_option: "no", other_option_label: "", other_option_placeholder: "", other_option_required_message: "",
      validation_rules: req(verplicht, t.verplicht),
      conditional_logics: als ? zichtbaarAls(als) : [], layout_class: layout,
    },
    editor_options: { title: "Radiobutton veld", icon_class: "ff-edit-radio", element: "input-radio", template: "inputCheckable" },
  });
  // Uitleg achter de i-knop naast de veldnaam (Fluent Forms: help_message als tooltip): tekening + één zin.
  const uitleg = (beeld, tekst) => `<span class="c36-meet"><img src="${img(beeld)}" alt="" width="150" height="212">${tekst}</span>`;
  const getal = (name, label, eenheid, [lo, hi], verplicht, help = "") => ({
    index: 6, element: "input_number", uniqElKey: key(),
    attributes: { autocomplete: "off", type: "number", name, value: "", id: "", class: "", placeholder: "" },
    settings: {
      container_class: "", label, admin_field_label: name, label_placement: "", help_message: help, number_step: "any",
      prefix_label: "", suffix_label: eenheid, numeric_formatter: "", mobile_keyboard_type_number: "",
      validation_rules: {
        ...req(verplicht, t.vulIn),
        numeric: { value: true, message: t.getal, global_message: t.getal, global: false },
        min: { value: String(lo), message: t.tussen(lo, hi, eenheid), global_message: "", global: false },
        max: { value: String(hi), message: t.tussen(lo, hi, eenheid), global_message: "", global: false },
        digits: { value: "", message: "", global_message: "", global: false },
      },
      conditional_logics: [], calculation_settings: { status: false, formula: "" },
    },
    editor_options: { title: "Numeriek veld", icon_class: "ff-edit-numeric", template: "inputText" },
  });
  const tekst = (name, label, placeholder) => ({
    index: 2, element: "input_text", uniqElKey: key(),
    attributes: { autocomplete: "off", type: "text", name, value: "", class: "", placeholder, maxlength: "80" },
    settings: {
      container_class: "", label, label_placement: "", admin_field_label: name, help_message: "", prefix_label: "", suffix_label: "",
      validation_rules: req(false, t.vulIn), conditional_logics: [], is_unique: "no", unique_validation_message: "",
    },
    editor_options: { title: "Eenvoudige tekst", icon_class: "ff-edit-text", template: "inputText" },
  });
  const tekstvak = (name, label, placeholder) => ({
    index: 3, element: "textarea", uniqElKey: key(),
    attributes: { autocomplete: "off", name, value: "", id: "", class: "", placeholder, rows: 3, cols: 2, maxlength: "400" },
    settings: {
      container_class: "", label, admin_field_label: name, label_placement: "", help_message: "", prefix_label: "", suffix_label: "",
      validation_rules: req(false, t.vulIn), conditional_logics: [],
    },
    editor_options: { title: "Tekstgebied", icon_class: "ff-edit-textarea", template: "inputTextarea" },
  });
  const sectie = (label, description) => ({
    index: 1, element: "section_break", uniqElKey: key(), attributes: { id: "", class: "" },
    settings: { label, description, align: "left", conditional_logics: [] },
    editor_options: { title: "Sectie einde", icon_class: "ff-edit-section-break", template: "sectionBreak" },
  });
  const kolommen = (...velden) => ({
    index: 1, element: "container", uniqElKey: key(), attributes: [],
    settings: { container_class: "", conditional_logics: [], container_width: "", is_width_auto_calc: true },
    columns: velden.map((v) => ({ width: Math.round(10000 / velden.length) / 100, fields: [v] })),
    editor_options: { title: "Kolommen", icon_class: "ff-edit-column-2" },
  });

  const maten = [...MATEN.map((m) => [m, m]), ["geen", t.geen]];
  const zit = [["strak", t.zitStrak], ["goed", t.zitGoed], ["ruim", t.zitRuim]];
  return [
    keuze("pasvorm", t.pasvorm, [["heren", t.heren], ["dames", t.dames]]),
    kolommen(getal("lengte", t.lengte, "cm", [140, 215], true), getal("gewicht", t.gewicht, "kg", [40, 160], true)),
    keuze("bovenlichaam", t.bouw, [["smal", t.smal, img("bovenlichaam-smal")], ["gemiddeld", t.gemiddeld, img("bovenlichaam-gemiddeld")], ["breed", t.breed, img("bovenlichaam-breed")]], { beeld: true, layout: "ff_list_3col" }),
    keuze("buik", t.buik, [["vlak", t.vlak, img("buik-vlak")], ["gemiddeld", t.gemiddeld, img("buik-gemiddeld")], ["rond", t.rond, img("buik-rond")]], { beeld: true, layout: "ff_list_3col" }),
    keuze("pasvoorkeur", t.pas, [["strak", t.strak], ["normaal", t.normaal], ["ruim", t.ruim]]),
    sectie(t.kleding, t.kledingUitleg),
    keuze("shirt_maat", t.shirtMaat, maten),
    keuze("shirt_zit", t.shirtZit, zit, { als: "shirt_maat" }),
    keuze("broek_maat", t.broekMaat, maten),
    keuze("broek_zit", t.broekZit, zit, { als: "broek_maat" }),
    sectie(t.extra, t.extraUitleg),
    kolommen(getal("leeftijd", t.leeftijd, t.jaar, [12, 95], false), tekst("ander_merk", t.ander, t.anderVb)),
    tekstvak("opmerking", t.opmerking, t.opmerkingVb),
    sectie(t.meetlint, t.meetlintUitleg),
    kolommen(getal("borst", t.borst, "cm", [70, 140], false, uitleg("meten-borst", t.meetBorst)), getal("taille", t.taille, "cm", [55, 140], false, uitleg("meten-taille", t.meetTaille)), getal("heup", t.heup, "cm", [70, 150], false, uitleg("meten-heup", t.meetHeup))),
  ];
}
const knop = (t) => ({
  uniqElKey: "el_3600000999", element: "button", attributes: { type: "submit", class: "" },
  settings: {
    align: "left", button_style: "", container_class: "", help_message: "", background_color: "", button_size: "md", color: "",
    button_ui: { type: "default", text: t.knop, img_url: "" },
    normal_styles: { backgroundColor: "#000000", borderColor: "#000000", color: "#ffffff", borderRadius: "", minWidth: "" },
    hover_styles: { backgroundColor: "#1b2629", borderColor: "#1b2629", color: "#ffffff", borderRadius: "", minWidth: "" },
    current_state: "normal_styles",
  },
  editor_options: { title: "Submit Button" },
});

// ---------- 4. Formulieren ----------
await mkdir(new URL("backups/", ROOT), { recursive: true });
for (const lang of ["nl", "en"]) {
  const t = T[lang];
  let id = mine.forms[lang];
  if (!id) {
    const nieuw = await ff("POST", "/forms", { predefined: "blank_form" });
    id = nieuw.formId ?? nieuw.id ?? nieuw.form?.id;
    if (!id) throw new Error("Formulier aangemaakt, maar geen id in het antwoord: " + JSON.stringify(nieuw).slice(0, 300));
    mine.forms[lang] = id = Number(id);
    await save();
    console.log(`formulier ${lang} aangemaakt → ${id}`);
  } else {
    const huidig = await ff("GET", `/forms/${id}`);
    await writeFile(new URL(`backups/fluentform-${id}-fields-${Date.now()}.json`, ROOT), JSON.stringify(huidig, null, 2));
  }
  if (!ONLY_CSS) {
  const velden = JSON.stringify({ fields: bouwVelden(t), submitButton: knop(t) });
  await ff("POST", `/forms/${id}`, { title: t.title, status: "published", formFields: velden, form_fields: velden });

  // Na verzenden: bedankje op dezelfde pagina (niet naar /contact/bedankt/, dat telt als contactaanvraag in Tag Manager).
  const [inst] = await ff("GET", `/settings/${id}?meta_key=formSettings`);
  const waarde = { ...inst.value, confirmation: { ...inst.value.confirmation, redirectTo: "samePage", messageToShow: t.bedankt, samePageFormBehavior: "hide_form" } };
  await ff("POST", `/settings/${id}`, { meta_key: "formSettings", meta_id: String(inst.id), value: JSON.stringify(waarde) });
  }

  // Eigen opmaak van dit formulier (Fluent Forms → formulier → Instellingen → Aangepaste CSS/JS). Bron: wp-root/maatonderzoek-form.css.
  const css = (await readFile(new URL("wp-root/maatonderzoek-form.css", ROOT), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replaceAll("__W__", `.fluentform.fluentform_wrapper_${id}`).trim();
  await ff("POST", `/settings/${id}/customizer`, { form_id: String(id), css, js: "" });
  const opmaak = await ff("GET", `/settings/${id}/customizer`);
  if ((opmaak.css || "").length < css.length * 0.9) console.log(`  ! eigen opmaak niet (volledig) opgeslagen: ${(opmaak.css || "").length} van ${css.length} tekens`);

  const na = await ff("GET", `/forms/${id}`);
  const opgeslagen = JSON.parse(na.form_fields);
  const namen = [];
  (function loop(lijst) { for (const v of lijst) { if (v.columns) v.columns.forEach((k) => loop(k.fields)); else if (v.attributes?.name) namen.push(v.attributes.name); } })(opgeslagen.fields);
  const meld = await ff("GET", `/settings/${id}?meta_key=notifications`);
  console.log(`formulier ${lang} #${id}: "${na.title}" | ${namen.length} velden: ${namen.join(", ")} | knop "${opgeslagen.submitButton.settings.button_ui.text}" | mailmeldingen: ${JSON.stringify((Array.isArray(meld) ? meld : [meld]).map((m) => m?.value?.enabled))}`);
}

// Koppeling NL-formulier → EN-formulier (voor translate-en.mjs).
const FORMS = new URL("translations/en/forms.json", ROOT);
const paren = JSON.parse(await readFile(FORMS, "utf8"));
if (paren[mine.forms.nl] !== mine.forms.en) { paren[mine.forms.nl] = mine.forms.en; await writeFile(FORMS, JSON.stringify(paren, null, 2)); }
// Gepubliceerde pagina's opnieuw opslaan (inhoud blijft gelijk): LiteSpeed leegt dan zijn opgeslagen versie,
// zodat bezoekers de nieuwe velden en opmaak meteen zien.
for (const lang of ["nl", "en"]) {
  const pid = state[`maatonderzoek-${lang}`]?.id;
  if (!pid) continue;
  const cur = await wp("GET", `/wp/v2/pages/${pid}?context=edit&lang=${lang}&_fields=status`);
  if (cur.status === "publish") { await wp("POST", `/wp/v2/pages/${pid}?lang=${lang}`, { status: "publish" }); console.log(`pagina ${lang} ververst`); }
}
if (ONLY_FORMS) process.exit(0);

// ---------- 5. Pagina's (concept, noindex) ----------
const h1 = (tekst) => `<!-- wp:heading {"level":1,"fontSize":"x-large"} -->\n<h1 class="wp-block-heading has-x-large-font-size">${tekst}</h1>\n<!-- /wp:heading -->`;
const formulier = (id) => `<!-- wp:shortcode -->\n[fluentform id="${id}"]\n<!-- /wp:shortcode -->`;
const PAGES = {
  nl: {
    slug: "maatonderzoek", title: "Welke maat draag jij?",
    content: [breadcrumbs(), h1("Welke maat draag jij?"),
      paragraph("We werken aan een maattabel waar je echt op kunt vertrouwen. Help je mee? Vertel ons welke maat je draagt en hoe die zit. Het kost een minuut en we vragen geen naam of e-mailadres."),
      formulier(mine.forms.nl)],
  },
  en: {
    slug: "size-survey", title: "Which size do you wear?",
    content: [breadcrumbs(), h1("Which size do you wear?"),
      paragraph("We're working on a size chart you can really rely on. Will you help? Tell us which size you wear and how it fits. It takes a minute and we don't ask for your name or e-mail address."),
      formulier(mine.forms.en)],
  },
};
const ids = {};
for (const [lang, p] of Object.entries(PAGES)) {
  const key = `maatonderzoek-${lang}`;
  const bestond = !!state[key]?.id;
  const res = await upsertPage(cfg, {
    id: state[key]?.id, title: p.title, slug: p.slug, lang, status: "draft", content: p.content.join("\n\n"),
    meta: { _yoast_wpseo_title: p.title, "_yoast_wpseo_meta-robots-noindex": "1" },
  });
  ids[lang] = res.id;
  state[key] = { id: res.id, link: res.link };
  await save();
  console.log(`pagina ${lang}: #${res.id} ${res.status} ${res.link}${bestond ? " (bijgewerkt)" : " (nieuw)"}`);
}
const vert = await wp("GET", `/c36/v1/translations?element_type=post_page&id=${ids.nl}`);
if (vert.translations?.en?.element_id !== ids.en) {
  await wp("POST", "/c36/v1/link", { element_type: "post_page", source_id: ids.nl, translation_id: ids.en, lang: "en", source_lang: "nl" });
  console.log("NL- en EN-pagina gekoppeld in WPML");
}
