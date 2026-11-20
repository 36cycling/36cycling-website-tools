// /nl/veelgestelde-vragen/ en /en/faq/ — vraagbaak met Yoast FAQ-blokken (FAQPage-schema komt van Yoast zelf).
// 20 nov 2026: vragen uit Search Console, het contactformulier en de mailbox (alleen de vragen, geen namen).
// Eén pagina per zoekdoel: vragen over maatwerk krijgen een kort antwoord en een link naar de pagina die het onderwerp "bezit".
// Nieuwe pagina's worden als CONCEPT aangemaakt; een bestaande pagina blijft ongemoeid (Jeroen maakt zelf op).
//   node scripts/build-faq.mjs
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { blocks } from "../lib/build.mjs";

const ROOT = new URL("..", import.meta.url);
const STATE = new URL("state.json", ROOT);
const cfg = await loadConfig();
const state = JSON.parse(await readFile(STATE, "utf8"));
const { heading, paragraph, buttons } = blocks;
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const wp = async (method, path, body) => {
  const r = await fetch(cfg.wp.baseUrl.replace(/\/$/, "") + "/wp-json" + path, { method, headers: AUTH, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
};

// HTML met alleen <a href> omzetten naar het "children"-formaat van de blokeditor (anders keurt de editor het blok af).
const toChildren = (html) => {
  const out = [];
  const re = /<a href="([^"]+)">([^<]*)<\/a>/g;
  let last = 0, m;
  while ((m = re.exec(html))) {
    if (m.index > last) out.push(html.slice(last, m.index));
    out.push({ type: "a", props: { href: m[1], children: [m[2]] } });
    last = re.lastIndex;
  }
  if (last < html.length) out.push(html.slice(last));
  return out;
};
// Blokattributen serialiseren zoals Gutenberg dat doet (geen "--", "<", ">", "&" of '"' letterlijk in het commentaar).
const attrJson = (obj) => JSON.stringify(obj)
  .replace(/--/g, "\\u002d\\u002d").replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\\"/g, "\\u0022");
const faq = (prefix, items) => {
  const questions = items.map(([q, a], i) => ({ id: `faq-question-${prefix}-${i + 1}`, question: [q], answer: toChildren(a), jsonQuestion: q, jsonAnswer: a }));
  const sections = questions.map((x, i) => `<div class="schema-faq-section" id="${x.id}"><strong class="schema-faq-question">${items[i][0]}</strong> <p class="schema-faq-answer">${items[i][1]}</p> </div>`).join("");
  return `<!-- wp:yoast/faq-block ${attrJson({ questions })} -->\n<div class="schema-faq wp-block-yoast-faq-block">${sections}</div>\n<!-- /wp:yoast/faq-block -->`;
};

