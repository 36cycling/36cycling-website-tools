// Maakt het chatvenster "Waar is mijn bestelling?" vindbaar op de site (wens Jeroen, 18 nov 2026):
//   1. een pagina /nl/waar-is-mijn-bestelling/ en /en/where-is-my-order/ met korte uitleg; het chatvenster
//      opent daar vanzelf (de kop heeft het anker "bestelstatus-openen", daar let het venster op);
//   2. een menu-item onder Contact (NL-menu 28, EN-menu 225) naar die pagina;
//   3. een knop op de contactpagina (NL 18, EN 6512) boven het adres, die het venster opent (link #bestelstatus).
// Het venster zelf staat in de Teamleader-koppeling (C:\Claude\teamleader-mcp); de laadregel in de voettekst
// zet scripts/place-bestelstatus.mjs.
//
//   node scripts/build-bestelstatus.mjs            proef: toont wat er zou gebeuren
//   node scripts/build-bestelstatus.mjs --apply    voert door (back-ups in backups/)
//   node scripts/build-bestelstatus.mjs --apply --sjabloon   zet ook de tekst van de pagina's terug naar dit script
//
// Opnieuw draaien is veilig: wat er al staat, blijft staan. Een bestaande pagina wordt zonder --sjabloon niet
// aangeraakt, en op de contactpagina wordt alleen de eigen knop toegevoegd.
import { readFile, writeFile } from "node:fs/promises";
import { loadConfig, upsertPage } from "../lib/wp.mjs";

