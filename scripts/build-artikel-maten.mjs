// Artikel (Stories) "Hoe we zorgen dat iedereen in je ploeg de juiste maat heeft" — tweede antwoord-artikel n.a.v. de GEO-audit van Dashboa (25 nov 2026).
// Maakt of werkt het NL-bericht bij als CONCEPT (Jeroen publiceert). Gebruik: node scripts/build-artikel-maten.mjs [--id=<postId>]
// LET OP: heeft Jeroen het concept in de editor bewerkt, dan is de site leidend; dit script dan niet meer draaien op dat id.
// Werkwijze 36 Cycling volgens Jeroen (25 nov): paskleding gratis toegestuurd, team past kort en stuurt terug; maten verzamelen via een maatlijst
// van de contactpersoon of via een eigen clubwebshop; verkeerde maat na levering = nabestellen in de goede maat (maatwerk is niet ruilbaar,
// kleine aantallen kunnen). Uit de FAQ: Nederlandse pasvorm, valt niet klein; twijfel = grotere maat; meeste shirts t/m 3XL, deel 4XL/5XL;
// levertijd 3–5 weken na goedkeuring ontwerp; ontwerp blijft bewaard.
import { loadConfig, upsertPost } from "../lib/wp.mjs";

const p = (t) => `<!-- wp:paragraph -->\n<p>${t}</p>\n<!-- /wp:paragraph -->`;
const h2 = (t) => `<!-- wp:heading -->\n<h2 class="wp-block-heading">${t}</h2>\n<!-- /wp:heading -->`;
const ul = (items) => `<!-- wp:list -->\n<ul class="wp-block-list">${items.map((i) => `<!-- wp:list-item -->\n<li>${i}</li>\n<!-- /wp:list-item -->`).join("\n")}</ul>\n<!-- /wp:list -->`;
const ol = (items) => `<!-- wp:list {"ordered":true} -->\n<ol class="wp-block-list">${items.map((i) => `<!-- wp:list-item -->\n<li>${i}</li>\n<!-- /wp:list-item -->`).join("\n")}</ol>\n<!-- /wp:list -->`;

