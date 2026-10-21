// /nl/privacy/ + /en/privacy/ — privacyverklaring (AVG), op basis van wat de site echt verwerkt:
// webshop (WooCommerce), Mollie/Klarna, Sendcloud (PostNL/DHL), 36 Cycling Circle (FluentCRM + LaPosta),
// Fluent Forms, Teamleader-offerteformulier, Google Tag Manager (GA4, Google Ads, Meta, Hotjar, Clarity).
// Pagina's als concept (bestaande gepubliceerde pagina's blijven gepubliceerd); EN gekoppeld in WPML.
//   node scripts/build-privacy.mjs [--dry]
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { blocks } from "../lib/build.mjs";

const DRY = process.argv.includes("--dry");
const { paragraph, list, breadcrumbs } = blocks;
const STATE = new URL("../state.json", import.meta.url);
const H = (text, level = 2, size) => {
  const id = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const attrs = { ...(level !== 2 ? { level } : {}), ...(size ? { fontSize: size } : {}), anchor: id };
  return `<!-- wp:heading ${JSON.stringify(attrs)} -->\n<h${level} id="${id}" class="wp-block-heading${size ? ` has-${size}-font-size` : ""}">${text}</h${level}>\n<!-- /wp:heading -->`;
};
const mail = '<a href="mailto:info@36cycling.com">info@36cycling.com</a>';
const ext = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;

