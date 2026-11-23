// Artikel (Stories) "Hoe we kleurverschil voorkomen bij nabestellen" — eerste van de antwoord-artikelen n.a.v. de GEO-audit van Dashboa (23 nov 2026).
// Maakt of werkt het NL-bericht bij als CONCEPT (Jeroen publiceert). Gebruik: node scripts/build-artikel-kleurverschil.mjs [--id=<postId>]  (NL-concept: 10165)
// Opbouw voor AI en zoekmachines: direct antwoord bovenaan, tussenkoppen als vraag, korte lijsten, interne links.
// Werkwijze 36 Cycling volgens Jeroen (23 nov): eigen fabriek; dezelfde printers, inkten en afstellingen; bij kleine veranderingen opnieuw ijken;
// Pantone zo nauwkeurig mogelijk matchen of matchen op een vorig kledingstuk (klant stuurt het op, kan van een andere leverancier zijn);
// proefkleuren bij twijfel of op verzoek; stof meestal dezelfde, niet gegarandeerd. Land van de fabriek alleen noemen als iemand ernaar vraagt.
import { loadConfig, upsertPost } from "../lib/wp.mjs";

const p = (t) => `<!-- wp:paragraph -->\n<p>${t}</p>\n<!-- /wp:paragraph -->`;
const h2 = (t) => `<!-- wp:heading -->\n<h2 class="wp-block-heading">${t}</h2>\n<!-- /wp:heading -->`;
const ul = (items) => `<!-- wp:list -->\n<ul class="wp-block-list">${items.map((i) => `<!-- wp:list-item -->\n<li>${i}</li>\n<!-- /wp:list-item -->`).join("\n")}</ul>\n<!-- /wp:list -->`;

