// Bespoke build: custom-teamwear landingspagina.
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, blocks } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";

const OLD = "https://www.36cycling.com";
const root = new URL("..", import.meta.url);
const cfg = await loadConfig();
const map = await loadMediaMap();
const state = JSON.parse(await readFile(new URL("state.json", root), "utf8"));
const { heading, paragraph, image, buttons, column, columns, breadcrumbs } = blocks;

const media = async (src, alt) => ensureMedia(cfg, map, { src: src.startsWith("http") ? src : OLD + src, alt });
const headingLink = (text, href, level = 2) =>
  `<!-- wp:heading {"level":${level}} -->\n<h${level} class="wp-block-heading"><a href="${href}">${text}</a></h${level}>\n<!-- /wp:heading -->`;

// Afbeeldingen (met alt; big buttons hadden geen alt → nu wel).
const btnWieler = await media("/media/cwsklqis/bigbutton-wielerkleding.jpg", "Wielerkleding bedrukken");
const btnSport = await media("/media/ejidlnpb/bigbutton-sportkleding.jpg", "Sportkleding bedrukken");
const design = await media("/media/54hej1ut/design-36.jpg", "Fietskleding ontwerpen en bedrukken");
const teamcol = await media("/media/j55llm4w/wielerkleding-teamcollectie-v2.png", "Teamkleding collectie");
const steps = [
  { img: await media("/fotos/step1-wielerkleding.png", "Advies over je wielerkleding"), txt: 'Stel je vragen. We nemen snel contact met je op om je van de eerste antwoorden te voorzien.<br><a href="/nl/contact/">Contactformulier</a>' },
  { img: await media("/fotos/step2-wielerkleding.png", "Offerte sportkleding in eigen ontwerp"), txt: "We maken een offerte aan de hand van je wensen en aantallen. Middels voorbeelden, samples en gesprekken helpen we je hier graag bij." },
  { img: await media("/fotos/step3-wielerkleding.png", "Fietsshirt ontwerpen"), txt: "Samen komen we tot het ontwerp dat je voor ogen hebt." },
  { img: await media("/fotos/step4-wielerkleding.png", "Maten van sportkleding bepalen"), txt: 'Aan de hand van paskleding (die we toesturen) of eventueel een maattabel bepaal je zelf de maten.<br><a rel="noopener" href="/downloads/36_maattabel.pdf" target="_blank">Maattabel openen</a>' },
  { img: await media("/fotos/step5-wielerkleding.png", "Wielerkleding bestellen"), txt: "Je ontvangt een overzicht van producten, maten en het definitieve design. Na goedkeuring is de bestelling definitief." },
  { img: await media("/fotos/step6-wielerkleding.png", "Wielershirts produceren en leveren"), txt: "We geven je in eerder stadium al aan wat de leverdatum gaat worden. Meestal ligt dit rond de 5/6 weken." },
];

const content = [
  breadcrumbs(),
  heading("Wielershirt bedrukken & wielerkleding ontwerpen", 1, { size: "x-large" }),
  // Twee grote knoppen naar de bedruk-pagina's.
  columns([
    column([image(btnWieler, "/nl/wielerkleding-bedrukken/"), headingLink("Wielerkleding", "/nl/wielerkleding-bedrukken/")].join("\n\n")),
    column([image(btnSport, "/nl/sportkleding-bedrukken/"), headingLink("Sportkleding", "/nl/sportkleding-bedrukken/")].join("\n\n")),
  ]),
  // Fietskleding ontwerpen (foto) + Werkwijze (tekst + knoppen).
  columns([
    column([heading("Fietskleding ontwerpen", 2), image(design)].join("\n\n")),
    column([
      heading("Werkwijze", 2),
      paragraph("Wielerkleding speelt een belangrijke rol bij de fietservaring. Hetzelfde geldt voor alle sportkleding. De juiste keuze van materialen, het draagcomfort en de uitstraling maken sporten een stuk aangenamer. We maken professionele kwaliteit voor iedereen toegankelijk. En in uw <strong>eigen huisstijl</strong>. Wil je je eigen ontwerp maken of laat je het liever aan ons over. We adviseren je altijd."),
      buttons([
        { text: "Ontwerp", href: "/nl/wielerkleding-ontwerpen/" },
        { text: "Assortiment", href: "/nl/teamkleding-collectie/" },
        { text: "Offerte", href: "/nl/offerteaanvraag/" },
      ]),
    ].join("\n\n")),
  ]),
  // Stappenplan (6 stappen).
  paragraph("Jouw sportkleding of fietskleding in een paar stappen:"),
  columns(steps.map((s) => column([image(s.img), paragraph(s.txt)].join("\n\n")))),
  // Teamwear Collecties.
  columns([
    column([
      heading("Teamwear Collecties", 2),
      paragraph("36 heeft een aantal collecties ontwikkeld gebaseerd op de behoeften van verschillende type sporters. Elke lijn is vervaardigd uit de beste materialen. Alle items kunnen gepersonaliseerd worden en in je eigen ontwerp worden gedrukt. We adviseren je uiteraard met plezier in elke stap van het proces."),
      paragraph('<a href="/nl/teamkleding-collectie/">Bekijk de collectie</a>'),
    ].join("\n\n")),
    column(image(teamcol, "/nl/teamkleding-collectie/")),
  ]),
].join("\n\n");

const res = await upsertPage(cfg, {
  id: state["custom-teamwear"]?.id,
  title: "Custom Teamwear", slug: "custom-teamwear", content, status: "draft", lang: "nl",
  meta: {
    _yoast_wpseo_title: "Wielershirt Bedrukken & Wielerkleding Ontwerpen | 36 Cycling",
    _yoast_wpseo_metadesc: "Wielershirt bedrukken of wielerkleding ontwerpen? Bij 36 Cycling ontwerp je custom teamkleding met onze 3D tool. Vanaf 1 stuk, levering in 3-4 weken. Vraag gratis offerte aan.",
  },
});
state["custom-teamwear"] = { id: res.id, link: res.link };
await writeFile(new URL("state.json", root), JSON.stringify(state, null, 2));

const csv = await readFile(new URL("redirects.csv", root), "utf8");
const line = `${OLD}/nl/custom-teamwear/,https://rondevanrotterdam.nl/nl/custom-teamwear/,draft`;
if (!csv.includes("custom-teamwear")) await writeFile(new URL("redirects.csv", root), csv + line + "\n");

console.log(`Custom-teamwear OK → id ${res.id} | ${steps.length} stappen + 2 knoppen + collectie-blok | status ${res.status}`);
