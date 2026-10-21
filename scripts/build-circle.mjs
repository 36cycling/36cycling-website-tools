// /nl/36-cycling-circle/ — teksten van de oude Circle-pagina, aanmeldformulier = Fluent Forms #3 (→ FluentCRM-lijst "36 Cycling Circle").
// Inlog/wachtwoord-blokken van de oude site vervallen (leden worden herkend op e-mailadres bij het afrekenen).
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { blocks } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const cfg = await loadConfig();
const state = JSON.parse(await readFile(new URL("state.json", root), "utf8"));
const { heading, paragraph, list, column, columns, breadcrumbs } = blocks;
const FORM_ID = 3;

const content = [
  breadcrumbs(),
  heading("36 Cycling Circle", 1, { size: "x-large" }),
  paragraph("Fijn dat je hier bent! Het is voor ons belangrijk dat je met plezier blijft sporten en dat je klaar bent voor je prestatie, uitdaging of doelstelling. We heten je daarom graag welkom als lid van de 36 Cycling Circle. Leden van de 36 Cycling Circle profiteren van verschillende voordelen, zoals kortingen en uitnodigingen voor gave evenementen."),
  paragraph("Lid worden is gratis en eenvoudig: vul op het aanmeldformulier op deze pagina je voor- en achternaam en e-mailadres in en druk op Aanmelden. Met je mailadres ben je vervolgens bij ons bekend en krijg je voortaan bij elke bestelling* 10% korting en bij bestellingen vanaf €50 gratis sokken. Af en toe houden we je op de hoogte van nieuws of een aanbieding. En bedenken we dingen die leuk kunnen zijn voor leden van de Cycling Circle. O, en afmelden kan uiteraard te allen tijde. ;-)"),
  columns([
    column([
      heading("Aanmelden", 2),
      `<!-- wp:shortcode -->\n[fluentform id="${FORM_ID}"]\n<!-- /wp:shortcode -->`,
    ].join("\n\n")),
    column([
      heading("Voordelen", 2),
      list([
        "10% korting bij elke bestelling in de webshop*",
        "Gratis fietssokken bij bestellingen boven €50",
        "Blijf op de hoogte van nieuws of aanbiedingen",
        "Onze nieuwsbrief met acties, fietstips en meer",
      ]),
      paragraph("<em>* alleen geldig op producten uit de collectie (geen customized kleding)</em>"),
    ].join("\n\n")),
  ]),
  heading("Evenementen", 2),
  paragraph("Behalve van voordelen in onze webshop, profiteer je als lid van de Cycling Circle ook van exclusieve uitnodigingen voor evenementen waar 36 Cycling betrokken is als sponsor en speciale acties. Zo krijg je een gratis entreeticket voor de WielerZesdaagse in Rotterdam Ahoy en doe je straks via de Cycling Circle misschien wel mee aan de populaire toerversie van de Amstel Gold Race."),
].join("\n\n");

const res = await upsertPage(cfg, {
  id: state["36-cycling-circle"]?.id,
  title: "36 Cycling Circle", slug: "36-cycling-circle", content, lang: "nl", status: "draft",
  meta: {
    _yoast_wpseo_title: "36 Cycling Circle: 10% korting en gratis fietssokken",
    _yoast_wpseo_metadesc: "Word gratis lid van de 36 Cycling Circle: 10% korting op elke bestelling in onze webshop, gratis fietssokken vanaf € 50 en uitnodigingen voor events.",
    _yoast_wpseo_focuskw: "36 Cycling Circle",
  },
});
state["36-cycling-circle"] = { id: res.id, link: res.link };
await writeFile(new URL("state.json", root), JSON.stringify(state, null, 2));
console.log(`36-cycling-circle → id ${res.id} | ${res.status} | ${res.link}`);