const NL = {
  maatwerk: [
    ["Wat is het minimum aantal voor wielerkleding in eigen ontwerp?", 'Een volledig eigen ontwerp maken we vanaf 5 stuks. Wil je minder, bijvoorbeeld één shirt? Dan bedrukken we een wielershirt uit voorraad met je eigen logo of tekst: <a href="/nl/snel-wielershirt-bedrukken/">wielershirt met eigen logo, vanaf 1 stuk</a>.'],
    ["Hoe lang duurt het voordat mijn kleding klaar is?", "Kleding in een volledig eigen ontwerp is 3 tot 5 weken na goedkeuring van het ontwerp klaar, afhankelijk van het product en de tijd van het jaar. Een shirt uit voorraad met je logo is binnen enkele dagen klaar. Heb je een vaste datum, zoals een evenement? Laat het ons weten, dan denken we mee."],
    ["Wat kost wielerkleding in eigen ontwerp?", 'Een wielershirt in eigen ontwerp kost vanaf € 35 excl. btw (€ 42,35 incl. btw) per stuk bij 10 stuks, plus eenmalige opstartkosten voor je ontwerp. Bij 5 tot 9 stuks is de prijs per stuk iets hoger. De prijs hangt verder af van de kwaliteit die je kiest. Heel snel een shirt nodig? Dat kan ook. We hebben <a href="/nl/snel-wielershirt-bedrukken/">shirts op voorraad</a> waarop we je logo of tekst drukken voor € 89 per stuk. <a href="/nl/offerteaanvraag/">Vraag een offerte aan</a>, dan krijg je snel een exacte prijs.'],
    ["Kan ik mijn eigen ontwerp aanleveren?", "Ja. Je kunt een ontwerp, schets of je logo's sturen, of zelf beginnen in onze 3D-designer. Onze ontwerpers maken er een productieklaar ontwerp van en laten je een 3D-voorbeeld zien voordat we gaan maken. Logo's ontvangen we het liefst als vectorbestand (EPS, PDF of AI)."],
    ["Betaal ik voor het ontwerp?", "Je betaalt voor het ontwerp als je alles in onze handen geeft. Ben je zelf al ver op weg, bijvoorbeeld in onze 3D-designer, dan vervallen deze kosten."],
    ["Hoe wordt de kleding bedrukt?", "Kleding in eigen ontwerp maken we met sublimatiedruk: de inkt wordt in de stof zelf gedrukt. Daardoor kan elke kleur en elk ontwerp, blijft de stof soepel en slijt de print niet. Een shirt uit voorraad bedrukken we met dunne transfers."],
    ["Hoe weet ik welke maat ik nodig heb?", 'Passen met onze paskleding is het beste; die sturen we je toe. Lukt dat niet, dan helpt de <a href="/nl/maatwijzer/">maatwijzer</a> je snel op weg.'],
    ["Kan ik later nabestellen?", "Ja, we bewaren jullie ontwerp. Ook als je jaren later nog eens wilt bestellen, kan dat. De eenmalige kosten komen dan niet meer terug."],
    ["Kunnen er namen of nummers op de kleding?", "Ja, dat kan. Er is dan wel een kleine meerprijs per gepersonaliseerd item."],
    ["Kunnen leden van onze club of medewerkers zelf bestellen?", 'Ja. Voor clubs en bedrijven kunnen we een eigen webshop openen waar leden of medewerkers zelf hun kleding bestellen en betalen. Wij bundelen de bestellingen en laten ze samen maken. Lees meer over <a href="/nl/custom-teamwear/">teamkleding</a>.'],
    ["Maken jullie ook andere sportkleding?", 'Ja: voor hardlopen, schaatsen, triatlon, padel, wandelen, langlaufen en veldsporten. Lees meer over <a href="/nl/sportkleding-bedrukken/">sportkleding bedrukken</a>.'],
  ],
  materiaal: [
    ["Wat is een zeem in een fietsbroek?", 'Het zeem is het kussentje in een fietsbroek. Het vermindert de druk op je zitvlak, voert vocht af en voorkomt schuren. Voor de racefiets kies je een dunner zeem, voor de mountainbike een dikker zeem met meer demping. Lees meer in <a href="/nl/stories/zemen/">Zemen in wielerbroeken</a>.'],
    ["Draag je ondergoed onder een fietsbroek?", "Nee. Een fietsbroek met zeem draag je zonder ondergoed. Zo sluit het zeem goed aan en zijn er geen naden die schuren."],
    ["Waarvoor is een lange fietsbroek zonder zeem?", "Onze lange broeken zonder zeem zijn van warme, gevoerde stof (Dolomiti). Sommige fietsers dragen ze bij koud weer over een korte fietsbroek met zeem. Veel mensen fietsen liever in één lange broek; kies dan een lange fietsbroek met zeem. Het is een kwestie van voorkeur."],
    ["Hoe was ik wielerkleding?", 'Goed wassen is het belangrijkste om je wielerkleding mooi te houden. Veel fietskleding bevat elastaan, en dat is gevoelig voor hitte. Was daarom op maximaal 30 graden met het programma fijne was en doe de ritsen dicht. Gebruik heel weinig wasmiddel en geen wasverzachter. Laat de kleding aan de lucht drogen, niet in de droger en niet in de felle zon. Alle tips lees je in <a href="/nl/stories/wielerkleding-wassen/">Wielerkleding wassen</a>.'],
    ["Hoe vallen de maten van jullie wielershirts?", 'Onze wielershirts vallen normaal voor wielerkleding, dus strak. Twijfel je tussen twee maten, neem dan de grotere. Met de <a href="/nl/maatwijzer/">maatwijzer</a> vind je snel je maat.'],
    ["Hebben jullie wielerkleding in grote maten?", "Ja. De meeste shirts zijn er tot en met 3XL, een deel ook in 4XL of 5XL. Bij elk product zie je welke maten er zijn."],
  ],
  webshop: [
    ["Wat zijn de verzendkosten?", "Binnen Nederland € 7,95, ook als je je pakket bij een DHL-punt laat bezorgen. Naar de rest van Europa € 10,50."],
    ["Kan ik ruilen of retourneren?", 'Ja, binnen 2 weken na ontvangst, als het artikel ongedragen en in originele staat is. Stop de pakbon in de doos en noteer erop welke maat of welk artikel je wilt als je ruilt. De kosten voor het terugsturen zijn voor jezelf. Lees meer over <a href="/nl/ruilen-en-retourneren/">ruilen en retourneren</a>.'],
    ["Waar is mijn bestelling?", 'Dat zoek je zelf op met je e-mailadres en postcode, ook voor bestellingen in de webshop van je club of bedrijf. Zie <a href="/nl/waar-is-mijn-bestelling/">Waar is mijn bestelling?</a>'],
  ],
  over: [
    ["Wat is 36 Cycling?", 'Al meer dan 10 jaar maken we wielerkleding en sportkleding in eigen ontwerp voor bedrijven, clubs en teams, en verkopen we onze eigen wielerkleding in de webshop. Oud-profs als Leontien van Moorsel, Maarten den Bakker en Bart Voskamp zijn bij 36 Cycling betrokken. Lees meer <a href="/nl/over-36/">over 36</a>.'],
    ["Waar zitten jullie?", 'In Moordrecht (Zuid-Holland), aan de Westbaan 286. Je bereikt ons via <a href="/nl/contact/">het contactformulier</a>, info@36cycling.com of 0182 – 232 008.'],
    ["Waarom heet het 36?", 'Sporters hebben vaak bijgeloof en rituelen. 36 is een getal met veel kracht en lading. Fausto Coppi gaf het getal mythische waarden. En onze eigen Leontien van Moorsel behaalde haar mooiste overwinning met nummer 36: olympisch kampioene in Sydney. <a href="/nl/over-36/">Lees meer</a>'],
  ],
};