// [type, inhoud]: h2/h3/p = HTML-tekst, ul = lijst met HTML-items.
const NL = {
  title: "Privacyverklaring",
  seo: { title: "Privacyverklaring", desc: "Lees hoe 36 Cycling omgaat met je persoonsgegevens: bij bestellingen, de 36 Cycling Circle, contact- en offerteaanvragen en cookies." },
  body: [
    ["p", "Bij 36 Cycling gaan we zorgvuldig om met je persoonsgegevens. In deze privacyverklaring lees je welke gegevens we verzamelen, waarom we dat doen, met wie we ze delen, hoe lang we ze bewaren en welke rechten je hebt. We houden ons daarbij aan de Algemene verordening gegevensbescherming (AVG)."],
    ["h2", "Wie zijn wij?"],
    ["p", "36 Cycling BV is verantwoordelijk voor de verwerking van je persoonsgegevens zoals beschreven in deze privacyverklaring."],
    ["p", `36 Cycling BV<br>Westbaan 286<br>2841 MC Moordrecht<br>KvK-nummer: 55679455<br>E-mail: ${mail}<br>Telefoon: <a href="tel:+31182232008">+31 (0)182 - 232 008</a>`],
    ["h2", "Welke gegevens verwerken we en waarom?"],
    ["h3", "Bestellingen in de webshop"],
    ["p", "Als je een bestelling plaatst, verwerken we je naam, adres, e-mailadres, telefoonnummer, eventueel je bedrijfsnaam, de producten die je bestelt en de betaalstatus. We gebruiken deze gegevens om je bestelling te verwerken, te verzenden en te factureren, om je op de hoogte te houden van je bestelling en voor klantenservice, retouren en garantie. De grondslag is de uitvoering van de overeenkomst met jou. Voor onze administratie zijn we wettelijk verplicht gegevens te bewaren."],
    ["h3", "Je account"],
    ["p", "Maak je een account aan, dan bewaren we je inloggegevens, adresgegevens en bestelgeschiedenis, zodat je sneller kunt bestellen en je bestellingen kunt terugzien. Je wachtwoord slaan we alleen versleuteld op. De grondslag is de uitvoering van de overeenkomst met jou."],
    ["h3", "36 Cycling Circle en nieuwsbrief"],
    ["p", "Meld je je aan voor de 36 Cycling Circle, via de website of met het vinkje bij het afrekenen, dan verwerken we je naam en e-mailadres. Daarmee krijg je als lid korting en sturen we je onze nieuwsbrief met nieuwe collecties, acties en nieuws. De grondslag is je toestemming. Je kunt je op elk moment afmelden via de link onderaan elke nieuwsbrief. Wil je ook je lidmaatschap beëindigen en je gegevens laten verwijderen, stuur dan een e-mail naar " + mail + "."],
    ["h3", "Contact- en offerteaanvragen"],
    ["p", "Neem je contact met ons op via een formulier, per e-mail of telefonisch, dan verwerken we je naam, e-mailadres, telefoonnummer en wat je ons vertelt, zoals je vraag of het gewenste aantal. Bij een offerteaanvraag komen ook je bedrijfs- of clubgegevens en de details van je aanvraag in ons klantsysteem. We gebruiken deze gegevens om je vraag te beantwoorden en om een offerte te maken. De grondslag is je verzoek om maatregelen te nemen voordat een overeenkomst wordt gesloten, en ons gerechtvaardigd belang om je vraag goed af te handelen."],
    ["h3", "Websitebezoek en cookies"],
    ["p", "Als je de website bezoekt, verwerken we technische gegevens zoals je IP-adres, browser en de pagina's die je bekijkt. Meer daarover lees je hieronder bij <a href=\"#cookies-en-meetgegevens\">Cookies en meetgegevens</a>."],
    ["h2", "Betalen"],
    ["p", "Betalingen verlopen via onze betaalprovider Mollie. Afhankelijk van je keuze betaal je met iDEAL | Wero, creditcard, Bancontact, Klarna of een bankoverschrijving. Je betaalgegevens worden door Mollie en de betreffende bank of betaaldienst verwerkt; wij ontvangen geen volledige kaart- of rekeninggegevens, alleen of de betaling gelukt is. Betaal je achteraf met Klarna, dan geven we je naam, adres, e-mailadres, telefoonnummer en bestelgegevens door aan Klarna. Klarna kan je kredietwaardigheid controleren en is zelf verantwoordelijk voor die verwerking. Lees daarvoor ook de privacyverklaring van " + ext("https://www.mollie.com/nl/privacy", "Mollie") + " en van " + ext("https://www.klarna.com/nl/privacy/", "Klarna") + "."],
    ["h2", "Verzenden"],
    ["p", "Om je bestelling te bezorgen, geven we je naam, adres, e-mailadres en telefoonnummer door aan Sendcloud, ons verzendplatform, en aan de vervoerder die je pakket bezorgt: PostNL of DHL. Zij gebruiken deze gegevens alleen om je pakket te bezorgen en je op de hoogte te houden met track &amp; trace."],
    ["h2", "Met wie delen we je gegevens?"],
    ["p", "We verkopen je gegevens nooit aan anderen. We delen ze alleen als dat nodig is om onze diensten te leveren, of als de wet ons daartoe verplicht. Met partijen die in onze opdracht gegevens verwerken, hebben we afspraken gemaakt over beveiliging en vertrouwelijkheid. Dit zijn de partijen waarmee we werken:"],
    ["ul", [
      "<strong>Onze hostingpartij</strong>: voor de website, de webshop en de opslag van bestellingen, accounts, formulieren en de ledenlijst van de 36 Cycling Circle",
      "<strong>Mollie</strong> en <strong>Klarna</strong>: voor het afhandelen van betalingen",
      "<strong>Sendcloud</strong>, <strong>PostNL</strong> en <strong>DHL</strong>: voor het verzenden en bezorgen van je bestelling",
      "<strong>LaPosta</strong>: voor het versturen van onze nieuwsbrief",
      "<strong>Teamleader</strong>: ons klantsysteem voor offertes, opdrachten en facturen",
      "<strong>Google</strong> (Google Tag Manager, Google Analytics en Google Ads), <strong>Meta</strong> (Facebook en Instagram), <strong>Hotjar</strong> en <strong>Microsoft Clarity</strong>: voor statistieken en advertenties, alleen met je toestemming",
    ]],
    ["h2", "Cookies en meetgegevens"],
    ["p", "Een cookie is een klein bestand dat bij een bezoek aan de website op je apparaat wordt opgeslagen. We gebruiken functionele cookies die nodig zijn om de website te laten werken, bijvoorbeeld om je winkelwagen, taalkeuze en inlogstatus te onthouden. Daarvoor is geen toestemming nodig."],
    ["p", "Met je toestemming gebruiken we daarnaast cookies en vergelijkbare technieken van andere partijen. Die laden we via Google Tag Manager:"],
    ["ul", [
      "<strong>Google Analytics</strong>: om te meten hoe bezoekers de website gebruiken, zodat we de website kunnen verbeteren",
      "<strong>Google Ads</strong> en de <strong>Meta-pixel</strong> (Facebook en Instagram): om te meten of onze advertenties werken en om je relevante advertenties te tonen",
      "<strong>Hotjar</strong> en <strong>Microsoft Clarity</strong>: om te zien hoe bezoekers klikken en scrollen, zodat we knelpunten op de website kunnen oplossen",
    ]],
    ["p", "Bij je eerste bezoek vragen we via de cookiemelding om je toestemming. Je kunt je keuze altijd weer wijzigen of je toestemming intrekken. Je kunt cookies ook via de instellingen van je browser verwijderen of blokkeren."],
    ["h2", "Gegevens buiten de Europese Unie"],
    ["p", "Sommige partijen, zoals Google, Meta en Microsoft, kunnen gegevens ook in de Verenigde Staten verwerken. Dat gebeurt alleen als er passende waarborgen zijn, zoals het EU-VS Data Privacy Framework of de standaardcontractbepalingen van de Europese Commissie."],
    ["h2", "Hoe lang bewaren we je gegevens?"],
    ["p", "We bewaren je gegevens niet langer dan nodig is:"],
    ["ul", [
      "<strong>Bestellingen en facturen</strong>: 7 jaar, omdat we dat volgens de fiscale bewaarplicht moeten",
      "<strong>Je account</strong>: tot je het account opheft; de bestelgegevens bewaren we daarna nog zolang de fiscale bewaarplicht geldt",
      "<strong>36 Cycling Circle en nieuwsbrief</strong>: tot je je afmeldt of je lidmaatschap beëindigt",
      "<strong>Contact- en offerteaanvragen</strong>: zolang nodig is om je vraag af te handelen; leidt je aanvraag tot een opdracht, dan 7 jaar, zoals bij bestellingen, en anders maximaal 2 jaar na ons laatste contact",
      "<strong>Cookies</strong>: zolang als in de cookiemelding staat vermeld",
    ]],
    ["h2", "Hoe beveiligen we je gegevens?"],
    ["p", "We nemen passende technische en organisatorische maatregelen om je gegevens te beschermen tegen verlies en onrechtmatig gebruik. De website gebruikt een beveiligde verbinding (https), alleen bevoegde medewerkers hebben toegang tot je gegevens en we houden onze systemen up-to-date. Heb je de indruk dat je gegevens niet goed beveiligd zijn of dat er misbruik wordt gemaakt? Neem dan contact met ons op via " + mail + "."],
    ["h2", "Jouw rechten"],
    ["p", "Je hebt het recht om:"],
    ["ul", [
      "je gegevens in te zien",
      "onjuiste gegevens te laten corrigeren",
      "je gegevens te laten verwijderen, voor zover we ze niet wettelijk moeten bewaren",
      "de verwerking van je gegevens te laten beperken",
      "je gegevens in een gangbaar bestandsformaat te ontvangen of door te laten sturen naar een andere partij",
      "bezwaar te maken tegen het gebruik van je gegevens, bijvoorbeeld voor direct marketing",
      "je toestemming op elk moment in te trekken",
    ]],
    ["p", "Stuur je verzoek naar " + mail + ". We reageren zo snel mogelijk, uiterlijk binnen een maand. Om zeker te weten dat het verzoek van jou komt, kunnen we je vragen om je te identificeren."],
    ["h2", "Klacht indienen"],
    ["p", "Ben je niet tevreden over hoe we met je gegevens omgaan? Laat het ons dan weten, dan zoeken we samen naar een oplossing. Je hebt ook altijd het recht om een klacht in te dienen bij de " + ext("https://autoriteitpersoonsgegevens.nl/", "Autoriteit Persoonsgegevens") + "."],
    ["h2", "Wijzigingen"],
    ["p", "We kunnen deze privacyverklaring aanpassen, bijvoorbeeld als we een nieuwe dienst gaan gebruiken. De meest actuele versie staat altijd op deze pagina. Zie ook onze <a href=\"/nl/algemene-voorwaarden/\">algemene voorwaarden</a>."],
    ["p", "<em>Laatst bijgewerkt: 16 oktober 2026</em>"],
  ],
};

