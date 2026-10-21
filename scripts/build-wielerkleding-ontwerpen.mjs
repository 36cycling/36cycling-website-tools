// Bespoke build: /nl/wielerkleding-ontwerpen/ — herschreven met eigen zoekintentie
// ("ontwerpen", niet "bedrukken"). Opbouw volgens het SEO-plan van de gebruiker.
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, blocks } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";

const OLD = "https://www.36cycling.com";
const TOOL = "https://designer.36cycling.com/";
const root = new URL("..", import.meta.url);
const cfg = await loadConfig();
const map = await loadMediaMap();
const state = JSON.parse(await readFile(new URL("state.json", root), "utf8"));
const { heading, paragraph, list, image, buttons, column, gridColumn, columns, breadcrumbs } = blocks;

const media = (path, alt) => ensureMedia(cfg, map, { src: OLD + path, alt, updateAlt: true });
const fromMap = (sub) => map[Object.keys(map).find((k) => k.includes(sub))];

// ---------- Extra blok-helpers (patronen uit template 969) ----------
const centerP = (html) =>
  `<!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}}} -->\n<p class="has-text-align-center">${html}</p>\n<!-- /wp:paragraph -->`;

// Gekleurde kaart-kolom (patroon 05: kolom met achtergrondkleur).
const card = (inner, color) =>
  `<!-- wp:column {"style":{"spacing":{"padding":{"top":"var:preset|spacing|50","right":"var:preset|spacing|50","bottom":"var:preset|spacing|50","left":"var:preset|spacing|50"}}},"backgroundColor":"${color}"} -->\n` +
  `<div class="wp-block-column has-${color}-background-color has-background" style="padding-top:var(--wp--preset--spacing--50);padding-right:var(--wp--preset--spacing--50);padding-bottom:var(--wp--preset--spacing--50);padding-left:var(--wp--preset--spacing--50)">${inner}</div>\n<!-- /wp:column -->`;

// Stappenblok (zelfde opbouw als herbruikbaar blok 1734 "Stappenplan").
const stepsGroup = (title, subtitle, steps, after = "") => {
  const col = (s, i) =>
    `<!-- wp:column {"style":{"border":{"top":{"color":"var:preset|color|black","width":"1px"},"right":[],"bottom":[],"left":[]},"spacing":{"padding":{"top":"var:preset|spacing|50","bottom":"var:preset|spacing|50"}}}} -->\n` +
    `<div class="wp-block-column" style="border-top-color:var(--wp--preset--color--black);border-top-width:1px;padding-top:var(--wp--preset--spacing--50);padding-bottom:var(--wp--preset--spacing--50)">` +
    `<!-- wp:heading {"level":6,"style":{"spacing":{"margin":{"top":"0","bottom":"0","left":"0","right":"0"}}}} -->\n<h6 class="wp-block-heading" style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0">${String(i + 1).padStart(2, "0")}</h6>\n<!-- /wp:heading -->\n\n` +
    `<!-- wp:heading {"level":4,"style":{"spacing":{"margin":{"right":"0","left":"0","top":"0","bottom":"0"}}},"fontSize":"medium"} -->\n<h4 class="wp-block-heading has-medium-font-size" style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0">${s.title}</h4>\n<!-- /wp:heading -->\n\n` +
    paragraph(s.text) + `</div>\n<!-- /wp:column -->`;
  return `<!-- wp:group {"align":"full","style":{"spacing":{"margin":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"},"padding":{"top":"var:preset|spacing|80","bottom":"var:preset|spacing|80"}}},"backgroundColor":"palette-color-6","layout":{"type":"constrained"}} -->\n` +
    `<div class="wp-block-group alignfull has-palette-color-6-background-color has-background" style="margin-top:var(--wp--preset--spacing--60);margin-bottom:var(--wp--preset--spacing--60);padding-top:var(--wp--preset--spacing--80);padding-bottom:var(--wp--preset--spacing--80)">` +
    `<!-- wp:heading {"style":{"typography":{"textAlign":"center","textTransform":"none"},"spacing":{"margin":{"top":"0","bottom":"0"}}},"fontSize":"x-large","anchor":"zo-werkt-de-ontwerptool"} -->\n<h2 class="wp-block-heading has-text-align-center has-x-large-font-size" id="zo-werkt-de-ontwerptool" style="margin-top:0;margin-bottom:0;text-transform:none">${title}</h2>\n<!-- /wp:heading -->\n\n` +
    `<!-- wp:heading {"level":3,"style":{"typography":{"textAlign":"center","fontSize":"45px"},"spacing":{"margin":{"bottom":"var:preset|spacing|50","left":"0","right":"0","top":"-10px"}}}} -->\n<h3 class="wp-block-heading has-text-align-center" style="margin-top:-10px;margin-right:0;margin-bottom:var(--wp--preset--spacing--50);margin-left:0;font-size:45px">${subtitle}</h3>\n<!-- /wp:heading -->\n\n` +
    `<!-- wp:columns {"style":{"spacing":{"padding":{"top":"0","bottom":"0","left":"0","right":"0"},"margin":{"top":"0","bottom":"0"},"blockGap":{"top":"0","left":"var:preset|spacing|50"}}}} -->\n` +
    `<div class="wp-block-columns" style="margin-top:0;margin-bottom:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0">${steps.map(col).join("\n\n")}</div>\n<!-- /wp:columns -->` +
    (after ? "\n\n" + after : "") +
    `</div>\n<!-- /wp:group -->`;
};

