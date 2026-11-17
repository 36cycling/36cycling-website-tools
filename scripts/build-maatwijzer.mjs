// Maatwijzer: klanten vinden in vier stappen hun maat voor shirt en broek (heren).
// Zet de maatwijzer op /nl/maatwijzer/ en /en/size-finder/: gewone blokken (padnavigatie, kop, inleiding) +
// één blok "Aangepaste HTML" met het script. Er is geen plugin voor; dit is eigen code, in één bestand.
//
// Bron van het script: C:\Claude\maattabellen\maatwijzer\maatwijzer.js (daar ontwikkelen en lokaal testen).
// Dit script kopieert die bron naar wp-root/maatwijzer.js (zodat Git bijhoudt wat er live staat) en zet hem in de pagina's.
//   node scripts/build-maatwijzer.mjs             → bijwerken: vervangt op bestaande pagina's ALLEEN het maatwijzerblok
//   node scripts/build-maatwijzer.mjs --check     → alleen controleren of het script op de live pagina's gelijk is aan de bron
//   node scripts/build-maatwijzer.mjs --sjabloon  → ook kop en tekst terugzetten naar het sjabloon hieronder (alleen op verzoek)
// AFSPRAAK (Jeroen, 16 nov 2026): hij maakt deze pagina's zelf op (geen padnavigatie, kop en tekst gecentreerd). Een update
// blijft dus van alles buiten het maatwijzerblok af: kop, tekst, titel, slug en SEO-velden. Eerder bouwde dit script de hele
// pagina opnieuw op en gooide het zijn opmaak twee keer weg.
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { loadConfig, upsertPage, uploadMedia } from "../lib/wp.mjs";

const CHECK = process.argv.includes("--check");
const SJABLOON = process.argv.includes("--sjabloon");
const BRON = "C:/Claude/maattabellen/maatwijzer/maatwijzer.js";
const ROOT = new URL("..", import.meta.url);
const KOPIE = new URL("wp-root/maatwijzer.js", ROOT);
const STATE = new URL("state.json", ROOT);
const cfg = await loadConfig();
const BASE = cfg.wp.baseUrl.replace(/\/$/, "");
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const state = JSON.parse(await readFile(STATE, "utf8"));

