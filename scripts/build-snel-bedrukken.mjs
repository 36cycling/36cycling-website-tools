// /nl/snel-wielershirt-bedrukken/ — teksten verbatim van de oude pagina, H2's voor structuur.
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, blocks } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";

const OLD = "https://www.36cycling.com";
const root = new URL("..", import.meta.url);
const cfg = await loadConfig();
const map = await loadMediaMap();
const state = JSON.parse(await readFile(new URL("state.json", root), "utf8"));
const { heading, paragraph, list, image, buttons, column, columns, breadcrumbs } = blocks;
const img = (p, alt) => ensureMedia(cfg, map, { src: `${OLD}/media/${p}`, alt, updateAlt: true });

const j1 = await img("eofhcf5d/bluejersey1.jpg", "Wielrenner in een donkerblauw wielershirt met eigen logo");
const j2 = await img("0idnx2tl/bluejersey2.jpg", "Achterkant van een donkerblauw wielershirt met bedrukte tekst");
const j3 = await img("hkacsd35/bluejersey3.jpg", "Wielrenners in donkerblauwe wielershirts met logo op de borst");

const content = [
  breadcrumbs(),
  heading("Wielershirt bedrukken vanaf 1 stuk", 1, { size: "x-large" }),
  columns([
    column(image(j1)),
    column([
      paragraph("Wil je snel en in kleine oplage wielershirts laten bedrukken? Dan hebben wij een oplossing voor je: we hebben een shirt in veel maten op voorraad en kunnen het direct bedrukken met jouw logo of tekst. Daardoor kunnen we het erg snel leveren."),
      paragraph("Zie de foto's op deze pagina als voorbeeld."),
    ].join("\n\n")),
  ]),
  heading("Waarom niet volledig bedrukt?", 2),
  columns([
    column([
      paragraph("Het bedrukken van wielerkleding in een volledig customized ontwerp is een tijdrovend proces. Er moeten veel stappen doorlopen worden om via sublimatiedruk een wielershirt te maken. Om deze reden is het vaak te kostbaar om het in lage aantallen aan te bieden. Het proces duurt bovendien tussen de 4 en 6 weken."),
      paragraph("Om toch snel met je eigen logo of tekst een wielershirt te maken bieden we dit standaard shirt aan, waarop je je logo's kunt laten drukken."),
      paragraph('Liever een volledig eigen ontwerp? Lees meer over <a href="/nl/wielerkleding-bedrukken/">wielerkleding bedrukken</a>.'),
    ].join("\n\n")),
    column(image(j2)),
  ]),
  heading("Hoe werkt het?", 2),
  columns([
    column(image(j3)),
    column([
      list([
        "Prijs: € 89 per stuk",
        "Mogelijk vanaf 1 stuk",
        "Levertijd: binnen enkele dagen nadat we logo (of tekst) hebben ontvangen",
        "Kleur: donkerblauw (momenteel de enige optie)",
        "Meestal wordt er gekozen voor bedrukking op de borst en rug",
        "Maten: XS - 4 XL (unisex)",
        "Het valt normaal voor een wielershirt (draagt dus strak!)",
        "Twijfel je over je maat? Neem een maat groter.",
      ]),
      paragraph("Het shirt is van een mooie kwaliteit en is gemaakt van ademende materialen en 4-way stretch lycra mouwen en draagt daardoor erg comfortabel."),
    ].join("\n\n")),
  ]),
  heading("Snel starten?", 2),
  paragraph("Dat kan! Stuur ons je maten en je logo's in 'vector' formaat, dus: EPS, PDF, AI bijvoorbeeld."),
  paragraph("We maken een voorstel en laten je een 3D schets zien. Als dit akkoord is, hebben we alleen nog je maten en aantallen nodig."),
  buttons([{ text: "Offerte aanvragen", href: "/nl/offerteaanvraag/" }, { text: "Neem contact op", href: "/nl/contact/" }]),
  heading("Ook een broek nodig?", 2),
  paragraph("Dat kan ook. Ook deze hebben we op voorraad in de kleur zwart."),
].join("\n\n");

const res = await upsertPage(cfg, {
  id: state["snel-wielershirt-bedrukken"]?.id,
  title: "Wielershirt bedrukken vanaf 1 stuk", slug: "snel-wielershirt-bedrukken", content, lang: "nl",
  meta: {
    _yoast_wpseo_title: "Wielerkleding in lage aantallen bedrukken",
    _yoast_wpseo_metadesc: "Wielershirt in enkele stuks of zelfs maar 1 stuk laten bedrukken? Ons standaard wielershirt bedrukken we snel met jouw logo of tekst.",
    _yoast_wpseo_focuskw: "wielershirt bedrukken vanaf 1 stuk",
  },
});
state["snel-wielershirt-bedrukken"] = { id: res.id, link: res.link };
await writeFile(new URL("state.json", root), JSON.stringify(state, null, 2));
console.log(`snel-wielershirt-bedrukken → id ${res.id} | ${res.status} | ${res.link}`);