const APPLY = process.argv.includes("--apply");
const SJABLOON = process.argv.includes("--sjabloon");
const ROOT = new URL("..", import.meta.url);
const STATE = new URL("state.json", ROOT);
const cfg = await loadConfig();
const BASE = cfg.wp.baseUrl.replace(/\/$/, "");
const H = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64"), "Content-Type": "application/json" };
const state = JSON.parse(await readFile(STATE, "utf8"));
const wacht = (ms) => new Promise((k) => setTimeout(k, ms));
async function call(method, path, body) {
  const r = await fetch(`${BASE}/wp-json${path}`, { method, headers: H, body: body && JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { throw new Error(`${method} ${path} -> ${r.status}: geen JSON (${t.slice(0, 80).replace(/\s+/g, " ")})`); }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
const backup = (naam, data) => writeFile(new URL(`backups/${naam}-${Date.now()}.json`, ROOT), JSON.stringify(data, null, 2));

// ------------------------------------------------------------------ teksten

const T = {
  nl: {
    slug: "waar-is-mijn-bestelling", titel: "Waar is mijn bestelling?", anker: "#bestelstatus",
    yoast: "Waar is mijn bestelling? Bestelstatus opzoeken",
    desc: "Zoek zelf op wanneer je bestelling van 36 Cycling komt. Met je e-mailadres en postcode zie je meteen de status.",
    intro: "Zoek zelf op wanneer je bestelling komt. Je hebt alleen je e-mailadres en je postcode nodig.",
    knop: "Bestelstatus opzoeken",
    kop1: "Zo werkt het",
    stappen: ["Vul het e-mailadres in waarmee je hebt besteld.", "Vul de postcode van je factuur- of bezorgadres in.", "Je ziet meteen wanneer je hebt besteld en wanneer je bestelling komt."],
    werkt: "Het werkt voor bestellingen in onze webshop en in de webshop van je club of bedrijf.",
    kop2: "Waar vind ik de knop?",
    waar: "Linksonder op elke pagina van deze website staat de knop <strong>Waar is mijn bestelling?</strong> Op je telefoon is dat een vierkant knopje met een doosje. Staat de cookiemelding nog in beeld, maak dan eerst je keuze; de knop zit daaronder.",
    hulp: 'Kom je er niet uit? Mail naar <a href="mailto:info@36cycling.com">info@36cycling.com</a> of bel <a href="tel:+31182232008">0182 – 232 008</a>.',
    contactknop: "Waar is mijn bestelling?",
  },
  en: {
    slug: "where-is-my-order", titel: "Where is my order?", anker: "#order-status",
    yoast: "Where is my order? Check your order status",
    desc: "Look up when your 36 Cycling order will arrive. Enter your email address and postcode to see the status straight away.",
    intro: "Look up when your order will arrive. All you need is your email address and your postcode.",
    knop: "Look up order status",
    kop1: "How it works",
    stappen: ["Enter the email address you used for your order.", "Enter the postcode of your billing or delivery address.", "You will see straight away when you ordered and when your order will arrive."],
    werkt: "It works for orders from our webshop and from the webshop of your club or company.",
    kop2: "Where is the button?",
    waar: "At the bottom left of every page of this website you will find the button <strong>Where is my order?</strong> On your phone it is a small square button with a box icon. If the cookie notice is still showing, make your choice first; the button is underneath it.",
    hulp: 'Need help? Email <a href="mailto:info@36cycling.com">info@36cycling.com</a> or call <a href="tel:+31182232008">+31 (0)182 232 008</a>.',
    contactknop: "Where is my order?",
  },
};

const p = (tekst, midden) =>
  midden
    ? `<!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}}} -->\n<p class="has-text-align-center">${tekst}</p>\n<!-- /wp:paragraph -->`
    : `<!-- wp:paragraph -->\n<p>${tekst}</p>\n<!-- /wp:paragraph -->`;
const h2 = (tekst) => `<!-- wp:heading -->\n<h2 class="wp-block-heading">${tekst}</h2>\n<!-- /wp:heading -->`;

function paginaInhoud(t) {
  return [
    // De kop draagt het anker waar het chatvenster op let: op deze pagina opent het vanzelf.
    `<!-- wp:heading {"level":1,"style":{"typography":{"textAlign":"center"},"spacing":{"margin":{"top":"0","bottom":"0"}}},"fontSize":"x-large","anchor":"bestelstatus-openen"} -->\n<h1 class="wp-block-heading has-text-align-center has-x-large-font-size" id="bestelstatus-openen" style="margin-top:0;margin-bottom:0">${t.titel}</h1>\n<!-- /wp:heading -->`,
    p(t.intro, true),
    `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->\n<div class="wp-block-buttons"><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${t.anker}">${t.knop}</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->`,
    `<!-- wp:group {"layout":{"type":"constrained","contentSize":"620px"}} -->\n<div class="wp-block-group">${[
      h2(t.kop1),
      `<!-- wp:list {"ordered":true} -->\n<ol class="wp-block-list">${t.stappen.map((s) => `<!-- wp:list-item -->\n<li>${s}</li>\n<!-- /wp:list-item -->`).join("\n\n")}</ol>\n<!-- /wp:list -->`,
      p(t.werkt),
      h2(t.kop2),
      p(t.waar),
      p(t.hulp),
    ].join("\n\n")}</div>\n<!-- /wp:group -->`,
  ].join("\n\n");
}

// ------------------------------------------------------------------ 1. pagina's

const ids = {};
for (const lang of ["nl", "en"]) {
  const t = T[lang];
  const key = `bestelstatus-${lang}`;
  const id = state[key]?.id;
  if (id && !SJABLOON) { ids[lang] = id; console.log(`pagina ${lang}: bestaat al (#${id} ${state[key].link}), niet aangeraakt`); continue; }
  if (!APPLY) { console.log(`pagina ${lang}: zou ${id ? "de tekst terugzetten van" : "aanmaken:"} /${lang}/${t.slug}/ "${t.titel}"`); continue; }
  if (id) await backup(`page-${id}-bestelstatus`, await call("GET", `/wp/v2/pages/${id}?context=edit&lang=${lang}`));
  const res = await upsertPage(cfg, {
    id, title: t.titel, slug: t.slug, lang, status: "publish", content: paginaInhoud(t),
    meta: { _yoast_wpseo_title: t.yoast, _yoast_wpseo_metadesc: t.desc, "_yoast_wpseo_meta-robots-noindex": "0" },
  });
  ids[lang] = res.id;
  state[key] = { id: res.id, link: res.link };
  await writeFile(STATE, JSON.stringify(state, null, 2));
  console.log(`pagina ${lang}: #${res.id} ${res.status} ${res.link} (${id ? "tekst teruggezet" : "nieuw"})`);
}
if (APPLY && ids.nl && ids.en) {
  const vert = await call("GET", `/c36/v1/translations?element_type=post_page&id=${ids.nl}`);
  if (vert.translations?.en?.element_id !== ids.en) {
    const l = await fetch(`${BASE}/wp-json/c36/v1/link`, { method: "POST", headers: H, body: JSON.stringify({ element_type: "post_page", source_id: ids.nl, translation_id: ids.en, lang: "en", source_lang: "nl" }) });
    console.log("NL- en EN-pagina gekoppeld in WPML:", l.status);
  } else console.log("NL- en EN-pagina zijn al gekoppeld in WPML");
  const URLMAP = new URL("translations/en/urlmap.json", ROOT);
  const map = JSON.parse(await readFile(URLMAP, "utf8"));
  if (map[`/nl/${T.nl.slug}/`] !== `/en/${T.en.slug}/`) { map[`/nl/${T.nl.slug}/`] = `/en/${T.en.slug}/`; await writeFile(URLMAP, JSON.stringify(map, null, 2)); }
}

// ------------------------------------------------------------------ 2. menu-item onder Contact

// contact = het menu-item Contact; opmaakVan = hoofditem waarvan het eerste subitem zijn Blocksy-opmaak leent.
const MENUS = [
  { lang: "nl", menu: 28, contact: 943, opmaakVan: 1984 },
  { lang: "en", menu: 225, contact: 7917, opmaakVan: 7884 },
];
for (const m of MENUS) {
  const t = T[m.lang];
  const items = await call("GET", `/wp/v2/menu-items?menus=${m.menu}&per_page=100&context=edit&lang=${m.lang}`);
  const contact = items.find((i) => i.id === m.contact);
  if (!contact) throw new Error(`${m.lang}: menu-item Contact #${m.contact} niet gevonden`);
  const pagina = ids[m.lang] ?? state[`bestelstatus-${m.lang}`]?.id;
  if (pagina && items.some((i) => i.object === "page" && i.object_id === pagina && i.parent === contact.id)) { console.log(`menu ${m.lang}: staat al onder Contact`); continue; }
  const onder = (id) => items.filter((i) => i.parent === id).flatMap((i) => [i, ...onder(i.id)]);
  const plek = Math.max(contact.menu_order, ...onder(contact.id).map((i) => i.menu_order)) + 1;
  const schuiven = items.filter((i) => i.menu_order >= plek).sort((a, b) => b.menu_order - a.menu_order);
  const voorbeeld = items.filter((i) => i.parent === m.opmaakVan).sort((a, b) => a.menu_order - b.menu_order)[0];
  console.log(`menu ${m.lang}: "${t.titel}" komt onder Contact op plek ${plek}; ${schuiven.length} item(s) schuiven op (${schuiven.map((i) => i.title.rendered).join(", ") || "geen"}); opmaak van "${voorbeeld?.title.rendered ?? "geen voorbeeld"}"`);
  if (!APPLY) continue;
  if (!pagina) throw new Error(`${m.lang}: de pagina bestaat nog niet`);
  await backup(`menu-${m.menu}-before-bestelstatus`, items);
  for (const i of schuiven) { await call("POST", `/wp/v2/menu-items/${i.id}?lang=${m.lang}`, { menu_order: i.menu_order + 1 }); await wacht(120); }
  const nieuw = await call("POST", `/wp/v2/menu-items?lang=${m.lang}`, {
    title: t.titel, menus: m.menu, parent: contact.id, menu_order: plek, type: "post_type", object: "page", object_id: pagina, status: "publish",
  });
  console.log(`menu ${m.lang}: item #${nieuw.id} aangemaakt -> ${nieuw.url}`);
  if (voorbeeld) {
    const meta = await fetch(`${BASE}/wp-json/c36/v1/copy-meta`, { method: "POST", headers: H, body: JSON.stringify({ from: voorbeeld.id, to: nieuw.id }) });
    console.log(`menu ${m.lang}: Blocksy-opmaak overgenomen van #${voorbeeld.id}: ${meta.status} ${JSON.stringify((await meta.json()).copied || [])}`);
  }
  const na = (await call("GET", `/wp/v2/menu-items?menus=${m.menu}&per_page=100&context=edit&lang=${m.lang}`)).sort((a, b) => a.menu_order - b.menu_order);
  const dubbel = na.filter((i, n) => n && i.menu_order === na[n - 1].menu_order).length;
  const pos = na.findIndex((i) => i.id === nieuw.id);
  console.log(`menu ${m.lang}: ${na.length} items, dubbele plekken: ${dubbel}, buren: "${na[pos - 1]?.title.rendered}" <- "${na[pos].title.rendered}" -> "${na[pos + 1]?.title.rendered}"`);
}

// ------------------------------------------------------------------ 3. knop op de contactpagina

// De contactpagina heeft het adres twee keer: links naast het formulier (desktop) en in een eigen rij eronder
// (tablet en telefoon, waar de linkerkolom verborgen is). De knop komt op beide plekken boven het adres.
const CONTACT = [{ id: 18, lang: "nl" }, { id: 6512, lang: "en" }];
const KNOP = /<!-- wp:buttons \{"className":"c36-bestelstatus-knop"[\s\S]*?<!-- \/wp:buttons -->\n*/g;
const knop = (t, marge) => {
  const stijl = marge ? `,"style":{"spacing":{"margin":{"bottom":"${marge}"}}}` : "";
  return `<!-- wp:buttons {"className":"c36-bestelstatus-knop"${stijl}} -->\n<div class="wp-block-buttons c36-bestelstatus-knop"${marge ? ` style="margin-bottom:${marge}"` : ""}><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${t.anker}">${t.contactknop}</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->\n\n`;
};
for (const c of CONTACT) {
  const t = T[c.lang];
  const cur = await call("GET", `/wp/v2/pages/${c.id}?context=edit&lang=${c.lang}`);
  const raw = cur.content.raw;
  if ((raw.match(KNOP) ?? []).length >= 2) { console.log(`contactpagina ${c.lang}: de knop staat er al (${raw.match(KNOP).length}x)`); continue; }
  const zonder = raw.replace(KNOP, "");
  // Plek 1: begin van de linkerkolom, vlak voor de alinea met het adres.
  const a1 = '"><!-- wp:paragraph -->\n<p><strong>36 Cycling</strong>';
  // Plek 2: vlak voor het tekstblok met het adres in de rij voor tablet en telefoon.
  const a2 = zonder.match(/<!-- wp:greenshift-blocks\/text \{[^\n]*?"textContent":"\\u003cstrong\\u003e36 Cycling/);
  if (zonder.split(a1).length !== 2 || !a2 || zonder.split(a2[0]).length !== 2) throw new Error(`contactpagina ${c.lang}: de twee plekken boven het adres zijn niet eenduidig gevonden; niets gewijzigd`);
  const nieuw = zonder
    .replace(a1, () => `">${knop(t, "")}${a1.slice(2)}`)
    .replace(a2[0], () => `${knop(t, "24px")}${a2[0]}`);
  if (nieuw.replace(KNOP, "") !== zonder) throw new Error(`contactpagina ${c.lang}: buiten de knop zou er iets veranderen; niets gewijzigd`);
  console.log(`contactpagina ${c.lang}: knop "${t.contactknop}" komt boven het adres, op 2 plekken (${raw.length} -> ${nieuw.length} tekens)`);
  if (!APPLY) continue;
  await backup(`page-${c.id}-bestelstatus-knop`, cur);
  const res = await call("POST", `/wp/v2/pages/${c.id}?lang=${c.lang}`, { content: nieuw });
  const na = res.content?.raw ?? "";
  console.log(`contactpagina ${c.lang}: opgeslagen; knop ${(na.match(KNOP) ?? []).length}x aanwezig; rest ongewijzigd: ${na.replace(KNOP, "") === zonder}`);
}
if (!APPLY) console.log("\nProef: er is niets gewijzigd. Draai met --apply om door te voeren.");