// Gecentreerde knoppen.
const centerButtons = (items) => buttons(items).replace("<!-- wp:buttons -->", '<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->');

// FAQ als core accordion (zelfde opbouw als herbruikbaar blok 1760 "FAQ") + FAQPage-schema.
const faqBlock = (faqs) => {
  const item = (f) =>
    `<!-- wp:accordion-item {"style":{"border":{"top":{"width":"1px"},"right":{"width":"0px","style":"none"},"bottom":{"width":"0px","style":"none"},"left":{"width":"0px","style":"none"}},"spacing":{"padding":{"right":"var:preset|spacing|20","left":"var:preset|spacing|20","top":"var:preset|spacing|20","bottom":"var:preset|spacing|20"}}}} -->\n` +
    `<div class="wp-block-accordion-item" style="border-top-width:1px;border-right-style:none;border-right-width:0px;border-bottom-style:none;border-bottom-width:0px;border-left-style:none;border-left-width:0px;padding-top:var(--wp--preset--spacing--20);padding-right:var(--wp--preset--spacing--20);padding-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--20)">` +
    `<!-- wp:accordion-heading {"level":3,"fontSize":"medium"} -->\n<h3 class="wp-block-accordion-heading has-icon has-icon-right has-medium-font-size"><button type="button" class="wp-block-accordion-heading__toggle"><span class="wp-block-accordion-heading__toggle-title"><strong>${f.q}</strong></span><span class="wp-block-accordion-heading__toggle-icon" aria-hidden="true">+</span></button></h3>\n<!-- /wp:accordion-heading -->\n\n` +
    `<!-- wp:accordion-panel -->\n<div role="region" class="wp-block-accordion-panel">${f.a.map(paragraph).join("\n\n")}</div>\n<!-- /wp:accordion-panel --></div>\n<!-- /wp:accordion-item -->`;
  const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const schema = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.map(strip).join(" ") } })),
  };
  return `<!-- wp:accordion {"layout":{"type":"constrained"}} -->\n<div role="group" class="wp-block-accordion">${faqs.map(item).join("\n\n")}</div>\n<!-- /wp:accordion -->\n\n` +
    `<!-- wp:html -->\n<script type="application/ld+json">${JSON.stringify(schema)}</script>\n<!-- /wp:html -->`;
};

const shortcode = (sc) => `<!-- wp:shortcode -->\n${sc}\n<!-- /wp:shortcode -->`;

