// Artikel (Stories) "Kleurverschil bij nabestellen" — eerste van de antwoord-artikelen n.a.v. de GEO-audit van Dashboa (23 nov 2026).
// Maakt of werkt het NL-bericht bij als CONCEPT (Jeroen publiceert). Gebruik: node scripts/build-artikel-kleurverschil.mjs [--id=<postId>]
// Opbouw voor AI en zoekmachines: direct antwoord bovenaan, tussenkoppen als vraag, korte lijsten, interne links.
// Alleen feiten die al op de site staan over 36 Cycling (ontwerp bewaard, Pantone/HEX/RGB, kleurstalen, kleurproef op verzoek, sublimatie, clubwebshop).
import { loadConfig, upsertPost } from "../lib/wp.mjs";

const p = (t) => `<!-- wp:paragraph -->\n<p>${t}</p>\n<!-- /wp:paragraph -->`;
const h2 = (t) => `<!-- wp:heading -->\n<h2 class="wp-block-heading">${t}</h2>\n<!-- /wp:heading -->`;
const ul = (items) => `<!-- wp:list -->\n<ul class="wp-block-list">${items.map((i) => `<!-- wp:list-item -->\n<li>${i}</li>\n<!-- /wp:list-item -->`).join("\n")}</ul>\n<!-- /wp:list -->`;
const ol = (items) => `<!-- wp:list {"ordered":true} -->\n<ol class="wp-block-list">${items.map((i) => `<!-- wp:list-item -->\n<li>${i}</li>\n<!-- /wp:list-item -->`).join("\n")}</ol>\n<!-- /wp:list -->`;