const NL = {
  title: "Hoe we zorgen dat iedereen in je ploeg de juiste maat heeft",
  slug: "maten-teamkleding-grote-ploeg",
  meta: {
    _yoast_wpseo_title: "Juiste maat wielerkleding voor een grote ploeg",
    _yoast_wpseo_metadesc: "Wielerkleding bestellen voor een club of bedrijfsteam? Zo zorgen we dat iedereen de juiste maat heeft: gratis paskleding, een maatlijst of clubwebshop en de maatwijzer.",
    _yoast_wpseo_focuskw: "maten teamkleding",
  },
  content: [
    p("<strong>Bij een grote ploeg wil je dat iedereen in één keer de juiste maat heeft. Daarom sturen we je team gratis onze paskleding toe: iedereen past zelf, jullie sturen de set terug en geven de maten door. Lukt passen niet, dan helpt onze maatwijzer. De maten verzamel je met een maatlijst of laat je leden zelf bestellen in een eigen clubwebshop.</strong>"),
    p("Bestel je wielerkleding in eigen ontwerp voor een club of bedrijfsteam, dan gaat het al snel om tientallen mensen. Lang en kort, slank en breed, heren en dames. Kleding in eigen ontwerp maken we speciaal voor jullie, dus ruilen kan niet. Hieronder lees je hoe we ervoor zorgen dat iedereen meteen de goede maat heeft."),
    h2("Waarom maten bij teamkleding lastig zijn"),
    ul([
      "<strong>Wielerkleding zit strak.</strong> Een shirt dat wappert, vangt wind en schuurt. Daardoor is het verschil tussen twee maten groter dan bij gewone kleding.",
      "<strong>Elk merk valt anders.</strong> Wie gewend is aan een Italiaans merk, heeft bij ons vaak een maat kleiner nodig. Onze maten zijn afgestemd op een Nederlandse pasvorm en vallen niet klein.",
      "<strong>Elk product valt anders.</strong> Een shirt, een jack en een broek met zeem hebben elk hun eigen pasvorm. Je maat in het ene product zegt niet alles over het andere.",
      "<strong>Iedereen schat zichzelf anders in.</strong> De een kiest altijd M, de ander wil het juist ruim. Zonder passen wordt het gokken.",
    ]),
    h2("Zo zorgen wij voor de juiste maten"),
    ol([
      "<strong>Gratis paskleding.</strong> We sturen jullie kosteloos een set paskleding in alle maten van de producten die jullie bestellen. Iedereen past in alle rust, thuis of op de club.",
      "<strong>Kort lenen, terugsturen.</strong> Na een week of twee sturen jullie de paskleding terug en geef je de maten door.",
      "<strong>De maatwijzer als hulp.</strong> Kan iemand niet passen? Met de <a href=\"/nl/maatwijzer/\">maatwijzer</a> vindt hij of zij snel de juiste maat, op basis van lengte, gewicht, lichaamsbouw en hoe iemand zijn kleding het liefst draagt. Het advies is gebaseerd op wat ruim 200 klanten van ons echt dragen.",
      "<strong>We kijken mee.</strong> Valt een maat ons op, bijvoorbeeld een heel kleine maat bij een lange renner, dan vragen we het even na voordat we gaan maken.",
      "<strong>Pas daarna maken.</strong> Kloppen het ontwerp en de maten, dan maken we de kleding. Dat duurt 3 tot 5 weken na de goedkeuring van het ontwerp.",
    ]),
    h2("Hoe verzamel je de maten van een grote ploeg?"),
    p("Er zijn twee manieren, en je kiest wat het beste bij jullie past:"),
    ul([
      "<strong>Een maatlijst.</strong> Eén contactpersoon houdt een lijst bij met per persoon de naam, het product en de maat, en stuurt die naar ons. Handig bij een bedrijfsteam of een ploeg die alles samen bestelt en betaalt.",
      "<strong>Een eigen clubwebshop.</strong> Leden bestellen zelf hun kleding in hun eigen maat, betalen zelf en krijgen alles thuisgestuurd. Wij bundelen de bestellingen en laten ze samen maken. Dat scheelt de contactpersoon veel werk, en ook nieuwe leden kunnen later makkelijk bestellen. Lees meer over <a href=\"/nl/custom-teamwear/\">teamkleding en clubwebshops</a>.",
    ]),
    h2("Welke maat kies je als je twijfelt?"),
    p("Twijfel je tussen twee maten, neem dan de grotere. Onze wielershirts vallen normaal voor wielerkleding, dus strak, maar niet klein. De meeste shirts zijn er tot en met 3XL, een deel ook in 4XL of 5XL."),
    h2("En als iemand na de levering toch de verkeerde maat heeft?"),
    p("Kleding in eigen ontwerp maken we speciaal voor jullie, dus ruilen is niet mogelijk. Wel kun je de juiste maat nabestellen, ook als het om een paar stuks gaat. We bewaren jullie ontwerp, dus de eenmalige opstartkosten komen niet terug. Hoe we ervoor zorgen dat een nabestelling dezelfde kleur heeft, lees je in <a href=\"/nl/stories/kleurverschil-nabestellen/\">Hoe we kleurverschil voorkomen bij nabestellen</a>."),
    h2("Tips voor de contactpersoon"),
    ul([
      "<strong>Plan een pasmoment.</strong> Laat de paskleding op een vaste avond of na een clubrit passen. Dan is iedereen er en heb je de maten in één keer binnen.",
      "<strong>Pas wat je bestelt.</strong> Gaan jullie ook een jack of een lange broek bestellen, pas die dan ook. De maat van het shirt zegt niet alles.",
      "<strong>Pas in fietshouding.</strong> Buig even voorover alsof je op de fiets zit. Een shirt mag strak zitten, maar mag niet trekken over je rug of bij je schouders.",
      "<strong>Bestel een paar extra.</strong> Neem een paar shirts extra in veelgevraagde maten, voor nieuwe leden of iemand die een maat wil wisselen.",
      "<strong>Zet de lijst in één bestand.</strong> Eén lijst met naam, product en maat voorkomt vergissingen. Bij een clubwebshop hoeft dat niet: daar staat alles al per bestelling.",
    ]),
    p("Meer antwoorden vind je bij de <a href=\"/nl/veelgestelde-vragen/\">veelgestelde vragen</a>. Wil je paskleding voor je team of een prijs voor jullie tenue? <a href=\"/nl/offerteaanvraag/\">Vraag een offerte aan</a>."),
  ].join("\n\n"),
};

const cfg = await loadConfig();
const idArg = process.argv.find((a) => a.startsWith("--id="));
const post = await upsertPost(cfg, {
  id: idArg ? Number(idArg.slice(5)) : undefined,
  title: NL.title, slug: NL.slug, content: NL.content, status: "draft",
  meta: NL.meta, lang: "nl", categories: [36],
});
console.log("NL-concept:", post.id, post.status, post.link);