const EN = {
  maatwerk: [
    ["What is the minimum order for custom cycling clothing?", 'We make a fully custom design from 5 pieces. Need fewer, for example one jersey? Then we print a jersey from stock with your own logo or text: <a href="/en/custom-cycling-jersey-from-1-piece/">custom cycling jersey from 1 piece</a>.'],
    ["How long does it take before my clothing is ready?", "Clothing in a fully custom design is ready 3 to 5 weeks after design approval, depending on the product and the time of year. A stock jersey with your logo is ready within a few days. Do you have a fixed date, such as an event? Let us know and we will think along with you."],
    ["How much does custom cycling clothing cost?", 'A cycling jersey in your own design starts at € 35 excl. VAT (€ 42.35 incl. VAT) per piece for 10 pieces, plus a one-off set-up fee for your design. For 5 to 9 pieces the price per piece is slightly higher. The price also depends on the quality you choose. Need a jersey very quickly? That is possible too. We have <a href="/en/custom-cycling-jersey-from-1-piece/">jerseys in stock</a> that we print with your logo or text for € 89 per piece. <a href="/en/request-a-quote/">Request a quote</a> and you will quickly get an exact price.'],
    ["Can I supply my own design?", "Yes. You can send a design, a sketch or your logos, or start yourself in our 3D designer. Our designers turn it into a production-ready design and show you a 3D preview before we start production. We prefer logos as a vector file (EPS, PDF or AI)."],
    ["Do I pay for the design?", "You pay for the design if you leave everything in our hands. If you have already come a long way yourself, for example in our 3D designer, these costs are waived."],
    ["How is the clothing printed?", "We make custom clothing with sublimation printing: the ink is printed into the fabric itself. This allows any colour and any design, keeps the fabric soft and the print does not wear off. Stock jerseys are printed with thin transfers."],
    ["How do I know which size I need?", 'Trying on our fitting samples is best; we send them to you. If that is not possible, the <a href="/en/size-finder/">size finder</a> gets you started quickly.'],
    ["Can I reorder later?", "Yes, we keep your design on file. Even if you want to order again years later, that is possible. The one-off fee is not charged again."],
    ["Can names or numbers be added to the clothing?", "Yes, that is possible. There is a small surcharge per personalised item."],
    ["Can club members or employees order themselves?", 'Yes. For clubs and companies we can open a dedicated webshop where members or employees order and pay for their own clothing. We bundle the orders and have them made together. Read more about <a href="/en/custom-teamwear/">teamwear</a>.'],
    ["Do you also make other sportswear?", 'Yes: for running, ice skating, triathlon, padel, hiking, cross-country skiing and field sports. Read more about <a href="/en/custom-sportwear/">custom sportswear</a>.'],
  ],
  materiaal: [
    ["What is a chamois in cycling shorts?", 'The chamois is the pad in cycling shorts. It reduces pressure on your seat, wicks away moisture and prevents chafing. For road cycling you choose a thinner chamois, for mountain biking a thicker one with more cushioning. Read more in <a href="/en/stories/chamois-pads/">Chamois pads in cycling shorts</a>.'],
    ["Do you wear underwear under cycling shorts?", "No. Cycling shorts with a chamois are worn without underwear. That way the chamois fits properly and there are no seams to chafe."],
    ["What are long cycling tights without a chamois for?", "Our long tights without a chamois are made of warm, lined fabric (Dolomiti). Some riders wear them in cold weather over short cycling shorts with a chamois. Many people prefer to ride in just one pair of long tights; then choose long cycling tights with a chamois. It is a matter of personal preference."],
    ["How do I wash cycling clothing?", 'Washing properly is the most important thing to keep your cycling clothing looking good. Much cycling clothing contains elastane, which is sensitive to heat. So wash at a maximum of 30 degrees on the delicates programme and close the zips. Use very little detergent and no fabric softener. Let the clothing air dry, not in the dryer and not in bright sunlight. Read all the tips in <a href="/en/stories/how-to-wash-cycling-clothing/">How to wash cycling clothing</a>.'],
    ["How do your cycling jerseys fit?", 'Our cycling jerseys have a regular cycling fit, so they are close-fitting. In doubt between two sizes? Take the larger one. The <a href="/en/size-finder/">size finder</a> helps you find your size quickly.'],
    ["Do you have cycling clothing in large sizes?", "Yes. Most jerseys go up to 3XL, some also come in 4XL or 5XL. Each product shows which sizes are available."],
  ],
  webshop: [
    ["What are the shipping costs?", "Within the Netherlands € 7.95, also when you have your parcel delivered to a DHL service point. To the rest of Europe € 10.50."],
    ["Can I exchange or return an item?", 'Yes, within 2 weeks of receipt, if the item is unworn and in its original condition. Put the packing slip in the box and, if you are exchanging, note which size or item you would like. Return shipping costs are at your own expense. Read more about <a href="/en/returns-and-exchanges/">returns and exchanges</a>.'],
    ["Where is my order?", 'You can look it up yourself with your email address and postcode, also for orders in the webshop of your club or company. See <a href="/en/where-is-my-order/">Where is my order?</a>'],
  ],
  over: [
    ["What is 36 Cycling?", 'For more than 10 years we have been making custom cycling clothing and sportswear for companies, clubs and teams, and we sell our own cycling clothing in our webshop. Former pros such as Leontien van Moorsel, Maarten den Bakker and Bart Voskamp are involved with 36 Cycling. Read more <a href="/en/about-36/">about 36</a>.'],
    ["Where are you located?", 'In Moordrecht (South Holland, the Netherlands), at Westbaan 286. You can reach us via <a href="/en/contact/">the contact form</a>, info@36cycling.com or +31 182 232 008.'],
    ["Why is it called 36?", 'Athletes often have superstitions and rituals. 36 is a number with a lot of power and meaning. Fausto Coppi gave the number a mythical value. And our own Leontien van Moorsel achieved her greatest victory wearing number 36: Olympic champion in Sydney. <a href="/en/about-36/">Read more</a>'],
  ],
};