const EN = {
  title: "Privacy policy",
  seo: { title: "Privacy policy", desc: "Read how 36 Cycling handles your personal data: for orders, the 36 Cycling Circle, contact and quote requests, and cookies." },
  body: [
    ["p", "At 36 Cycling we handle your personal data with care. This privacy policy explains what data we collect, why we do so, who we share it with, how long we keep it and what rights you have. We comply with the General Data Protection Regulation (GDPR)."],
    ["h2", "Who are we?"],
    ["p", "36 Cycling BV is the controller responsible for processing your personal data as described in this privacy policy."],
    ["p", `36 Cycling BV<br>Westbaan 286<br>2841 MC Moordrecht<br>The Netherlands<br>Chamber of Commerce (KvK) number: 55679455<br>Email: ${mail}<br>Phone: <a href="tel:+31182232008">+31 (0)182 - 232 008</a>`],
    ["h2", "What data do we process and why?"],
    ["h3", "Orders in our online shop"],
    ["p", "When you place an order, we process your name, address, email address, phone number, company name if provided, the products you order and the payment status. We use this data to process, ship and invoice your order, to keep you informed about your order, and for customer service, returns and warranty. The legal basis is the performance of our contract with you. We are also legally required to keep certain data for our accounts."],
    ["h3", "Your account"],
    ["p", "If you create an account, we store your login details, address details and order history, so you can order faster and view your previous orders. Your password is only stored in encrypted form. The legal basis is the performance of our contract with you."],
    ["h3", "36 Cycling Circle and newsletter"],
    ["p", "If you join the 36 Cycling Circle, through the website or by ticking the box at checkout, we process your name and email address. As a member you get a discount, and we send you our newsletter with new collections, offers and news. The legal basis is your consent. You can unsubscribe at any time using the link at the bottom of every newsletter. If you also want to end your membership and have your data deleted, send an email to " + mail + "."],
    ["h3", "Contact and quote requests"],
    ["p", "If you contact us through a form, by email or by phone, we process your name, email address, phone number and the information you give us, such as your question or the quantity you need. For a quote request, your company or club details and the details of your request are also stored in our customer system. We use this data to answer your question and to prepare a quote. The legal basis is your request to take steps before entering into a contract, and our legitimate interest in handling your request properly."],
    ["h3", "Website visits and cookies"],
    ["p", "When you visit the website, we process technical data such as your IP address, browser and the pages you view. You can read more about this below under <a href=\"#cookies-and-analytics\">Cookies and analytics</a>."],
    ["h2", "Payments"],
    ["p", "Payments are handled by our payment provider Mollie. Depending on your choice, you pay with iDEAL | Wero, credit card, Bancontact, Klarna or bank transfer. Your payment details are processed by Mollie and the relevant bank or payment service; we do not receive your full card or account details, only whether the payment succeeded. If you choose to pay later with Klarna, we pass your name, address, email address, phone number and order details to Klarna. Klarna may check your creditworthiness and is itself responsible for that processing. Please also read the privacy policies of " + ext("https://www.mollie.com/privacy", "Mollie") + " and " + ext("https://www.klarna.com/international/privacy-policy/", "Klarna") + "."],
    ["h2", "Shipping"],
    ["p", "To deliver your order, we pass your name, address, email address and phone number to Sendcloud, our shipping platform, and to the carrier that delivers your parcel: PostNL or DHL. They only use this data to deliver your parcel and to keep you informed with track &amp; trace."],
    ["h2", "Who do we share your data with?"],
    ["p", "We never sell your data. We only share it when this is necessary to provide our services, or when the law requires us to. We have agreements on security and confidentiality with the parties that process data on our behalf. These are the parties we work with:"],
    ["ul", [
      "<strong>Our hosting provider</strong>: for the website, the online shop and the storage of orders, accounts, forms and the 36 Cycling Circle member list",
      "<strong>Mollie</strong> and <strong>Klarna</strong>: for processing payments",
      "<strong>Sendcloud</strong>, <strong>PostNL</strong> and <strong>DHL</strong>: for shipping and delivering your order",
      "<strong>LaPosta</strong>: for sending our newsletter",
      "<strong>Teamleader</strong>: our customer system for quotes, orders and invoices",
      "<strong>Google</strong> (Google Tag Manager, Google Analytics and Google Ads), <strong>Meta</strong> (Facebook and Instagram), <strong>Hotjar</strong> and <strong>Microsoft Clarity</strong>: for statistics and advertising, only with your consent",
    ]],
    ["h2", "Cookies and analytics"],
    ["p", "A cookie is a small file that is stored on your device when you visit the website. We use functional cookies that the website needs to work, for example to remember your shopping cart, language and login status. These do not require consent."],
    ["p", "With your consent, we also use cookies and similar technologies from other parties. We load them through Google Tag Manager:"],
    ["ul", [
      "<strong>Google Analytics</strong>: to measure how visitors use the website, so we can improve it",
      "<strong>Google Ads</strong> and the <strong>Meta pixel</strong> (Facebook and Instagram): to measure whether our ads work and to show you relevant ads",
      "<strong>Hotjar</strong> and <strong>Microsoft Clarity</strong>: to see how visitors click and scroll, so we can fix problems on the website",
    ]],
    ["p", "On your first visit, we ask for your consent through the cookie notice. You can always change your choice or withdraw your consent. You can also delete or block cookies in your browser settings."],
    ["h2", "Data outside the European Union"],
    ["p", "Some parties, such as Google, Meta and Microsoft, may also process data in the United States. This only happens with appropriate safeguards in place, such as the EU-US Data Privacy Framework or the European Commission's standard contractual clauses."],
    ["h2", "How long do we keep your data?"],
    ["p", "We do not keep your data longer than necessary:"],
    ["ul", [
      "<strong>Orders and invoices</strong>: 7 years, as required by Dutch tax law",
      "<strong>Your account</strong>: until you close your account; we then keep the order details for as long as the tax retention obligation applies",
      "<strong>36 Cycling Circle and newsletter</strong>: until you unsubscribe or end your membership",
      "<strong>Contact and quote requests</strong>: for as long as needed to handle your request; if it leads to an order, 7 years, as with orders, and otherwise no longer than 2 years after our last contact",
      "<strong>Cookies</strong>: for the period stated in the cookie notice",
    ]],
    ["h2", "How do we protect your data?"],
    ["p", "We take appropriate technical and organisational measures to protect your data against loss and unlawful use. The website uses a secure connection (https), only authorised staff have access to your data and we keep our systems up to date. If you think your data is not properly secured or is being misused, please contact us at " + mail + "."],
    ["h2", "Your rights"],
    ["p", "You have the right to:"],
    ["ul", [
      "access your data",
      "have incorrect data corrected",
      "have your data deleted, unless we are legally required to keep it",
      "restrict the processing of your data",
      "receive your data in a common file format or have it transferred to another party",
      "object to the use of your data, for example for direct marketing",
      "withdraw your consent at any time",
    ]],
    ["p", "Send your request to " + mail + ". We will respond as soon as possible, and within one month at the latest. To make sure the request comes from you, we may ask you to verify your identity."],
    ["h2", "Filing a complaint"],
    ["p", "Not happy with how we handle your data? Please let us know and we will work with you to find a solution. You also always have the right to file a complaint with the Dutch Data Protection Authority, the " + ext("https://autoriteitpersoonsgegevens.nl/en", "Autoriteit Persoonsgegevens") + "."],
    ["h2", "Changes"],
    ["p", "We may update this privacy policy, for example when we start using a new service. The latest version is always available on this page. See also our <a href=\"/en/terms-and-conditions/\">terms and conditions</a>."],
    ["p", "<em>Last updated: 16 October 2026</em>"],
  ],
};