// ---------- Media ----------
const toolGif = await media("/media/elzp1byg/ontwerp-je-wielershirt.gif", "Wielershirt ontwerpen in de 3D-ontwerptool van 36 Cycling");
const p1 = await media("/media/bhlotyie/portfolio1.png", "Klantontwerpen wielershirts voor Jordex, ICT Group, Fietsvrouwen en Stadshaven Brouwerij");
const p2 = await media("/media/yeejxsie/portfolio2.png", "Klantontwerpen wielershirts voor Skyworkz, Hotel Le Baroudeur, Crankzinnig en YNNO");
const p3 = await media("/media/hutjgtb4/portfolio3.png", "Klantontwerpen wielershirts voor Cegeka, Goudappel Coffeng, Rotterdams Philharmonisch Orkest en EHV8");
const p4 = await media("/media/vrniefh0/portfolio4.png", "Klantontwerpen wielershirts voor Isla Pastilles, NED. Personeel, BIS en Finco");
const clients = await media("/media/pijjllpg/clients.png", "Logo's van klanten van 36 Cycling, waaronder DHL, ABN AMRO, Rabobank, Philips en MediaMarkt");

const products = [
  { m: fromMap("wielershirt-prestige.jpg"), t: "Wielershirts", d: "Vijf modellen, van het luchtige Prestige tot de allround Classic.", href: "/nl/teamkleding-collectie/wielershirt-prestige/" },
  { m: fromMap("wielerbroek-elite"), t: "Wielerbroeken", d: "Elite, Speed, TotalGrip en Classic, plus een lange wielerbroek en een warming-up broek.", href: "/nl/teamkleding-collectie/wielerbroek-elite/" },
  { m: fromMap("wielerjack-allseason"), t: "Jacks en windjacks", d: "All Season Jack, Winter Thermo Jack en drie windjacks voor koudere dagen.", href: "/nl/teamkleding-collectie/all-season-jack/" },
  { m: fromMap("skinsuit-performance"), t: "Skinsuits en triatlonpakken", d: "Skinsuit Performance en Criterium voor tijdritten en wedstrijden, en een triatlonpak.", href: "/nl/teamkleding-collectie/skinsuit-performance/" },
  { m: fromMap("armstukken"), t: "Accessoires", d: "Armstukken, beenstukken, wintermuts, bandana, team polo en leisure jack.", href: "/nl/teamkleding-collectie/armstukken/" },
  { m: fromMap("running"), t: "Sportkleding", d: "Ook voor hardlopen, schaatsen en voetbal: running shirts, singlets, schaatspakken en meer.", href: "/nl/sportkleding-collectie/" },
];

const tips = [
  ["Zorg voor contrast en zichtbaarheid", "Je wilt gezien worden, door je groepsgenoten én door ander verkeer. Lichte en felle kleuren vallen van ver op; combineer ze met een donker accent voor contrast. Een volledig donker shirt ziet er strak uit, maar valt in de schemering minder op."],
  ["Plaats logo's waar ze zichtbaar blijven", "De beste plekken voor een hoofdsponsor zijn de borst en de rug. Mouwen, zijpanelen en broekpijpen lenen zich voor kleinere logo's. Let op de rits: een logo midden op de borst wordt door de rits in tweeën gedeeld. Plaats het iets hoger of kies een ontwerp dat daar rekening mee houdt."],
  ["Ontwerp de achterkant met zorg", "In een groep zie je vooral ruggen. De achterkant is daarom je belangrijkste reclamebord: zet je clubnaam of hoofdsponsor op de rug, boven de achterzakken. Over de zakken heen werkt minder goed, omdat ze het ontwerp vervormen zodra er iets in zit."],
  ["Gebruik maximaal drie hoofdkleuren", "Met twee of drie hoofdkleuren blijft een ontwerp rustig en herkenbaar. Kies kleuren uit je huisstijl en gebruik extra kleuren alleen als accent."],
  ["Ontwerp broek en shirt als één geheel", "Een tenue oogt pas af als shirt en broek bij elkaar passen. Laat een kleur van de broek terugkomen in het shirt, bijvoorbeeld in de mouwboorden of zijpanelen. Twijfel je? Een zwarte broek met een accentkleur uit het shirt past bijna altijd."],
  ["Houd rekening met zweet", "Effen, lichte vlakken laten zweetplekken sneller zien. Een patroon of een donkerdere tint op de rug, de zijkanten en onder de armen maakt dat minder zichtbaar. Een volledig wit shirt kan bovendien licht doorschijnen."],
  ["Maak tekst leesbaar op afstand", "Kies een eenvoudig, stevig lettertype en maak teksten groot genoeg. Dunne letters, kleine slogans en tekst op een drukke achtergrond zijn op een paar meter afstand al niet meer te lezen."],
  ["Denk aan de pasvorm", "Een wielershirt zit strak en rekt mee met je lichaam. Logo's en tekst rekken daardoor ook iets mee, vooral op de borst en schouders. Houd belangrijke details uit de zones die het meest rekken en controleer je ontwerp in de 3D-weergave."],
];

