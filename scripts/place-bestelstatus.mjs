// Zet het chatvenster "Waar is mijn bestelling?" in de voettekst van de site (NL-blok 216, EN-blok 7920).
// Het venster zelf komt uit de Teamleader-koppeling op Cloudflare (C:\Claude\teamleader-mcp, src/chat-widget.ts);
// hier staat alleen de ene regel die het script laadt, als blok "Aangepaste HTML" onderaan de voettekst.
//
//   node scripts/place-bestelstatus.mjs            proef: toont wat er zou gebeuren
//   node scripts/place-bestelstatus.mjs --apply    plaatsen of bijwerken (back-up in backups/)
//   node scripts/place-bestelstatus.mjs --remove   weghalen (back-up in backups/)
//
// De rest van de voettekst blijft onaangeroerd: alleen het eigen blok wordt toegevoegd, vervangen of verwijderd.
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../lib/wp.mjs";

const SCRIPT = "https://teamleader-mcp.36cycling.workers.dev/chat/widget.js";
const KLEUR = "#2e4852"; // knopkleur van de site (Blocksy palet 1)
const HOEK = "3"; // afronding van de knoppen op de site
// Linksonder: rechtsonder zit het lipje "Beheer toestemming" van de cookiebalk (Complianz), dat moet vrij blijven.
const POSITIE = "links";
const BLOKKEN = [
  { id: 216, lang: "nl", pagina: "/nl/" },
  { id: 7920, lang: "en", pagina: "/en/" },
];

const APPLY = process.argv.includes("--apply");
const REMOVE = process.argv.includes("--remove");
const ROOT = new URL("..", import.meta.url);
const cfg = await loadConfig();
const BASE = cfg.wp.baseUrl.replace(/\/$/, "");
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };

const blok = (lang) =>
  `<!-- wp:html -->\n<script src="${SCRIPT}" defer data-taal="${lang}" data-positie="${POSITIE}" data-kleur="${KLEUR}" data-hoek="${HOEK}"></script>\n<!-- /wp:html -->`;
// Het eigen blok herkennen we aan het adres van het script.
const EIGEN = /\n*<!-- wp:html -->\s*<script[^>]*\/chat\/widget\.js[^>]*><\/script>\s*<!-- \/wp:html -->/g;

for (const { id, lang, pagina } of BLOKKEN) {
  const r = await fetch(`${BASE}/wp-json/wp/v2/ct_content_block/${id}?context=edit&lang=${lang}`, { headers: H });
  if (!r.ok) throw new Error(`Blok ${id} ophalen mislukt (${r.status})`);
  const cur = await r.json();
  const raw = cur.content.raw;
  const aanwezig = (raw.match(EIGEN) ?? []).length;
  const zonder = raw.replace(EIGEN, "");
  const nieuw = REMOVE ? zonder : `${zonder.replace(/\s+$/, "")}\n\n${blok(lang)}`;

  if (nieuw === raw) { console.log(`${id} (${lang}): al in orde, niets te doen`); continue; }
  const wat = REMOVE ? "weghalen" : aanwezig ? "bijwerken" : "toevoegen";
  // Controle: buiten het eigen blok mag er niets veranderen.
  if (nieuw.replace(EIGEN, "").replace(/\s+$/, "") !== zonder.replace(/\s+$/, "")) throw new Error(`Blok ${id}: de rest van de voettekst zou veranderen, gestopt`);
  if (!APPLY && !REMOVE) { console.log(`${id} (${lang}): zou ${wat} (${raw.length} -> ${nieuw.length} tekens). Draai met --apply.`); continue; }

  await writeFile(new URL(`backups/content-block-${id}-bestelstatus-${Date.now()}.json`, ROOT), JSON.stringify(cur, null, 2));
  const w = await fetch(`${BASE}/wp-json/wp/v2/ct_content_block/${id}?lang=${lang}`, { method: "POST", headers: H, body: JSON.stringify({ content: nieuw }) });
  if (!w.ok) throw new Error(`Blok ${id} opslaan mislukt (${w.status}): ${(await w.text()).slice(0, 200)}`);
  const na = (await (await fetch(`${BASE}/wp-json/wp/v2/ct_content_block/${id}?context=edit&lang=${lang}`, { headers: H })).json()).content.raw;
  const ok = REMOVE ? !EIGEN.test(na) : na.includes(blok(lang));
  console.log(`${id} (${lang}): ${wat} ${ok ? "gelukt" : "NIET gelukt (WordPress heeft de regel aangepast)"}`);

  // Staat het op de site? Met ?nocache om de paginacache te omzeilen.
  const html = await (await fetch(`${BASE}${pagina}?nocache=${Date.now()}`, { headers: { "User-Agent": "Mozilla/5.0 websitecontrole" } })).text();
  console.log(`   op ${pagina}: ${html.includes("/chat/widget.js") ? "script staat in de pagina" : "script staat niet in de pagina"}`);
}