const js = (await readFile(BRON, "utf8")).replace(/\r\n/g, "\n").trim();
// Het script gaat als base64 de pagina in (zie hieronder), dus de inhoud zelf kan WordPress niet raken.
// Deze twee blijven verboden omdat ze een scripttag kunnen afbreken als iemand het ooit weer als gewone tekst plaatst.
for (const [fout, re] of [["</script", /<\/script/i], ["<!--", /<!--/]]) if (re.test(js)) throw new Error(`De bron bevat "${fout}"; dat mag niet in het script staan.`);
// Illustraties voor dames (maatwijzer v0.11, 17 nov 2026): bijgesneden met scripts/maatwijzer-beelden.py dames, in
// media/maatwijzer/ai/. Wat nog niet in de mediabibliotheek staat, wordt hier geüpload (één keer; daarna staat het in
// state.maatonderzoek.beeld, bij de andere illustraties). De maatwijzer verwacht ze op een vast adres; wijkt dat af, dan stopt het script.
const BEELD_BASIS = /const BEELD = [^"]*"([^"]+)"/.exec(js)?.[1];
const DAMES_BEELD = ["bovenlichaam-smal", "bovenlichaam-gemiddeld", "bovenlichaam-breed", "buik-vlak", "buik-gemiddeld", "buik-rond", "pas-race", "pas-strak", "pas-normaal"].map((n) => `dames-${n}`);
if (!CHECK) {
  const beeld = ((state.maatonderzoek ||= {}).beeld ||= {});
  for (const naam of DAMES_BEELD) {
    if (beeld[naam]) continue;
    const bestand = `maatwijzer-${naam}.webp`;
    const m = await uploadMedia(cfg, { filePath: new URL(`media/maatwijzer/ai/${bestand}`, ROOT), filename: bestand, altText: `Illustratie ${naam.replaceAll("-", " ")}`, title: `Maatwijzer ${naam.replaceAll("-", " ")}` });
    beeld[naam] = { id: m.id, url: m.source_url };
    await writeFile(STATE, JSON.stringify(state, null, 2));
    console.log(`media ${naam} → ${m.id} ${m.source_url}`);
  }
  for (const naam of DAMES_BEELD) if (beeld[naam].url !== `${BEELD_BASIS}${naam}.webp`) throw new Error(`Illustratie ${naam} staat op ${beeld[naam].url}, maar de maatwijzer verwacht ${BEELD_BASIS}${naam}.webp`);
}


// Sjabloon voor een NIEUWE pagina (of met --sjabloon): zoals Jeroen de pagina zelf opmaakte: geen padnavigatie, kop en tekst
// gecentreerd. De blokcode is letterlijk die uit zijn eigen versie (back-up van 16 nov), zodat de editor hem geldig vindt.
const h1 = (t, anker) => `<!-- wp:heading {"level":1,"style":{"typography":{"textAlign":"center"}},"fontSize":"x-large","anchor":"${anker}"} -->\n<h1 class="wp-block-heading has-text-align-center has-x-large-font-size" id="${anker}">${t}</h1>\n<!-- /wp:heading -->`;
const paragraph = (t) => `<!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}}} -->\n<p class="has-text-align-center">${t}</p>\n<!-- /wp:paragraph -->`;
// Zo herkennen we het maatwijzerblok in een bestaande pagina.
const BLOK = /<!-- wp:html -->\s*<div class="c36-maatwijzer"[\s\S]*?<!-- \/wp:html -->/;
// Het script staat als base64 in het src-adres van de scripttag. Als gewone tekst in de inhoud maakt WordPress er iets anders van
// (&& wordt &#038;&#038;) en start de maatwijzer niet (gezien op 16 nov 2026). Aan een adres binnen een tag komt WordPress niet.
const B64 = Buffer.from(js, "utf8").toString("base64");
const widget = (lang, zonderJs) => `<!-- wp:html -->\n<div class="c36-maatwijzer" data-lang="${lang}"><noscript>${zonderJs}</noscript></div>\n<script id="c36-maatwijzer-js" src="data:text/javascript;charset=utf-8;base64,${B64}"></script>\n<!-- /wp:html -->`;
const PAGES = {
  nl: {
    slug: "maatwijzer", title: "Maatwijzer", yoast: "Maatwijzer wielerkleding: vind je maat in een minuut",
    desc: "Twijfel je over je maat? Met de maatwijzer van 36 Cycling weet je in vier stappen welke maat shirt en broek je past. Zonder meetlint.",
    zonderJs: "Voor de maatwijzer is JavaScript nodig. Je vindt de maattabel ook bij elk product in de shop.",
    kop: [h1("Maatwijzer", "maatwijzer"), paragraph("Vind in een minuut je maat voor ons shirt en onze broek. Vier korte vragen, zonder meetlint.")],
  },
  en: {
    slug: "size-finder", title: "Size finder", yoast: "Cycling clothing size finder: find your size in a minute",
    desc: "Not sure about your size? The 36 Cycling size finder tells you in four steps which jersey and bib shorts size fits you. No tape measure needed.",
    zonderJs: "The size finder needs JavaScript. You can also find the size chart with every product in the shop.",
    kop: [h1("Size finder", "size-finder"), paragraph("Find your size for our jersey and bib shorts in a minute. Four short questions, no tape measure needed.")],
  },
};

// Staat het script ongeschonden op de live pagina? WordPress en de cache mogen er niets aan veranderen.
async function controleer(lang) {
  const link = state[`maatwijzer-${lang}`]?.link;
  if (!link) return console.log(`${lang}: nog geen pagina`);
  const r = await fetch(`${link}${link.includes("?") ? "&" : "?"}nocache=${Date.now()}`, { headers: { "User-Agent": "Mozilla/5.0 websitecontrole" } });
  const html = await r.text();
  const m = html.match(/<script id="c36-maatwijzer-js"[^>]*src="data:text\/javascript;charset=utf-8;base64,([^"]*)"/);
  const live = m ? Buffer.from(m[1], "base64").toString("utf8") : null;
  let waar = "";
  if (live && live !== js) { let i = 0; while (i < live.length && live[i] === js[i]) i++; waar = ` | eerste verschil op teken ${i}: bron "${js.slice(i, i + 40)}" ↔ live "${live.slice(i, i + 40)}"`; }
  console.log(`${lang}: ${r.status} ${link} | houder: ${html.includes('class="c36-maatwijzer"')} | script: ${live === null ? "NIET GEVONDEN" : live === js ? "gelijk aan de bron" : "WIJKT AF"}${waar} | noindex: ${/<meta name=.robots.[^>]*noindex/.test(html)}`);
}

if (!CHECK) {
  await copyFile(BRON, KOPIE);
  const ids = {};
  for (const [lang, p] of Object.entries(PAGES)) {
    const key = `maatwijzer-${lang}`;
    const id = state[key]?.id;
    const blok = widget(lang, p.zonderJs);
    let res, wat;
    if (id) {
      // Bestaande pagina: alleen het maatwijzerblok vervangen; al het andere blijft zoals het in WordPress staat.
      const cur = await (await fetch(`${BASE}/wp-json/wp/v2/pages/${id}?context=edit&lang=${lang}`, { headers: H })).json();
      await writeFile(new URL(`backups/page-${id}-maatwijzer-${Date.now()}.json`, ROOT), JSON.stringify(cur, null, 2));
      const raw = cur.content.raw;
      if (!BLOK.test(raw)) throw new Error(`pagina ${lang} #${id}: het maatwijzerblok staat er niet (meer) in. Niets gewijzigd; kijk eerst in de editor wat er is veranderd.`);
      const buiten = raw.replace(BLOK, "[BLOK]");
      const content = SJABLOON ? [...p.kop, blok].join("\n\n") : raw.replace(BLOK, () => blok);
      const r = await fetch(`${BASE}/wp-json/wp/v2/pages/${id}?lang=${lang}`, { method: "POST", headers: H, body: JSON.stringify({ content }) });
      res = await r.json();
      if (!r.ok) throw new Error(`pagina ${lang} opslaan mislukt (${r.status}): ${JSON.stringify(res).slice(0, 200)}`);
      const naBuiten = (res.content?.raw || "").replace(BLOK, "[BLOK]");
      wat = SJABLOON ? "kop en tekst teruggezet naar het sjabloon + blok vervangen" : `alleen het blok vervangen; rest ongewijzigd: ${naBuiten === buiten}`;
    } else {
      // Nieuwe pagina: meteen gepubliceerd en vindbaar (akkoord Jeroen 16 nov 2026). Yoast-waarde 0 = standaard = indexeren.
      res = await upsertPage(cfg, {
        title: p.title, slug: p.slug, lang, status: "publish", content: [...p.kop, blok].join("\n\n"),
        meta: { _yoast_wpseo_title: p.yoast, _yoast_wpseo_metadesc: p.desc, "_yoast_wpseo_meta-robots-noindex": "0" },
      });
      wat = "nieuw";
    }
    ids[lang] = res.id;
    state[key] = { id: res.id, link: res.link };
    await writeFile(STATE, JSON.stringify(state, null, 2));
    console.log(`pagina ${lang}: #${res.id} ${res.status} ${res.link} (${wat})`);
  }
  const vert = await (await fetch(`${BASE}/wp-json/c36/v1/translations?element_type=post_page&id=${ids.nl}`, { headers: H })).json();
  if (vert.translations?.en?.element_id !== ids.en) {
    const l = await fetch(`${BASE}/wp-json/c36/v1/link`, { method: "POST", headers: H, body: JSON.stringify({ element_type: "post_page", source_id: ids.nl, translation_id: ids.en, lang: "en", source_lang: "nl" }) });
    console.log("NL- en EN-pagina gekoppeld in WPML:", l.status);
  }
  const URLMAP = new URL("translations/en/urlmap.json", ROOT);
  const map = JSON.parse(await readFile(URLMAP, "utf8"));
  if (map["/nl/maatwijzer/"] !== "/en/size-finder/") { map["/nl/maatwijzer/"] = "/en/size-finder/"; await writeFile(URLMAP, JSON.stringify(map, null, 2)); }
  await new Promise((k) => setTimeout(k, 2000));
}
for (const lang of ["nl", "en"]) await controleer(lang);