const NL = {
  title: "Hoe we kleurverschil voorkomen bij nabestellen van wielerkleding",
  slug: "kleurverschil-nabestellen",
  meta: {
    _yoast_wpseo_title: "Hoe we kleurverschil voorkomen bij nabestellen",
    _yoast_wpseo_metadesc: "Nabestelde wielershirts moeten dezelfde kleur hebben als de vorige. Zo doen we dat: dezelfde printers en inkten, opnieuw ijken, Pantone matchen en proefkleuren.",
    _yoast_wpseo_focuskw: "kleurverschil nabestellen",
  },
  content: [
    p("<strong>Bij een nabestelling moeten je nieuwe shirts dezelfde kleur hebben als de vorige. Daarom drukken we in onze eigen fabriek met dezelfde printers, dezelfde inkten en dezelfde afstellingen. Verandert er iets in het proces, dan ijken we opnieuw. Je kleuren matchen we zo nauwkeurig mogelijk op de Pantone-code of op een kledingstuk uit je vorige bestelling, en bij twijfel maken we eerst proefkleuren.</strong>"),
    p("Het speelt vooral bij clubs en bedrijfsteams. Een jaar na de eerste bestelling komen er nieuwe leden bij en bestel je een paar shirts na. Die moeten in de groep niet opvallen. Hieronder lees je waar kleurverschil vandaan komt, hoe wij het voorkomen en wat je zelf kunt doen."),
    h2("Waarom kleuren bij een nabestelling kunnen verschillen"),
    p("Een gedrukte kleur is het resultaat van veel factoren tegelijk. Verandert er één, dan kan de kleur net anders uitvallen:"),
    ul([
      "<strong>Printer, inkt en afstelling.</strong> Een andere printer, een andere inkt of een iets andere instelling geeft een andere kleur, ook met hetzelfde ontwerpbestand.",
      "<strong>De stof.</strong> Dezelfde kleur ziet er op shirtstof anders uit dan op het stevigere materiaal van een wielerbroek of op mesh. Hoe meer elastaan een stof bevat, hoe minder fel een gedrukte kleur wordt.",
      "<strong>Scherm en stof.</strong> Een scherm toont licht, een print is inkt op stof. Vooral fluo, felgroen, oranje en paars zien er op stof vaak anders uit dan op een scherm.",
      "<strong>Een andere leverancier.</strong> Wie overstapt, krijgt andere printers, inkten en stoffen. Zonder goede kleurmatch geeft dat de grootste kans op verschil.",
      "<strong>Het oude tenue is veranderd.</strong> Kleding die vaak gewassen is en in de zon heeft gehangen, verbleekt een beetje. Dan lijkt het nieuwe shirt anders, terwijl juist het oude veranderd is.",
    ]),
    h2("Zo voorkomen wij kleurverschil"),
    ul([
      "<strong>Eigen fabriek, vaste opstelling.</strong> We drukken met dezelfde printers, dezelfde inkten en dezelfde afstellingen. Zo komt een nabestelling uit hetzelfde proces als de eerste bestelling.",
      "<strong>Opnieuw ijken bij elke verandering.</strong> Verandert er iets in het proces, hoe klein ook, dan ijken we de printers opnieuw voordat we verder drukken.",
      "<strong>Pantone zo nauwkeurig mogelijk matchen.</strong> We werken met jullie Pantone-, HEX- of RGB-codes en stemmen de gedrukte kleur zo precies mogelijk af op de Pantone-kleur.",
      "<strong>Matchen op een vorig kledingstuk.</strong> Heb je geen kleurcode, of moet het passen bij kleding die je al hebt? Stuur ons een kledingstuk uit je vorige bestelling, dan matchen we daarop. Dat kan ook als die kleding van een andere leverancier komt.",
      "<strong>Proefkleuren bij twijfel.</strong> Is een kleur lastig, of wil je zekerheid, dan maken we eerst proefkleuren op stof en leggen we die naast het origineel. Pas als de kleur klopt, maken we de hele bestelling.",
      "<strong>Je ontwerp blijft bewaard.</strong> We bewaren jullie ontwerp, ook als je jaren later nabestelt. Er wordt dus met hetzelfde bestand gedrukt, en de eenmalige opstartkosten komen niet terug.",
      "<strong>Zoveel mogelijk dezelfde stof.</strong> Bij een nabestelling kiezen we zoveel mogelijk dezelfde stof als bij de eerste bestelling.",
    ]),
    h2("Je kleding komt van een andere leverancier: kunnen jullie de kleuren namaken?"),
    p("Ja. Stuur ons een kledingstuk uit je huidige tenue, het liefst een dat weinig gedragen is. We matchen de kleuren daarop en maken bij twijfel eerst proefkleuren. Heb je ook de Pantone-codes van je huisstijl, geef die dan mee."),
    h2("Wat je zelf kunt doen"),
    ul([
      "<strong>Leg je kleuren vast met codes.</strong> \"Ons clubblauw\" laat te veel ruimte. Een Pantone-code niet.",
      "<strong>Bewaar een ongedragen referentieshirt.</strong> Leg één exemplaar uit de eerste levering apart, uit de zon. Daarmee kunnen we bij een nabestelling matchen en kun jij een nieuwe levering eerlijk vergelijken.",
      "<strong>Bestel zoveel mogelijk in één keer.</strong> Bestel bij de eerste ronde een paar extra shirts in veelgevraagde maten, voor nieuwe leden. Heeft je club vaak nabestellingen, dan werkt een <a href=\"/nl/custom-teamwear/\">eigen clubwebshop</a> goed: leden bestellen zelf en wij bundelen de bestellingen.",
      "<strong>Wissel van model met het hele team tegelijk.</strong> Een ander shirtmodel kan een andere stof hebben, en dus een iets andere kleur.",
      "<strong>Houd er in je ontwerp rekening mee.</strong> Een egale kleur die doorloopt van shirt naar broek, of van stof naar mesh, laat het kleinste verschil zien. Een contrastkleur op de overgang, of een zwarte broek met een accentkleur uit het shirt, is minder gevoelig.",
      "<strong>Was je kleding goed.</strong> Zo blijven de kleuren langer mooi en past een nabestelling beter bij wat je al hebt. Zie <a href=\"/nl/stories/wielerkleding-wassen/\">wielerkleding wassen</a>.",
    ]),
    h2("Is een klein kleurverschil normaal?"),
    p("Bij textieldruk zit er tussen twee productierondes altijd een kleine marge; met een vaste opstelling en opnieuw ijken houden we die zo klein mogelijk. In een rijdende groep zie je hem niet. Valt een verschil je toch op, laat het ons dan meteen na de levering weten, met een foto bij daglicht waarop het oude en het nieuwe kledingstuk naast elkaar liggen."),
    p("Lees meer over <a href=\"/nl/wielerkleding-bedrukken/\">wielerkleding bedrukken</a> of bekijk de <a href=\"/nl/veelgestelde-vragen/\">veelgestelde vragen</a>. Wil je nabestellen of een tenue laten namaken? <a href=\"/nl/offerteaanvraag/\">Vraag een offerte aan</a>."),
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