const faqs = [
  { q: "Kost een ontwerp iets?", a: ["Nee. Ontwerpen is gratis en vrijblijvend, of je nu zelf aan de slag gaat in de 3D-ontwerptool of ons designteam het ontwerp laat maken. Je betaalt pas als je bestelt."] },
  { q: "Kan ik mijn ontwerp opslaan en later aanpassen?", a: ["In de 3D-ontwerptool sla je je ontwerp op en verstuur je het naar ons. Daarna werken we het samen met je verder uit: je ziet een digitale 3D-proef en pas na jouw akkoord gaan we naar productie."] },
  { q: "Welke logobestanden heb ik nodig?", a: ["Het liefst een vectorbestand: AI, EPS, SVG of een PDF met vectoren. Die blijven scherp op elk formaat. Heb je alleen een PNG of JPG? Stuur die gerust mee, dan kijken we wat er mogelijk is."] },
  { q: "Wat als ik nog geen idee heb?", a: ["Geen probleem, daar is ons designteam voor. We adviseren over kleurkeuze, de plaatsing van logo's en de juiste afmetingen. Vooraf kunnen we je voorbeelden en kleurstalen sturen, zodat je een goed beeld krijgt van het eindresultaat."] },
  { q: "Kan ik een bestaand tenue laten namaken?", a: ["Ja. Stuur foto's of het ontwerpbestand van je huidige tenue mee, dan zetten we het om naar onze producten. Desgewenst geven we het meteen een frisse update."] },
];