const build = (lang, Q) => {
  const t = lang === "nl"
    ? { h1: "Veelgestelde vragen", intro: "Hier vind je antwoorden op de vragen die we het vaakst krijgen: over wielerkleding in eigen ontwerp, onze producten, de webshop en over 36 Cycling zelf. Staat je vraag er niet bij? Neem gerust contact op.", s: ["Wielerkleding in eigen ontwerp", "Producten en materiaal", "Webshop: verzenden, ruilen en retour", "Over 36 Cycling"], end: "Staat je vraag er niet bij?", endP: "We helpen je graag. Stuur een bericht of vraag meteen een offerte aan.", btn: [{ text: "Neem contact op", href: "/nl/contact/" }, { text: "Offerte aanvragen", href: "/nl/offerteaanvraag/" }] }
    : { h1: "Frequently asked questions", intro: "Here you will find answers to the questions we get most often: about custom cycling clothing, our products, the webshop and 36 Cycling itself. Is your question not listed? Feel free to get in touch.", s: ["Custom cycling clothing", "Products and materials", "Webshop: shipping, exchanges and returns", "About 36 Cycling"], end: "Is your question not listed?", endP: "We are happy to help. Send us a message or request a quote right away.", btn: [{ text: "Contact us", href: "/en/contact/" }, { text: "Request a quote", href: "/en/request-a-quote/" }] };
  const keys = ["maatwerk", "materiaal", "webshop", "over"];
  return [
    heading(t.h1, 1, { size: "x-large" }),
    paragraph(t.intro),
    ...keys.flatMap((k, i) => [heading(t.s[i], 2), faq(`${lang}-${k}`, Q[k])]),
    heading(t.end, 2),
    paragraph(t.endP),
    buttons(t.btn),
  ].join("\n\n");
};

