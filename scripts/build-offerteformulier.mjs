// Offerteformulier (Fluent Forms, NL + EN) ter vervanging van het Teamleader-formulier "Bereken je prijs" (iframe) op
// /nl/offerteaanvraag/ (1844) en /en/request-a-quote/ (6752). 20 nov 2026, vraag Jeroen: mooier en toegankelijker, mail naar info@.
// - Melding naar info@36cycling.com, antwoordadres = e-mail van de aanvrager.
// - Na verzenden naar dezelfde bedankpagina als het Teamleader-formulier (8208 / 8209): meetpunt van Tag Manager.
// - Eerst een CONCEPT-voorbeeldpagina per taal (noindex); het formulier komt pas op de echte offertepagina na akkoord van Jeroen.
//   node scripts/build-offerteformulier.mjs           → formulieren + voorbeeldpagina's
//   node scripts/build-offerteformulier.mjs --forms   → alleen de formulieren bijwerken (velden, teksten, melding, opmaak)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadConfig, upsertPage } from "../lib/wp.mjs";

const ONLY_FORMS = process.argv.includes("--forms");
const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const W = cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json";
const F = W + "/fluentform/v1";
const ROOT = new URL("..", import.meta.url);
const STATE = new URL("state.json", ROOT);
const state = JSON.parse(await readFile(STATE, "utf8"));
const mine = (state.offerteformulier ||= { forms: {} });
const save = () => writeFile(STATE, JSON.stringify(state, null, 2));
const MAIL = "info@36cycling.com";