const render = (doc) => [
  breadcrumbs(),
  H(doc.title, 1, "x-large"),
  ...doc.body.map(([t, v]) => (t === "p" ? paragraph(v) : t === "ul" ? list(v) : H(v, t === "h3" ? 3 : 2, t === "h3" ? "medium" : undefined))),
].join("\n\n");

const nlContent = render(NL), enContent = render(EN);
// Anker-links moeten naar bestaande koppen wijzen.
for (const c of [nlContent, enContent]) for (const [, a] of c.matchAll(/href="#([^"]+)"/g)) if (!c.includes(`id="${a}"`)) throw new Error(`Anker #${a} bestaat niet`);
const words = (c) => c.replace(/<!--[\s\S]*?-->|<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
console.log(`NL ${words(nlContent)} woorden | EN ${words(enContent)} woorden`);
if (DRY) process.exit(0);

const cfg = await loadConfig();
const auth = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const state = JSON.parse(await readFile(STATE, "utf8"));
const meta = (d) => ({ _yoast_wpseo_title: d.seo.title, _yoast_wpseo_metadesc: d.seo.desc });
const nl = await upsertPage(cfg, { id: state.privacy?.id, title: NL.title, slug: "privacy", content: nlContent, lang: "nl", meta: meta(NL) });
const en = await upsertPage(cfg, { id: state["privacy-en"]?.id, title: EN.title, slug: "privacy", content: enContent, lang: "en", meta: meta(EN) });
const link = await fetch(`${cfg.wp.baseUrl}/wp-json/c36/v1/link`, {
  method: "POST", headers: auth,
  body: JSON.stringify({ element_type: "post_page", source_id: nl.id, translation_id: en.id, lang: "en", source_lang: "nl" }),
});
if (!link.ok) throw new Error(`Koppelen mislukt (${link.status}): ${await link.text()}`);
state.privacy = { id: nl.id, link: nl.link };
state["privacy-en"] = { id: en.id, link: en.link };
await writeFile(STATE, JSON.stringify(state, null, 2));
console.log(`NL ${nl.id} ${nl.status} ${nl.link}\nEN ${en.id} ${en.status} ${en.link}\nWPML:`, JSON.stringify((await link.json()).translations));