// ---------- Pagina ----------
const content = [
  breadcrumbs(),
  heading("Wielerkleding ontwerpen", 1, { size: "x-large" }),
  paragraph("Een eigen wielershirt of compleet tenue ontwerpen kan op twee manieren: zelf, in onze 3D-ontwerptool, of samen met ons designteam. Kies de route die bij je past. Je zit nergens aan vast."),

  // 1. Hero als splitsing
  columns([
    card([
      image(toolGif, TOOL),
      heading("Zelf ontwerpen in 3D", 3),
      paragraph("Kies je product, speel met kleuren en patronen en zet je logo erop. Je ziet je wielershirt direct in 3D, van alle kanten. Ideaal als je al een idee hebt of gewoon wilt uitproberen."),
      buttons([{ text: "Start de ontwerptool", href: TOOL }]),
    ].join("\n\n"), "palette-color-6"),
    card([
      image(p3, "#laat-ons-ontwerpen"),
      heading("Laat ons het ontwerp maken", 3),
      paragraph("Geen tijd, of geen idee waar je moet beginnen? Ons designteam maakt een ontwerp op maat in jouw huisstijl. Je geeft feedback op een digitale 3D-proef en pas na jouw akkoord gaan we verder."),
      buttons([{ text: "Vraag een ontwerp aan", href: "#laat-ons-ontwerpen" }]),
    ].join("\n\n"), "palette-color-5"),
  ]),
  centerP("<strong>Gratis ontwerp · Vrijblijvend · Leverbaar vanaf 5 stuks</strong>"),

  // 2. Zo werkt de ontwerptool
  stepsGroup("Zo werkt de ontwerptool", "in vier stappen naar je eigen wielershirt", [
    { title: "Kies je product", text: "Begin met het product dat je wilt ontwerpen, bijvoorbeeld een wielershirt of een wielerbroek." },
    { title: "Kleuren en patroon", text: "Kies een patroon en geef elk vlak je eigen kleur. Je ziet het resultaat meteen in 3D, van alle kanten." },
    { title: "Logo en tekst", text: "Upload je logo's en voeg teksten toe, zoals een clubnaam of sponsor. Verplaats en schaal ze tot alles goed zit." },
    { title: "Opslaan en versturen", text: "Sla je ontwerp op en verstuur het naar ons. <strong>Wij checken je ontwerp en je hoort binnen een werkdag van ons.</strong>" },
  ], centerButtons([{ text: "Start de ontwerptool", href: TOOL }])),

  // 3. Welke kleding kun je ontwerpen
  heading("Welke kleding kun je ontwerpen?", 2),
  paragraph("Alle items uit onze teamwear-collectie zijn te ontwerpen in je eigen design, van wielershirt tot armstukken. Een greep uit de mogelijkheden:"),
  columns(products.slice(0, 3).map((p) => gridColumn([image(p.m, p.href), heading(p.t, 3, { size: "medium" }), paragraph(p.d), buttons([{ text: "Meer info", href: p.href }])].join("\n\n")))),
  columns(products.slice(3).map((p) => gridColumn([image(p.m, p.href), heading(p.t, 3, { size: "medium" }), paragraph(p.d), buttons([{ text: "Meer info", href: p.href }])].join("\n\n")))),
  paragraph('Bekijk de complete <a href="/nl/teamkleding-collectie/">teamkleding collectie</a> of de <a href="/nl/sportkleding-collectie/">sportkleding collectie</a>.'),

  // 4. Inspiratie
  heading("Inspiratie: ontworpen door onze klanten", 2),
  paragraph("Van fietsclub tot multinational: dit zijn wielershirts die we samen met onze klanten ontwierpen. Elk ontwerp begon met een logo, een paar huisstijlkleuren en een idee."),
  columns([p1, p2, p4].map((m) => column(image(m)))),
  heading("Ze gingen je voor", 3, { size: "medium" }),
  image(clients),

  // 5. Tips
  heading("Tips voor een goed wielershirt-ontwerp", 2),
  paragraph("Een mooi ontwerp op het scherm is niet automatisch een goed wielershirt op de weg. Met deze tips ziet je tenue er in het peloton net zo goed uit als in de ontwerptool."),
  ...tips.flatMap(([t, d]) => [heading(t, 3, { size: "medium" }), paragraph(d)]),

  // 6. Laat ons ontwerpen
  heading("Laat ons ontwerpen", 2),
  paragraph("Liever een ontwerp van een professional? Ons designteam denkt mee over kleurkeuze, de plaatsing van logo's en de juiste afmetingen, en vertaalt jouw ideeën naar een wieleroutfit in je eigen huisstijl."),
  columns([
    column([
      heading("Wat je aanlevert", 3, { size: "medium" }),
      list([
        "Je logo, bij voorkeur als vectorbestand (AI, EPS, SVG of PDF)",
        "Je huisstijlkleuren, als Pantone-, HEX- of RGB-code",
        "Logo's van eventuele sponsors",
        "Je wensen: een schets, voorbeelden die je mooi vindt of een bestaand tenue",
        "De producten en aantallen die je ongeveer nodig hebt",
      ]),
    ].join("\n\n")),
    column([
      heading("Zo gaat het", 3, { size: "medium" }),
      list([
        "We bespreken je wensen. Je hoort binnen een werkdag van ons.",
        "Ons designteam maakt een ontwerp op maat. Reken op [X werkdagen].",
        "Je ziet een digitale 3D-proef en geeft feedback. Inclusief [X] ontwerprondes.",
        "Na jouw akkoord gaat het naar productie. Op verzoek maken we eerst een kleurproef, en vooraf kunnen we je kleurstalen sturen.",
      ], true),
      buttons([{ text: "Vraag een ontwerp aan", href: "#klaar-om-te-beginnen" }]),
    ].join("\n\n")),
  ]),

  // 7. Van ontwerp naar tenue
  heading("Van ontwerp naar tenue", 2),
  paragraph("Is het ontwerp klaar en goedgekeurd? Dan gaat het in productie. We leveren al vanaf 5 stuks en de doorlooptijd is 3 tot 5 weken, afhankelijk van de tijd van het jaar. Passen kan met onze paskleding, of je bestelt de maten via de maattabel."),
  paragraph('Volledig bedrukte wielerkleding maken we met sublimatie: de inkt wordt in de stof opgenomen, waardoor kleuren levendig blijven, ook na vele wasbeurten. Meer over materialen, druktechnieken en het bestelproces lees je op onze pagina over <a href="/nl/wielerkleding-bedrukken/">wielerkleding bedrukken</a>.'),
  paragraph('Ontwerp je voor een club of bedrijf? Met teamkleding in één ontwerp, eventueel met de namen van teamleden, rijden jullie als één team. Voor grotere groepen bouwen we gratis een webshop, zodat iedereen zelf kan bestellen. Bekijk de <a href="/nl/teamkleding-collectie/">teamkleding collectie</a>.'),

  // 8. FAQ
  heading("Veelgestelde vragen over ontwerpen", 2),
  faqBlock(faqs),

  // 9. CTA — opnieuw de twee routes
  heading("Klaar om te beginnen?", 2),
  columns([
    card([
      heading("Zelf aan de slag", 3),
      paragraph("Open de 3D-ontwerptool en maak je eigen wielershirt. Gratis en vrijblijvend."),
      buttons([{ text: "Start de ontwerptool", href: TOOL }]),
    ].join("\n\n"), "palette-color-6"),
    card([
      heading("Ontwerp aanvragen", 3),
      paragraph("Laat je gegevens achter en vertel kort wat je zoekt. Je hoort binnen een werkdag van ons."),
      shortcode('[fluentform id="1"]'),
    ].join("\n\n"), "palette-color-5"),
  ]),
  centerP('Liever even bellen of mailen? <a href="tel:0182232008">0182 232 008</a> · <a href="mailto:info@36cycling.com">info@36cycling.com</a>'),
].join("\n\n");