const PAGES = {
  nl: { title: "Veelgestelde vragen", slug: "veelgestelde-vragen", seoTitle: "Veelgestelde vragen: maatwerk, maten en webshop", metadesc: "Antwoord op de meestgestelde vragen: minimum aantal, levertijd, prijs, maten, zeem, wassen, verzenden en retour. Wielerkleding in eigen ontwerp vanaf 5 stuks.", focus: "veelgestelde vragen wielerkleding", content: build("nl", NL) },
  en: { title: "Frequently asked questions", slug: "faq", seoTitle: "FAQ: custom cycling clothing, sizes and webshop", metadesc: "Answers to the most frequently asked questions: minimum order, delivery time, price, sizes, chamois, washing, shipping and returns. Custom cycling clothing from 5 pieces.", focus: "cycling clothing faq", content: build("en", EN) },
};

// --blok=<sleutel> (maatwerk, materiaal, webshop, over): vervangt op de bestaande (ook gepubliceerde) pagina's alleen dat ene FAQ-blok,
// met back-up in backups/. De rest van de pagina (ook eigen aanpassingen van Jeroen) blijft staan.
const blokArg = process.argv.find((a) => a.startsWith("--blok="));
if (blokArg) {
  const key = blokArg.slice(7);
  const DATA = { nl: NL, en: EN };
  if (!DATA.nl[key]) throw new Error(`onbekend blok: ${key}`);
  const stamp = new Date().toISOString().slice(0, 10);
  for (const lang of ["nl", "en"]) {
    const id = state[`faq-${lang}`]?.id;
    const p = await wp("GET", `/wp/v2/pages/${id}?context=edit&_fields=id,content,modified`);
    await writeFile(new URL(`backups/page-${id}-before-faq-${key}-${stamp}.json`, ROOT), JSON.stringify(p, null, 1));
    const re = new RegExp(`<!-- wp:yoast/faq-block \\{"questions":\\[\\{"id":"faq-question-${lang}-${key}-1"[\\s\\S]*?<!-- /wp:yoast/faq-block -->`);
    const hits = p.content.raw.match(new RegExp(re.source, "g")) || [];
    if (hits.length !== 1) throw new Error(`pagina ${id}: blok ${key} ${hits.length}x gevonden`);
    await wp("POST", `/wp/v2/pages/${id}`, { content: p.content.raw.replace(re, () => faq(`${lang}-${key}`, DATA[lang][key])) });
    console.log(`pagina ${lang}: #${id} blok ${key} vervangen`);
  }
  process.exit(0);
}

