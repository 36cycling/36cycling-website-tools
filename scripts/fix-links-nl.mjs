// Herstelt lege (#) knoppen/links, oude-domein-links en een paar tekstfouten op NL-pagina's.
// Past blok-attributen (Greenshift buttonLink/textContent) én HTML consistent aan. Backup per pagina in backups/.
import { loadConfig } from "../lib/wp.mjs";
import { tokens, encodeAttrs, applyTranslation, visible } from "../lib/translate.mjs";
import { writeFile, mkdir } from "node:fs/promises";

const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const W = cfg.wp.baseUrl + "/wp-json/wp/v2";
const DRY = process.argv.includes("--dry");
await mkdir(new URL("../backups/", import.meta.url), { recursive: true });

const OFFERTE = "/nl/offerteaanvraag/", ONTWERPEN = "/nl/wielerkleding-ontwerpen/", TOOL = "https://designer.36cycling.com/";
const CONTACT = "/nl/contact/", BEDRUKKEN = "/nl/wielerkleding-bedrukken/", SPORT = "/nl/sportkleding-bedrukken/";
const a = (href, text) => [`<a href="#">${text}</a>`, `<a href="${href}">${text}</a>`];

// Per item: buttons = Greenshift-knoppen {tekst: [href per voorkomen]}, segs = segment-vervangingen (tekst/inline links/core-knoppen),
// anchors = {koptekst: anker}, urls = {oude url: nieuwe url}, removeContainerLinks, meta = Yoast.
const FIXES = {
  "pages/2": { // Home
    buttons: { "Offerte aanvragen": [OFFERTE], "Start je ontwerp": [TOOL], "Laat ons ontwerpen": [ONTWERPEN + "#laat-ons-ontwerpen"] },
    segs: Object.fromEntries([
      a(BEDRUKKEN + "#bedrijven", "Wielerkleding voor bedrijven"), a(BEDRUKKEN + "#clubs", "Wielerkleding voor clubs &amp; teams"),
      a(SPORT, "Sportkleding"),
      ["Laat je het liever aan onze designers over? <br>Wij doen het graag! <a href=\"#\">Stuur een berichtje</a>", `Laat je het liever aan onze designers over? <br>Wij doen het graag! <a href="${CONTACT}">Stuur een berichtje</a>`],
    ]),
  },
  "pages/6280": { // Wielerkleding bedrukken
    buttons: { "Vraag een offerte aan": [OFFERTE], "Start je design": [ONTWERPEN, TOOL] },
    segs: Object.fromEntries([
      a("#bedrijven", "Wielerkleding voor bedrijven"), a("#clubs", "Wielerkleding voor clubs &amp; teams"), a(OFFERTE, "Vraag een offerte aan"),
      ["<strong>Laat je het liever aan onze designers over? </strong><br><strong>Wij doen het graag!</strong><br><a href=\"#\">Stuur een berichtje</a>", `<strong>Laat je het liever aan onze designers over? </strong><br><strong>Wij doen het graag!</strong><br><a href="${CONTACT}">Stuur een berichtje</a>`],
    ]),
    anchors: { "Fietskleding bedrukken met logo voor bedrijven en sponsors": "bedrijven", "Teamkleding voor clubs en vriendenteams": "clubs" },
  },
  "pages/6430": { // Sportkleding bedrukken
    buttons: { "Vraag een offerte aan": [OFFERTE], "Start je design": [ONTWERPEN, TOOL] },
    segs: {
      '<a href="#">Wielerkleding voor bedrijven</a>': '<a href="#teams-en-bedrijven">Sportkleding voor bedrijven</a>',
      '<a href="#">Wielerkleding voor clubs &amp; teams</a>': '<a href="#teams-en-bedrijven">Sportkleding voor clubs &amp; teams</a>',
      '<a href="#">Wielerkleding bedrukken</a>': `<a href="${BEDRUKKEN}">Wielerkleding bedrukken</a>`,
      "Veelgestelde vragen over wielerkleding bedrukken": "Veelgestelde vragen over sportkleding bedrukken",
      "<strong>Laat je het liever aan onze designers over? </strong><br><strong>Wij doen het graag!</strong><br><a href=\"#\">Stuur een berichtje</a>": `<strong>Laat je het liever aan onze designers over? </strong><br><strong>Wij doen het graag!</strong><br><a href="${CONTACT}">Stuur een berichtje</a>`,
    },
    anchors: { "Eigen sportkleding voor teams en bedrijven": "teams-en-bedrijven" },
    removeContainerLinks: true,
  },
  "pages/6346": { // Wielerkleding ontwerpen: plaatshouders
    segs: {
      "Ons designteam maakt een ontwerp op maat. Reken op [X werkdagen].": "Ons designteam maakt een ontwerp op maat. Binnen een paar werkdagen heb je het in je mail.",
      "Je ziet een digitale 3D-proef en geeft feedback. Inclusief [X] ontwerprondes.": "Je ziet een digitale 3D-proef en geeft feedback. We passen het aan tot het klopt.",
    },
  },
  "pages/1980": { meta: { _yoast_wpseo_metadesc: "Wielershirt bedrukken of wielerkleding ontwerpen? Bij 36 Cycling ontwerp je custom teamkleding met onze 3D-tool. Vanaf 5 stuks, levering in 3 tot 5 weken. Vraag gratis offerte aan." } },
  "pages/18": { urls: { "https://www.36cycling.com/nl/shop/": "/nl/shop/", "https://www.36cycling.com/nl/wielerkleding/": BEDRUKKEN } },
  "pages/939": { urls: { "https://www.36cycling.com/nl/wielerkleding/teamkleding-collectie/": "/nl/teamkleding-collectie/" } },
  "posts/2077": {}, // fietskleding-in-de-herfst: id wordt hieronder opgezocht
};