const res = await upsertPage(cfg, {
  id: state["wielerkleding-ontwerpen"]?.id,
  title: "Wielerkleding ontwerpen", slug: "wielerkleding-ontwerpen", content, lang: "nl",
  meta: {
    _yoast_wpseo_title: "Wielerkleding ontwerpen in 3D, zelf of met ons designteam",
    _yoast_wpseo_metadesc: "Ontwerp je eigen wielerkleding in onze 3D-ontwerptool of laat ons designteam het ontwerp maken. Gratis en vrijblijvend, met ontwerptips en inspiratie.",
    _yoast_wpseo_focuskw: "wielerkleding ontwerpen",
  },
});
state["wielerkleding-ontwerpen"] = { id: res.id, link: res.link };
await writeFile(new URL("state.json", root), JSON.stringify(state, null, 2));

const csv = await readFile(new URL("redirects.csv", root), "utf8");
const line = `${OLD}/nl/wielerkleding-ontwerpen/,https://rondevanrotterdam.nl/nl/wielerkleding-ontwerpen/,draft`;
if (!csv.includes("/nl/wielerkleding-ontwerpen/")) await writeFile(new URL("redirects.csv", root), csv + line + "\n");

console.log(`wielerkleding-ontwerpen → id ${res.id} | status ${res.status} | ${res.link}`);