const ids = {};
for (const [lang, p] of Object.entries(PAGES)) {
  const key = `faq-${lang}`;
  if (state[key]?.id) {
    ids[lang] = state[key].id;
    // --update-concept: alleen een concept dat sinds het aanmaken niet is bewerkt (geen revisies, modified niet later dan date; openen in de editor verschuift date bij concepten) opnieuw opbouwen.
    if (process.argv.includes("--update-concept")) {
      const cur = await wp("GET", `/wp/v2/pages/${state[key].id}?context=edit&_fields=status,date,modified`);
      const revs = await wp("GET", `/wp/v2/pages/${state[key].id}/revisions?_fields=id`);
      if (cur.status === "draft" && cur.modified <= cur.date && revs.length === 0) {
        await wp("POST", `/wp/v2/pages/${state[key].id}`, { content: p.content });
        console.log(`pagina ${lang}: #${state[key].id} concept bijgewerkt`);
        continue;
      }
      console.log(`pagina ${lang}: #${state[key].id} is ${cur.status} of al bewerkt; niet overschreven`);
      continue;
    }
    console.log(`pagina ${lang}: #${state[key].id} bestaat al, inhoud blijft ongemoeid`);
    continue;
  }
  const res = await upsertPage(cfg, { title: p.title, slug: p.slug, lang, status: "draft", content: p.content, meta: { _yoast_wpseo_title: p.seoTitle, _yoast_wpseo_metadesc: p.metadesc, _yoast_wpseo_focuskw: p.focus } });
  ids[lang] = res.id;
  state[key] = { id: res.id, link: res.link };
  await writeFile(STATE, JSON.stringify(state, null, 2));
  console.log(`pagina ${lang}: #${res.id} ${res.status} slug ${res.slug}`);
}
const vert = await wp("GET", `/c36/v1/translations?element_type=post_page&id=${ids.nl}`);
if (vert.translations?.en?.element_id !== ids.en) {
  await wp("POST", "/c36/v1/link", { element_type: "post_page", source_id: ids.nl, translation_id: ids.en, lang: "en", source_lang: "nl" });
  console.log("NL- en EN-pagina gekoppeld in WPML");
}
console.log(JSON.stringify(ids));
