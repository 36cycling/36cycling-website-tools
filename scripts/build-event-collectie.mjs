// Bespoke build: event-collectie (losse showcase-pagina, RIDE-lijn).
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, blocks } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";

const OLD = "https://www.36cycling.com";
const root = new URL("..", import.meta.url);
const cfg = await loadConfig();
const map = await loadMediaMap();
const state = JSON.parse(await readFile(new URL("state.json", root), "utf8"));
const { heading, paragraph, list, image, gridColumn, columns, breadcrumbs } = blocks;

// Verbatim overgenomen van de oude pagina.
const items = [
  { src: `${OLD}/fotos/wielershirt-ride.jpg`, alt: "wielershirt bedrukken met eigen ontwerp", naam: "WIELERSHIRT - RIDE", tekst: "Wielerhirt gemaakt van lichtgewicht Soft-Grid materiaal: goed ademend door de geperforeerde structuur. Met gel gripper en standaard met een lange blinde rits. Een heerlijk shirt wat voor vrijwel elke fietser geschikt is." },
  { src: `${OLD}/fotos/wielerbroek-ride.jpg`, alt: "wielerbroek bedrukken met je design", naam: "WIELERBROEK - RIDE", tekst: "Een professionele wielerbroek met flatlock, zeer comfortabele bretels en heerlijke pasvorm. Voorzien van een Elastic Interface zeem geschikt voor lange duurritten." },
  { src: `${OLD}/fotos/wielershirt-ride-pro.jpg`, alt: "wielershirt ontwerpen", naam: "WIELERSHIRT - RIDE PRO", tekst: "Een upgrade van het RIDE shirt met 4-way stretch mouwen, waardoor de pasvorm comfortabeler wordt en de uitstraling van het shirt strak en modern afgewerkt is. Een heerlijk shirt wat ook voor de veeleisende wielrenner geschikt is." },
  { src: `${OLD}/fotos/wielerjack-ride.jpg`, alt: "wielerjack ontwerpen en bedrukken", naam: "WIELERJACK - RIDE", tekst: "Een gevoerd jack voor de voorjaarsdagen of om je voor en na je rit warm te houden. Met 3 zakken en lange rits." },
  { src: `${OLD}/fotos/windjack-ride.jpg`, alt: "wielren windstopper bedrukken", naam: "WINDJACK - RIDE", tekst: "Een windjack met winddichte voorkant en mesh achterkant, zodat je via de achterkant je warmte kwijt kunt. Geen achterzakken. Met lange rits." },
  { src: `${OLD}/fotos/sportshirt-ride.jpg`, alt: "sportshirt bedrukken met je eigen ontwerp", naam: "SPORT/RUNNING", tekst: "Het technische sportshirt van Soft-Grid materiaal. Stevig, maar toch dun en ademend, waardoor het voor vrijwel alle sporten geschikt is: op het sportveld of om een marathon te lopen." },
];

// Afbeeldingen uploaden (met alt).
for (const it of items) it.media = await ensureMedia(cfg, map, { src: it.src, alt: it.alt });

// Grid: 3 per rij, met streepje-onderrand (geen knop/link — geen detailpagina).
const rows = [];
for (let i = 0; i < items.length; i += 3) {
  rows.push(columns(items.slice(i, i + 3).map((it) =>
    gridColumn([image(it.media), heading(it.naam, 4), paragraph(it.tekst)].join("\n\n")))));
}

const content = [
  breadcrumbs(),
  heading("Event collectie: custom wielerkleding", 1, { size: "x-large" }),
  paragraph("<strong>Event Collectie: RIDE</strong>"),
  paragraph("Onze RIDE collectie heeft dezelfde hoge kwaliteit die je van 36 kunt verwachten: lichtgewicht technische materialen, aangename pasvorm, een zeer comfortabele broek met een high-end zeem voor lange afstanden. En allemaal te ontwerpen en bedrukken."),
  paragraph("<strong>Waarin verschilt de RIDE lijn dan?</strong>"),
  paragraph("What you see is what you get: de Ride wielerkleding collectie heeft verder geen opties en daardoor kunnen we deze gunstig en eenvoudig aanbieden."),
  heading("Eigenschappen", 3, { size: "medium" }),
  list([
    "Shirt keuze: Standaard en Pro",
    "Eén pasvorm: unisex (wel onderscheid in dames/heren zeem)",
    "Minimale afname: 20 stuks",
    "Nabestellingen: vanaf 10 stuks",
    "Levertijd: 5/6 weken",
  ]),
  heading("Wielershirts", 2),
  ...rows,
].join("\n\n");

const res = await upsertPage(cfg, {
  id: state["event-collectie"]?.id,
  title: 'Event collectie', slug: "event-collectie", content, status: "draft", lang: "nl",
  meta: {
    _yoast_wpseo_title: 'Team Event wielerkleding collectie "Ride"',
    _yoast_wpseo_metadesc: "Voor het ontwerpen en produceren van wielerkleding in een eigen design voor je team, club of bedrijf.",
  },
});
state["event-collectie"] = { id: res.id, link: res.link };
await writeFile(new URL("state.json", root), JSON.stringify(state, null, 2));

// Redirect toevoegen.
const csv = await readFile(new URL("redirects.csv", root), "utf8");
const line = `${OLD}/nl/event-collectie/,https://rondevanrotterdam.nl/nl/event-collectie/,draft`;
if (!csv.includes("event-collectie")) await writeFile(new URL("redirects.csv", root), csv + line + "\n");

console.log(`Event-collectie OK → id ${res.id} | ${items.length} items | status ${res.status}`);