async function ff(method, path, data) {
  const r = await fetch(F + path, { method, headers: { ...AUTH, ...(data ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: data ? new URLSearchParams(data) : undefined });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${String(t).slice(0, 300)}`);
  return j;
}

const T = {
  nl: {
    title: "Offerteaanvraag (NL)", verplicht: "Dit veld is verplicht", kies: "Maak een keuze", email: "Vul een geldig e-mailadres in",
    voornaam: "Voornaam", achternaam: "Achternaam", mail: "E-mail", tel: "Telefoon (optioneel)", telHelp: "Handig als we iets kort willen afstemmen.",
    org: "Club, team of bedrijf (optioneel)", orgVb: "Bijvoorbeeld: WTC De Spaakjes",
    sec1: "Wat wil je laten maken?",
    sport: "Om welke sport gaat het?", sporten: ["Wielrennen", "Mountainbike / gravel", "Hardlopen", "Schaatsen", "Triatlon", "Veldsport", "Anders"],
    prod: "Welke producten?", producten: ["Shirts", "Korte broeken", "Lange broeken", "Jacks", "Windvesten", "Anders"],
    aantal: "Hoeveel stuks?", aantalHelp: "Weet je het nog niet precies? Vul een schatting in.", getal: "Vul een aantal in (1 of meer)",
    tip: '<div class="c36-tip"><p>Een volledig eigen ontwerp maken we vanaf 5 stuks. Voor minder stuks bedrukken we een <a href="/nl/snel-wielershirt-bedrukken/">wielershirt uit voorraad met je eigen logo</a>, binnen enkele dagen klaar. Je kunt dit formulier gewoon versturen, dan denken we met je mee.</p></div>',
    kwal: "Welke kwaliteit zoek je?", kwaliteiten: [["budget", "Budget / recreatief"], ["amateur", "Amateur / enthousiast"], ["semipro", "Semi-professioneel"], ["pro", "Professioneel / elite"], ["weet-niet", "Weet ik nog niet"]],
    sec2: "Ontwerp en planning",
    ontwerp: "Heb je al een ontwerp?", ontwerpen: [["ontwerp", "Ja, een volledig ontwerp"], ["logo", "Ik heb een logo"], ["hulp", "Nee, ik wil hulp bij het ontwerp"]],
    wanneer: "Wanneer heb je de kleding nodig? (optioneel)", wanneerVb: "Bijvoorbeeld: half maart, voor een toertocht",
    opm: "Vragen of opmerkingen (optioneel)", opmVb: "Bijvoorbeeld: welke kleuren, namen of nummers op de shirts, of iets anders dat we moeten weten. Een ontwerp of logo kun je na je aanvraag mailen.",
    knop: "Offerte aanvragen", bedankPagina: 8208,
    bedankt: "<h3>Bedankt voor je aanvraag.</h3>\n<p>We nemen snel contact met je op.</p>",
    meldNaam: "Offerteaanvraag op 36Cycling.com", meldOnderwerp: "Offerteaanvraag: {inputs.names.first_name} {inputs.names.last_name}, {inputs.aantal} stuks",
    intro: "Nieuwe offerteaanvraag via de website. Met Beantwoorden mail je de aanvrager direct.", kop: ["Contact", "Aanvraag", "Ontwerp en planning"],
    lab: { naam: "Naam", mail: "E-mail", tel: "Telefoon", org: "Club, team of bedrijf", sport: "Sport", prod: "Producten", aantal: "Aantal", kwal: "Kwaliteit", ontwerp: "Ontwerp", wanneer: "Gewenste datum", opm: "Vragen of opmerkingen" },
    h1: "Offerte aanvragen",
  },
  en: {
    title: "Quote request (EN)", verplicht: "This field is required", kies: "Please make a choice", email: "Please enter a valid email address",
    voornaam: "First name", achternaam: "Last name", mail: "Email", tel: "Phone (optional)", telHelp: "Useful if we want to check something quickly.",
    org: "Club, team or company (optional)", orgVb: "For example: Cycling Club De Spaakjes",
    sec1: "What would you like us to make?",
    sport: "Which sport is it for?", sporten: ["Road cycling", "Mountain bike / gravel", "Running", "Ice skating", "Triathlon", "Field sports", "Other"],
    prod: "Which products?", producten: ["Jerseys", "Shorts", "Long tights", "Jackets", "Wind vests", "Other"],
    aantal: "How many pieces?", aantalHelp: "Not sure yet? Enter an estimate.", getal: "Enter a quantity (1 or more)",
    tip: '<div class="c36-tip"><p>We make a fully custom design from 5 pieces. For fewer pieces, we print a <a href="/en/custom-cycling-jersey-from-1-piece/">jersey from stock with your own logo</a>, ready within a few days. You can still send this form and we will think along with you.</p></div>',
    kwal: "Which quality are you looking for?", kwaliteiten: [["budget", "Budget / recreational"], ["amateur", "Amateur / enthusiast"], ["semipro", "Semi-professional"], ["pro", "Professional / elite"], ["weet-niet", "Not sure yet"]],
    sec2: "Design and planning",
    ontwerp: "Do you already have a design?", ontwerpen: [["ontwerp", "Yes, a complete design"], ["logo", "I have a logo"], ["hulp", "No, I would like help with the design"]],
    wanneer: "When do you need the clothing? (optional)", wanneerVb: "For example: mid-March, for a sportive",
    opm: "Questions or comments (optional)", opmVb: "For example: which colours, names or numbers on the jerseys, or anything else we should know. You can email a design or logo after your request.",
    knop: "Request a quote", bedankPagina: 8209,
    bedankt: "<h3>Thank you for your request.</h3>\n<p>We will get back to you soon.</p>",
    meldNaam: "Quote request on 36Cycling.com", meldOnderwerp: "Quote request (EN): {inputs.names.first_name} {inputs.names.last_name}, {inputs.aantal} pieces",
    intro: "New quote request via the English website. Reply to email the requester directly.", kop: ["Contact", "Request", "Design and planning"],
    lab: { naam: "Name", mail: "Email", tel: "Phone", org: "Club, team or company", sport: "Sport", prod: "Products", aantal: "Quantity", kwal: "Quality", ontwerp: "Design", wanneer: "Wanted by", opm: "Questions or comments" },
    h1: "Request a quote",
  },
};

function bouwVelden(t) {
  let n = 0;
  const key = () => `el_3610000${String(++n).padStart(3, "0")}`;
  const req = (aan, message) => ({ required: { value: aan, message, global_message: message, global: false } });
  const geenLogica = [];
  const naam = () => ({
    index: 0, element: "input_name", uniqElKey: key(), attributes: { name: "names", "data-type": "name-element" },
    settings: { container_class: "", admin_field_label: "Naam", conditional_logics: geenLogica, label_placement: "" },
    fields: Object.fromEntries([["first_name", t.voornaam, true, true], ["middle_name", "", false, false], ["last_name", t.achternaam, true, true]].map(([nm, label, visible, verpl]) => [nm, {
      element: "input_text", attributes: { type: "text", name: nm, value: "", id: "", class: "", placeholder: "", autocomplete: nm === "first_name" ? "given-name" : nm === "last_name" ? "family-name" : "off" },
      settings: { container_class: "", label, help_message: "", visible, validation_rules: req(verpl, t.verplicht), conditional_logics: [] }, editor_options: { template: "inputText" },
    }])),
    editor_options: { title: "Name Fields", element: "name-fields", icon_class: "ff-edit-name", template: "nameFields" },
  });
  const email = () => ({
    index: 1, element: "input_email", uniqElKey: key(), attributes: { type: "email", name: "email", value: "", id: "", class: "", placeholder: "", autocomplete: "email" },
    settings: { container_class: "", label: t.mail, label_placement: "", help_message: "", admin_field_label: "email",
      validation_rules: { ...req(true, t.verplicht), email: { value: true, message: t.email, global_message: t.email, global: false } },
      conditional_logics: [], is_unique: "no", unique_validation_message: "", prefix_label: "", suffix_label: "" },
    editor_options: { title: "Email Address", icon_class: "ff-edit-email", template: "inputText" },
  });
  const tekst = (name, label, placeholder = "", help = "", autocomplete = "off", type = "text") => ({
    index: 2, element: "input_text", uniqElKey: key(), attributes: { autocomplete, type, name, value: "", class: "", placeholder, maxlength: "120" },
    settings: { container_class: "", label, label_placement: "", admin_field_label: name, help_message: help, prefix_label: "", suffix_label: "",
      validation_rules: req(false, t.verplicht), conditional_logics: [], is_unique: "no", unique_validation_message: "" },
    editor_options: { title: "Eenvoudige tekst", icon_class: "ff-edit-text", template: "inputText" },
  });
  const keuzes = (element, name, label, opties, verplicht) => ({
    index: 8, element, uniqElKey: key(), attributes: { type: element === "input_checkbox" ? "checkbox" : "radio", name, value: element === "input_checkbox" ? [] : "" },
    settings: { dynamic_default_value: "", container_class: "", label, admin_field_label: name, label_placement: "", display_type: "", help_message: "", randomize_options: "no",
      advanced_options: opties.map((o) => { const [value, lab] = Array.isArray(o) ? o : [o, o]; return { label: lab, value, calc_value: "", image: "" }; }),
      calc_value_status: false, enable_image_input: false, values_visible: false, enable_other_option: "no", other_option_label: "", other_option_placeholder: "", other_option_required_message: "",
      validation_rules: req(verplicht, t.kies), conditional_logics: [], layout_class: "ff_list_buttons" },
    editor_options: element === "input_checkbox"
      ? { title: "Check Box", icon_class: "ff-edit-checkbox-1", template: "inputCheckable" }
      : { title: "Radiobutton veld", icon_class: "ff-edit-radio", element: "input-radio", template: "inputCheckable" },
  });
  const getal = (name, label, help) => ({
    index: 6, element: "input_number", uniqElKey: key(),
    attributes: { autocomplete: "off", type: "number", name, value: "", id: "", class: "", placeholder: "", min: "1" },
    settings: { container_class: "c36-aantal", label, admin_field_label: name, label_placement: "", help_message: help, number_step: "1", prefix_label: "", suffix_label: "", numeric_formatter: "", mobile_keyboard_type_number: "",
      validation_rules: { ...req(true, t.getal), numeric: { value: true, message: t.getal, global_message: t.getal, global: false },
        min: { value: "1", message: t.getal, global_message: "", global: false }, max: { value: "", message: "", global_message: "", global: false }, digits: { value: "", message: "", global_message: "", global: false } },
      conditional_logics: [], calculation_settings: { status: false, formula: "" } },
    editor_options: { title: "Numeriek veld", icon_class: "ff-edit-numeric", template: "inputText" },
  });
  const html = (code, als) => ({
    index: 10, element: "custom_html", uniqElKey: key(), attributes: [],
    settings: { html_codes: code, container_class: "", conditional_logics: als ? { type: "any", status: true, conditions: [{ field: als[0], operator: als[2] || "=", value: als[1] }] } : [] },
    editor_options: { title: "Custom HTML", icon_class: "ff-edit-html", template: "customHTML" },
  });
  const tekstvak = (name, label, placeholder) => ({
    index: 3, element: "textarea", uniqElKey: key(), attributes: { autocomplete: "off", name, value: "", id: "", class: "", placeholder, rows: 4, cols: 2, maxlength: "2000" },
    settings: { container_class: "", label, admin_field_label: name, label_placement: "", help_message: "", prefix_label: "", suffix_label: "", validation_rules: req(false, t.verplicht), conditional_logics: [] },
    editor_options: { title: "Tekstgebied", icon_class: "ff-edit-textarea", template: "inputTextarea" },
  });
  const sectie = (label) => ({
    index: 1, element: "section_break", uniqElKey: key(), attributes: { id: "", class: "" },
    settings: { label, description: "", align: "left", conditional_logics: [] },
    editor_options: { title: "Sectie einde", icon_class: "ff-edit-section-break", template: "sectionBreak" },
  });
  const kolommen = (...velden) => ({
    index: 1, element: "container", uniqElKey: key(), attributes: [],
    settings: { container_class: "", conditional_logics: [], container_width: "", is_width_auto_calc: true },
    columns: velden.map((v) => ({ width: Math.round(10000 / velden.length) / 100, fields: [v] })),
    editor_options: { title: "Kolommen", icon_class: "ff-edit-column-2" },
  });
  return [
    naam(),
    kolommen(email(), tekst("telefoon", t.tel, "", t.telHelp, "tel", "tel")),
    tekst("organisatie", t.org, t.orgVb, "", "organization"),
    sectie(t.sec1),
    keuzes("input_checkbox", "sport", t.sport, t.sporten, true),
    keuzes("input_checkbox", "producten", t.prod, t.producten, true),
    getal("aantal", t.aantal, t.aantalHelp),
    html(t.tip, ["aantal", "5", "<"]),
    keuzes("input_radio", "kwaliteit", t.kwal, t.kwaliteiten, true),
    sectie(t.sec2),
    keuzes("input_radio", "ontwerp", t.ontwerp, t.ontwerpen, false),
    tekst("wanneer", t.wanneer, t.wanneerVb),
    tekstvak("opmerking", t.opm, t.opmVb),
  ];
}
const knop = (t) => ({
  uniqElKey: "el_3610000999", element: "button", attributes: { type: "submit", class: "" },
  settings: { align: "left", button_style: "", container_class: "", help_message: "", background_color: "", button_size: "md", color: "",
    button_ui: { type: "default", text: t.knop, img_url: "" },
    normal_styles: { backgroundColor: "#000000", borderColor: "#000000", color: "#ffffff", borderRadius: "", minWidth: "" },
    hover_styles: { backgroundColor: "#1b2629", borderColor: "#1b2629", color: "#ffffff", borderRadius: "", minWidth: "" }, current_state: "normal_styles" },
  editor_options: { title: "Submit Button" },
});
// Mail als nette tabel met inline stijl (mailprogramma's negeren losse CSS): links het onderdeel, rechts het antwoord, in drie blokjes.
const meldBericht = (t) => {
  const td = "padding:7px 10px;border-bottom:1px solid #e6e8e9;vertical-align:top;font-size:14px;line-height:1.45;";
  const rij = (lab, v) => `<tr><td style="${td}width:170px;color:#5b6466;">${lab}</td><td style="${td}color:#1b2629;">${v}</td></tr>`;
  const kop = (tekst) => `<tr><td colspan="2" style="padding:18px 10px 6px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:#1b2629;">${tekst}</td></tr>`;
  return `<p style="font-size:14px;margin:0 0 6px;">${t.intro}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
${kop(t.kop[0])}${rij(t.lab.naam, "{inputs.names.first_name} {inputs.names.last_name}")}${rij(t.lab.mail, "{inputs.email}")}${rij(t.lab.tel, "{inputs.telefoon}")}${rij(t.lab.org, "{inputs.organisatie}")}
${kop(t.kop[1])}${rij(t.lab.aantal, "{inputs.aantal}")}${rij(t.lab.sport, "{inputs.sport}")}${rij(t.lab.prod, "{inputs.producten}")}${rij(t.lab.kwal, "{inputs.kwaliteit}")}
${kop(t.kop[2])}${rij(t.lab.ontwerp, "{inputs.ontwerp}")}${rij(t.lab.wanneer, "{inputs.wanneer}")}${rij(t.lab.opm, "{inputs.opmerking}")}
</table>`;
};

// Toegankelijkheid: Fluent Forms koppelt de vraag van een keuzelijst niet aan de knoppen. Dit maakt van elke lijst een
// groep (role=radiogroup/group) met de vraag als naam, zodat een schermlezer "Hoeveel stuks ongeveer?, 5 tot 9" voorleest.
// Staat in Fluent Forms → formulier → Instellingen → Aangepaste CSS/JS ($form = dit formulier).
const JS_GROEPEN = `(function (form) {
  form.querySelectorAll(".ff-el-group").forEach(function (g, i) {
    var lijst = g.querySelector(".ff-el-input--content"), label = g.querySelector(".ff-el-input--label label");
    if (!lijst || !label || !lijst.querySelector("input[type=radio], input[type=checkbox]")) return;
    if (!label.id) label.id = "c36-vraag-" + form.getAttribute("data-form_id") + "-" + i;
    lijst.setAttribute("role", lijst.querySelector("input[type=radio]") ? "radiogroup" : "group");
    lijst.setAttribute("aria-labelledby", label.id);
  });
})($form[0]);`;
await mkdir(new URL("backups/", ROOT), { recursive: true });
for (const lang of ["nl", "en"]) {
  const t = T[lang];
  let id = mine.forms[lang];
  if (!id) {
    const nieuw = await ff("POST", "/forms", { predefined: "blank_form" });
    id = Number(nieuw.formId ?? nieuw.id ?? nieuw.form?.id);
    if (!id) throw new Error("Formulier aangemaakt, maar geen id: " + JSON.stringify(nieuw).slice(0, 300));
    mine.forms[lang] = id; await save();
    console.log(`formulier ${lang} aangemaakt → ${id}`);
  } else {
    await writeFile(new URL(`backups/fluentform-${id}-fields-${Date.now()}.json`, ROOT), JSON.stringify(await ff("GET", `/forms/${id}`), null, 2));
  }
  const velden = JSON.stringify({ fields: bouwVelden(t), submitButton: knop(t) });
  await ff("POST", `/forms/${id}`, { title: t.title, status: "published", formFields: velden, form_fields: velden });

  // Na verzenden naar de bedankpagina (meetpunt Tag Manager), net als het Teamleader-formulier.
  const [inst] = await ff("GET", `/settings/${id}?meta_key=formSettings`);
  const waarde = { ...inst.value, confirmation: { ...inst.value.confirmation, redirectTo: "customPage", customPage: t.bedankPagina, messageToShow: t.bedankt, samePageFormBehavior: "hide_form", customUrl: null } };
  await ff("POST", `/settings/${id}`, { meta_key: "formSettings", meta_id: String(inst.id), value: JSON.stringify(waarde) });

  // Mailmelding naar info@ (antwoordadres = aanvrager).
  const melding = { name: t.meldNaam, sendTo: { type: "email", email: MAIL, field: null, routing: [{ input_value: "", field: null, operator: "=", value: null }] },
    fromName: "", fromEmail: "", replyTo: "{inputs.email}", bcc: "", subject: t.meldOnderwerp, message: meldBericht(t),
    conditionals: { status: false, type: "all", conditions: [{ field: null, operator: "=", value: null }] }, enabled: true,
    pdf_attachments: [], attachments: [], media_attachments: [], feed_trigger_event: "payment_success", asPlainText: "no" };
  const bestaand = await ff("GET", `/settings/${id}?meta_key=notifications`);
  const lijst = Array.isArray(bestaand) ? bestaand : [];
  if (lijst[0]?.id) await ff("POST", `/settings/${id}`, { meta_key: "notifications", meta_id: String(lijst[0].id), value: JSON.stringify(melding) });
  else await ff("POST", `/settings/${id}`, { meta_key: "notifications", value: JSON.stringify(melding) });

  const css = (await readFile(new URL("wp-root/offerte-form.css", ROOT), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replaceAll("__W__", `.fluentform.fluentform_wrapper_${id}`).trim();
  await ff("POST", `/settings/${id}/customizer`, { form_id: String(id), css, js: JS_GROEPEN });

  const na = await ff("GET", `/forms/${id}`);
  const namen = []; (function loop(l) { for (const v of l) { if (v.columns) v.columns.forEach((k) => loop(k.fields)); else if (v.attributes?.name) namen.push(v.attributes.name); } })(JSON.parse(na.form_fields).fields);
  const meld = await ff("GET", `/settings/${id}?meta_key=notifications`);
  const [conf] = await ff("GET", `/settings/${id}?meta_key=formSettings`);
  console.log(`formulier ${lang} #${id}: ${namen.length} velden (${namen.join(", ")}) | melding: ${JSON.stringify((Array.isArray(meld) ? meld : []).map((m) => [m.value.enabled, m.value.sendTo.email]))} | na verzenden: pagina ${conf.value.confirmation.customPage}`);
}
const FORMS = new URL("translations/en/forms.json", ROOT);
const paren = JSON.parse(await readFile(FORMS, "utf8"));
if (paren[mine.forms.nl] !== mine.forms.en) { paren[mine.forms.nl] = mine.forms.en; await writeFile(FORMS, JSON.stringify(paren, null, 2)); }
if (ONLY_FORMS) process.exit(0);

// Voorbeeldpagina's (concept, noindex) om het formulier te bekijken voordat het op de offertepagina komt.
for (const lang of ["nl", "en"]) {
  const key = `offerteformulier-voorbeeld-${lang}`;
  const inhoud = `<!-- wp:heading {"level":1,"fontSize":"x-large"} -->
<h1 class="wp-block-heading has-x-large-font-size">${T[lang].h1}</h1>
<!-- /wp:heading -->

<!-- wp:shortcode -->
[fluentform id="${mine.forms[lang]}"]
<!-- /wp:shortcode -->`;
  if (state[key]?.id) {
    const r = await fetch(`${W}/wp/v2/pages/${state[key].id}`, { method: "POST", headers: { ...AUTH, "Content-Type": "application/json" }, body: JSON.stringify({ content: inhoud }) });
    console.log(`voorbeeld ${lang}: #${state[key].id} bijgewerkt (${r.status})`); continue;
  }
  const titel = lang === "nl" ? "Offerte aanvragen (nieuw formulier, voorbeeld)" : "Request a quote (new form, preview)";
  const res = await upsertPage(cfg, { title: titel, slug: lang === "nl" ? "offerteformulier-voorbeeld" : "quote-form-preview", lang, status: "draft",
    content: inhoud, meta: { "_yoast_wpseo_meta-robots-noindex": "1" } });
  state[key] = { id: res.id, link: res.link }; await save();
  console.log(`voorbeeld ${lang}: #${res.id} ${res.status}`);
}