const NL = {
  title: "Kleurverschil bij nabestellen van wielerkleding: zo voorkom je het",
  slug: "kleurverschil-nabestellen",
  meta: {
    _yoast_wpseo_title: "Kleurverschil bij nabestellen wielerkleding voorkomen",
    _yoast_wpseo_metadesc: "Nabestelde wielershirts net iets anders van kleur? Zo ontstaat kleurverschil en zo voorkom je het: kleurcodes, dezelfde stof, een referentieshirt en slim bestellen.",
    _yoast_wpseo_focuskw: "kleurverschil nabestellen",
  },
  content: [
    p("<strong>Kleurverschil bij het nabestellen van bedrukte wielerkleding voorkom je door zo weinig mogelijk te veranderen: dezelfde kleurcodes, hetzelfde ontwerpbestand, dezelfde stof en dezelfde leverancier.</strong> Een heel klein verschil tussen twee productierondes is bij textieldruk normaal. Een zichtbaar ander blauw in de groep hoeft niet."),
    p("Het gebeurt vaak bij clubs en bedrijfsteams: een jaar na de eerste bestelling komen er nieuwe leden bij, je bestelt een paar shirts na en in de groep vallen ze net op. Hieronder lees je waar dat verschil vandaan komt en wat je eraan kunt doen."),
    h2("Waarom kleuren bij een nabestelling kunnen verschillen"),
    ul([
      "<strong>Een andere stof.</strong> Dezelfde kleur ziet er op shirtstof anders uit dan op het stevigere materiaal van een wielerbroek of op mesh. Hoe meer elastaan een stof bevat, hoe minder fel een gedrukte kleur wordt.",
      "<strong>Een nieuwe productieronde.</strong> Inkt, printerinstellingen en de temperatuur van de pers zijn bij elke ronde net iets anders. Meestal zie je dat niet, bij grote egale vlakken in een felle of donkere kleur soms wel.",
      "<strong>Een andere leverancier.</strong> Een andere drukker werkt met andere inkt, andere stoffen en andere instellingen. Dat geeft de grootste kans op een zichtbaar verschil.",
      "<strong>Kleuren op een scherm.</strong> Een scherm toont licht, een print is inkt op stof. Vooral fluo, felgroen, oranje en paars zien er op stof vaak anders uit dan op je scherm.",
      "<strong>Het oude tenue is veranderd.</strong> Kleding die vaak gewassen is en veel in de zon heeft gehangen, verbleekt een beetje. Dan lijkt het nieuwe shirt anders, terwijl juist het oude veranderd is. Met de juiste was blijven kleuren langer mooi, zie <a href=\"/nl/stories/wielerkleding-wassen/\">wielerkleding wassen</a>.",
    ]),
    h2("Zo voorkom je kleurverschil"),
    ol([
      "<strong>Leg je kleuren vast met codes.</strong> Geef je huisstijlkleuren door als Pantone-, HEX- of RGB-code. \"Ons clubblauw\" laat te veel ruimte. Bewaar de codes bij je ontwerp.",
      "<strong>Bestel bij dezelfde leverancier, met hetzelfde ontwerp.</strong> Dan wordt hetzelfde bestand opnieuw gebruikt en hoeft niemand je kleuren opnieuw te zoeken.",
      "<strong>Kies hetzelfde model en dezelfde stof.</strong> Een ander shirtmodel of een andere kwaliteit betekent vaak een andere stof, en dus een iets andere kleur. Wil je overstappen, doe dat dan voor het hele team tegelijk.",
      "<strong>Bewaar een ongedragen referentieshirt.</strong> Leg één exemplaar uit de eerste levering apart, uit de zon. Daarmee vergelijk je een nieuwe levering eerlijk.",
      "<strong>Bestel zoveel mogelijk in één keer.</strong> Hoe minder losse productierondes, hoe kleiner de kans op verschil. Bestel bij de eerste ronde een paar extra shirts in veelgevraagde maten, voor nieuwe leden. Heeft je club vaak nabestellingen, dan werkt een eigen webshop goed: leden bestellen zelf en de bestellingen worden samen gemaakt.",
      "<strong>Vraag een kleurproef als je twijfelt.</strong> Een proef op de echte stof laat zien hoe je kleur er in het echt uitziet, voordat de hele bestelling gemaakt wordt.",
      "<strong>Houd er in je ontwerp rekening mee.</strong> Laat één egale kleur niet doorlopen van shirt naar broek of van stof naar mesh: daar valt een klein verschil het meest op. Een contrastkleur op de overgang, of een zwarte broek met een accentkleur uit het shirt, maakt je tenue minder gevoelig.",
    ]),
    h2("Is een klein kleurverschil normaal?"),
    p("Ja. Bij elke vorm van textieldruk zit er tussen twee productierondes een kleine marge. In een rijdende groep zie je dat niet. Valt het verschil wel op, meld het dan meteen na de levering, met een foto bij daglicht waarop het oude en het nieuwe shirt naast elkaar liggen."),
    h2("Hoe we dit bij 36 Cycling aanpakken"),
    ul([
      "We bewaren jullie ontwerp. Ook als je jaren later nabestelt, kan dat, en de eenmalige opstartkosten komen dan niet terug.",
      "We werken met jullie Pantone-, HEX- of RGB-codes.",
      "Vooraf krijg je kleurstalen, en op verzoek maken we eerst een kleurproef.",
      "We bedrukken met sublimatie: de inkt zit in de stof zelf. De print barst of bladdert niet en de kleuren blijven helder, ook na veel wasbeurten.",
      "Voor clubs en bedrijven openen we een eigen webshop. Wij bundelen de bestellingen en laten ze samen maken.",
    ]),
    p("Lees meer over <a href=\"/nl/wielerkleding-bedrukken/\">wielerkleding bedrukken</a> en <a href=\"/nl/custom-teamwear/\">teamkleding met een eigen clubwebshop</a>, of bekijk de <a href=\"/nl/veelgestelde-vragen/\">veelgestelde vragen</a>. Wil je nabestellen of een nieuw tenue laten maken? <a href=\"/nl/offerteaanvraag/\">Vraag een offerte aan</a>."),
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