// Story met oude shop-links: id opzoeken en url-tabel vullen.
const story = (await (await fetch(`${W}/posts?slug=fietskleding-in-de-herfst&lang=nl&_fields=id`, { headers: AUTH })).json())[0];
delete FIXES["posts/2077"];
if (story) FIXES[`posts/${story.id}`] = {
  urlRe: [[/^\/nl\/fietskleding\//, "/nl/categorie/fietskleding/"], [/^\/nl\/shop\/\d+\/([^/]+)\/$/, "/nl/shop/$1/"]],
};

function fixContent(raw, f, log) {
  let out = raw;
  // 1. Segment-vervangingen (tekst + inline links + core-knoppen), in attributen én HTML.
  if (f.segs) {
    const r = applyTranslation(out, f.segs);
    const done = Object.keys(f.segs).filter((k) => !r.missing.includes(k) && raw.includes(k.replace(/&amp;/g, "&amp;")));
    out = r.content; log.push(`tekst/links: ${Object.keys(f.segs).length} regels`);
  }
  // 2. Greenshift-knoppen: buttonLink + href, op volgorde van voorkomen.
  const seen = {};
  const toks = tokens(out);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!t.json) continue;
    let attrs; try { attrs = JSON.parse(t.json); } catch { continue; }
    let changed = false;
    if (f.buttons && t.name === "greenshift-blocks/buttonbox" && f.buttons[attrs.buttonContent] && (!attrs.buttonLink || attrs.buttonLink === "#")) {
      const n = (seen[attrs.buttonContent] = (seen[attrs.buttonContent] || 0) + 1);
      const list = f.buttons[attrs.buttonContent], href = list[Math.min(n, list.length) - 1];
      attrs.buttonLink = href; changed = true;
      if (/^https?:/.test(href)) attrs.linkNewWindow = true;
      // HTML van dit blok: eerste href="#" erna.
      for (let j = i + 1; j < toks.length; j++) {
        if (toks[j].html !== undefined && toks[j].html.includes('href="#"')) {
          toks[j].html = toks[j].html.replace('href="#"', /^https?:/.test(href) ? `href="${href}" target="_blank" rel="noopener"` : `href="${href}"`);
          break;
        }
        if (toks[j].comment?.startsWith("<!-- /wp:greenshift-blocks/buttonbox")) break;
      }
      log.push(`knop "${attrs.buttonContent}" → ${href}`);
    }
    if (f.removeContainerLinks && t.name === "greenshift-blocks/container" && attrs.containerLink === "#") {
      delete attrs.containerLink; changed = true;
      const nxt = toks[i + 1];
      if (nxt?.html !== undefined) nxt.html = nxt.html.replace('<a class="gspb-containerlink" href="#" rel="noopener"></a>', "");
      log.push("lege kaart-link verwijderd");
    }
    if (f.anchors && t.name === "core/heading") {
      const nxt = toks[i + 1];
      const txt = nxt?.html ? visible(nxt.html) : "";
      const anchor = f.anchors[txt];
      if (anchor && attrs.anchor !== anchor) {
        const old = attrs.anchor; attrs.anchor = anchor; changed = true;
        nxt.html = old ? nxt.html.replace(`id="${old}"`, `id="${anchor}"`) : nxt.html.replace(/<h(\d)\b/, `<h$1 id="${anchor}"`);
        log.push(`anker "${anchor}" op kop "${txt}"`);
      }
    }
    if (changed) t.comment = t.comment.replace(t.json, encodeAttrs(attrs));
  }
  out = toks.map((t) => (t.html !== undefined ? t.html : t.comment)).join("");
  // 3. Oude urls.
  for (const [from, to] of Object.entries(f.urls || {})) {
    const n = out.split(from).length - 1; if (n) { out = out.split(from).join(to); log.push(`${n}× ${from} → ${to}`); }
  }
  for (const [re, to] of f.urlRe || []) {
    out = out.replace(/href="([^"]+)"/g, (m, u) => { const v = u.replace(re, to); if (v !== u) { log.push(`${u} → ${v}`); return `href="${v}"`; } return m; });
  }
  return out;
}

for (const [key, f] of Object.entries(FIXES)) {
  const item = await (await fetch(`${W}/${key}?context=edit`, { headers: AUTH })).json();
  const log = [];
  const content = fixContent(item.content.raw, f, log);
  const body = {};
  if (content !== item.content.raw) body.content = content;
  if (f.meta) { body.meta = f.meta; log.push("meta-omschrijving"); }
  if (!Object.keys(body).length) { console.log(`— ${key} ${item.slug}: niets veranderd`); continue; }
  await writeFile(new URL(`../backups/${key.replace("/", "-")}-${Date.now()}.json`, import.meta.url), JSON.stringify({ content: item.content.raw, meta: item.meta }, null, 1));
  if (!DRY) {
    const r = await fetch(`${W}/${key}`, { method: "POST", headers: { ...AUTH, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { console.log(`✗ ${key}: ${r.status} ${(await r.text()).slice(0, 150)}`); continue; }
  }
  console.log(`✓ ${key} ${item.slug}${DRY ? " (proef)" : ""}\n   ` + log.join("\n   "));
}
