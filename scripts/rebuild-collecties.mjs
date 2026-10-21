// Herbouw team- en sportkleding-collectie met de volledige oude content:
// H2-indeling per categorie, volledige productbeschrijvingen, "Customize it!" (team)
// en een H1 met het oude zoekwoord. Grid-stijl blijft (streepje, klikbare foto's).
import { load } from "cheerio";
import { loadConfig, upsertPage } from "../lib/wp.mjs";
import { loadMediaMap, ensureMedia, blocks } from "../lib/build.mjs";
import { readFile } from "node:fs/promises";

const OLD = "https://www.36cycling.com";
const root = new URL("..", import.meta.url);
const R = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const cfg = await loadConfig();
const map = await loadMediaMap();
const state = await R("state.json");
const oldCol = await R("audit/old-collecties.json");
const { heading, paragraph, list, image, buttons, gridColumn, columns, breadcrumbs } = blocks;

const descBySlug = (col) => Object.fromEntries(oldCol[col].filter((i) => i.href).map((i) => [i.href.split("/").filter(Boolean).pop(), i.desc]));

async function card(col, slug) {
  const file = col === "teamkleding-collectie" ? `pages/${slug}.json` : `pages/${col}/${slug}.json`;
  const page = await R(file);
  const href = `/nl/${col}/${slug}/`;
  const media = map[page.image.src.split("?")[0]];
  const desc = descBySlug(col)[slug] || load(`<div>${page.contentHtml}</div>`)("p").first().text().trim();
  return gridColumn([image(media, href), heading(page.headings.h1, 3, { size: "medium" }), paragraph(desc), buttons([{ text: "Meer info", href }])].join("\n\n"));
}
// Rijen van 3; een onvolledige rij wordt aangevuld met lege kolommen zodat kaarten niet uitrekken.
// Lege kolommen zijn op mobiel verborgen (Blocksy ct-hidden-sm = <690px), anders geven ze witruimte.
const emptyCol = `<!-- wp:column {"className":"ct-hidden-sm"} -->
<div class="wp-block-column ct-hidden-sm"></div>
<!-- /wp:column -->`;
const padRow = (cards) => columns([...cards, ...Array(3 - cards.length).fill(emptyCol)]);
const rowsOf3 = async (col, slugs, extra = []) => {
  const all = [...(await Promise.all(slugs.map((s) => card(col, s)))), ...extra];
  const out = [];
  for (let i = 0; i < all.length; i += 3) out.push(padRow(all.slice(i, i + 3)));
  return out;
};

// ---------- Teamkleding ----------
const T = "teamkleding-collectie";
const teamHero = map["https://www.36cycling.com/media/ebllqp1r/wielerkleding-assortiment.jpg"];
const customize = [
  heading("Customize it!", 3, { size: "medium" }),
  paragraph("Alle <em>Team Wear</em> items zijn te ontwerpen naar je eigen idee. Bij customized wielerkleding denk je waarschijnlijk in de eerste plaats aan het bedrukken van de kleding, maar er is meer mogelijk. De beschreven shirts zijn voorbeelden om je keuze makkelijker te maken, maar de verschillende eigenschappen zijn ook uitwisselbaar of toe te voegen aan je basiskeuze. Denk bijvoorbeeld aan:"),
  list(["lange/korte rits", "Gel gripper", "Boordjes met gel spots", "extra zakje met rits", "Flatlock stiksels"]),
  paragraph("We adviseren je graag om tot de perfecte outfit te komen."),
  paragraph("Onder het label <strong>LAB36</strong> ontwikkelen we voortdurend aan onze wielerkleding. Materialen, creatieve ideeën, nieuwe modellen, etc. Het Elite shirt is een resultaat hiervan."),
];
const toolGif = map[Object.keys(map).find((k) => k.includes("ontwerp-je-wielershirt"))];
// Ontwerpkaart alleen op tablet/desktop (vult daar de lege plek in de rij); op mobiel verborgen.
const hideOnMobile = (col) => col.replace("<!-- wp:column {", "<!-- wp:column {\"className\":\"ct-hidden-sm\",").replace("<div class=\"wp-block-column\"", "<div class=\"wp-block-column ct-hidden-sm\"");
const designCard = hideOnMobile(gridColumn([
  image(toolGif, "/nl/wielerkleding-ontwerpen/"),
  heading("Ontwerp je eigen wielershirt", 3, { size: "medium" }),
  paragraph("Kies een model en ontwerp je shirt zelf in onze 3D-ontwerptool, of laat ons designteam het ontwerp maken. Gratis en vrijblijvend."),
  buttons([{ text: "Start met ontwerpen", href: "/nl/wielerkleding-ontwerpen/" }]),
].join("\n\n")));
// Bovenkant (hero, breadcrumbs, knoppennavigatie tussen collecties, intro) is door de
// gebruiker opgemaakt en staat vast in pages/collectie-headers/ — nooit zelf genereren.
const headerOf = async (slug) => (await readFile(new URL(`pages/collectie-headers/${slug}.html`, root), "utf8")).trim();
const teamContent = [
  await headerOf(T),
  heading("Wielershirts", 2),
  ...(await rowsOf3(T, ["wielershirt-prestige", "wielershirt-prestige-flow", "wielershirt-flow", "wielershirt-cadans", "wielershirt-classic"], [designCard])),
  heading("Wielerbroeken", 2),
  ...(await rowsOf3(T, ["wielerbroek-elite", "wielerbroek-speed", "wielerbroek-totalgrip", "wielerbroek-classic", "lange-wielerbroek", "warming-up-broek"])),
  heading("Jacks", 2),
  ...(await rowsOf3(T, ["all-season-jack", "lange-mouw-extreme", "winter-thermo-jack", "windjack-elaspin", "windjack-skin", "windjack-montreal"])),
  heading("Skinsuits en triatlonpakken", 2),
  ...(await rowsOf3(T, ["skinsuit-performance", "skinsuit-criterium", "triatlonpak"])),
  heading("Accessoires en vrijetijdskleding", 2),
  ...(await rowsOf3(T, ["armstukken", "beenstukken", "wintermuts", "bandana", "team-polo", "leisure-jack"])),
].join("\n\n");

// Op deze pagina toont het thema de paginatitel als H1 → titel met het oude zoekwoord.
const teamRes = await upsertPage(cfg, { id: state[T].id, title: "Teamkleding collectie: custom wielerkleding", slug: T, content: teamContent, lang: "nl" });
console.log(`✓ ${T} → ${teamRes.status} | ${teamContent.length} tekens`);

// ---------- Sportkleding ----------
const S = "sportkleding-collectie";
const sportContent = [
  await headerOf(S),
  heading("Sportshirts, broeken, jacks", 2),
  ...(await rowsOf3(S, ["running-shirt-extreme", "running-shirt-coolmax", "running-shirt-rudy", "voetbalshirt-sportshirt", "singlet-extreme", "singlet-rudy", "voetbalbroek-sportbroek", "running-shorts", "running-tight", "leisure-jacket", "leisure-jacket-winter", "wintermuts"])),
  heading("Schaatskleding", 2),
  ...(await rowsOf3(S, ["schaatspak-lycra", "schaatspak-winter", "warming-up-broek", "all-season-jack", "winter-thermojack", "salopette"])),
].join("\n\n");
const sportRes = await upsertPage(cfg, { id: state[S].id, title: "Sportkleding collectie", slug: S, content: sportContent, lang: "nl" });
console.log(`✓ ${S} → ${sportRes.status} | ${sportContent.length} tekens`);
