// Engelse vertaling van pagina's/berichten/herbruikbare blokken (WPML).
//   node scripts/translate-en.mjs extract <nlId> …   → translations/en/<type>-<id>.nl.txt (genummerde NL-segmenten)
//   node scripts/translate-en.mjs apply   <nlId> …   → maakt/werkt EN-concept bij met het vertaalgeheugen, koppelt in WPML.
//                                                      Ontbreken er vertalingen (NL gewijzigd)? Dan komt er een <type>-<id>.todo.txt
//                                                      met alleen de nieuwe NL-teksten; vertaal die in <type>-<id>.todo.en.txt en draai apply opnieuw.
//   node scripts/translate-en.mjs changed            → lijst van NL-items die na hun EN-vertaling zijn gewijzigd.
// Vertaalgeheugen = alle .nl.txt/.en.txt- en .todo.txt/.todo.en.txt-paren samen (NL-tekst → EN-tekst).
// .en.txt-formaat: kopregels "@title: …", "@slug: …", "@yoast_title: …", "@yoast_metadesc: …", "@yoast_focuskw: …",
// daarna per segment "=== n" gevolgd door de Engelse tekst ("=" = gelijk aan NL).
// EN-pagina's worden altijd als concept aangemaakt; een bestaande EN-pagina houdt zijn status.
// LET OP: apply bouwt de EN-pagina opnieuw op vanuit NL — handmatige wijzigingen in de EN-pagina gaan dan verloren.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadConfig } from "../lib/wp.mjs";
import { extractSegments, applyTranslation, makeUrlRewriter } from "../lib/translate.mjs";

const [cmd, ...ids] = process.argv.slice(2);
const cfg = await loadConfig();
const AUTH = { Authorization: "Basic " + Buffer.from(`${cfg.wp.username}:${cfg.wp.appPassword}`).toString("base64") };
const JSONH = { ...AUTH, "Content-Type": "application/json" };
const W = cfg.wp.baseUrl + "/wp-json";
const DIR = new URL("../translations/en/", import.meta.url);
await mkdir(DIR, { recursive: true });
const URLMAP = new URL("urlmap.json", DIR);
const urlMap = existsSync(URLMAP) ? JSON.parse(await readFile(URLMAP, "utf8")) : {};
const YOAST = ["title", "metadesc", "focuskw"];

async function getItem(id) {
  for (const type of ["pages", "posts", "blocks", "ct_content_block"]) {
    const r = await fetch(`${W}/wp/v2/${type}/${id}?context=edit`, { headers: AUTH });
    if (r.ok) return { type, item: await r.json() };
  }
  throw new Error(`#${id} niet gevonden als pagina of bericht`);
}
const KIND = { pages: "page", posts: "post", blocks: "block", ct_content_block: "cblock" };
const EL = { pages: "post_page", posts: "post_post", blocks: "post_wp_block", ct_content_block: "post_ct_content_block" };
const base = (type, id) => `${KIND[type]}-${id}`;
const nlPath = (item) => { const u = new URL(item.link); return u.search ? null : u.pathname; };

function parseEn(text) {
  const head = {}, segs = {};
  const [top, ...blocks] = text.split(/^=== (\d+)[ \t]*$/m);
  for (const line of top.split(/\r?\n/)) { const m = line.match(/^@(\w+):\s?(.*)$/); if (m) head[m[1]] = m[2].trim(); }
  for (let i = 0; i < blocks.length; i += 2) segs[+blocks[i]] = blocks[i + 1].replace(/^\r?\n/, "").replace(/\r?\n$/, "");
  return { head, segs };
}

// EN-termen (categorieën) bij NL-term-id's; termen zonder EN-vertaling vallen weg.
async function enTerms(elementType, ids = []) {
  const out = [];
  for (const id of ids) {
    const r = await fetch(`${W}/c36/v1/translations?element_type=${elementType}&id=${id}`, { headers: AUTH });
    const en = r.ok ? (await r.json()).translations.en?.term_id : null;
    if (en) out.push(en); else console.log(`  ! term #${id} heeft geen Engelse vertaling`);
  }
  return out;
}

// Vertaalgeheugen: NL-tekst → EN-tekst uit alle bestandsparen.
async function loadTM() {
  const tm = {}, files = new Set(await readdir(DIR));
  const pairs = [...files].filter((f) => /\.nl\.txt$/.test(f)).map((f) => [f, f.replace(/\.nl\.txt$/, ".en.txt")])
    .concat([...files].filter((f) => /\.todo\.txt$/.test(f)).map((f) => [f, f.replace(/\.todo\.txt$/, ".todo.en.txt")]));
  for (const [nlf, enf] of pairs) {
    if (!files.has(enf)) continue;
    const nl = parseEn(await readFile(new URL(nlf, DIR), "utf8")).segs, en = parseEn(await readFile(new URL(enf, DIR), "utf8")).segs;
    for (const [n, t] of Object.entries(nl)) if (en[n] !== undefined && en[n] !== "") tm[t] = en[n].trim() === "=" ? t : en[n];
  }
  return tm;
}

async function wpmlTranslations(type, id) {
  const r = await fetch(`${W}/c36/v1/translations?element_type=${EL[type]}&id=${id}`, { headers: AUTH });
  return r.ok ? (await r.json()).translations : {};
}

if (cmd === "extract") {
  for (const id of ids) {
    const { type, item } = await getItem(id);
    if (existsSync(new URL(`${base(type, id)}.en.txt`, DIR))) { console.log(`— ${base(type, id)}: al vertaald; gebruik apply (maakt zo nodig een .todo.txt)`); continue; }
    const segs = extractSegments(item.content.raw);
    const lines = [
      `@title: ${item.title.raw}`, `@slug: ${item.slug}`, `@path: ${nlPath(item) || "(concept)"}`,
      ...YOAST.map((k) => `@yoast_${k}: ${item.meta?.[`_yoast_wpseo_${k}`] || ""}`), "",
      ...segs.flatMap((s, i) => [`=== ${i + 1}`, s]),
    ];
    await writeFile(new URL(`${base(type, id)}.nl.txt`, DIR), lines.join("\n") + "\n");
    console.log(`${base(type, id)}.nl.txt — ${segs.length} segmenten, ${item.title.raw}`);
  }
} else if (cmd === "apply") {
  const rewrite = makeUrlRewriter(urlMap, cfg.wp.baseUrl);
  const tm = await loadTM();
  for (const id of ids) {
    const { type, item } = await getItem(id);
    const b = base(type, id);
    const segs = extractSegments(item.content.raw);
    const { head } = parseEn(await readFile(new URL(`${b}.en.txt`, DIR), "utf8"));
    const map = {};
    const gaps = segs.filter((s) => !(s in tm));
    for (const s of segs) if (s in tm) map[s] = tm[s];
    if (gaps.length) {
      await writeFile(new URL(`${b}.todo.txt`, DIR), gaps.flatMap((s, i) => [`=== ${i + 1}`, s]).join("\n") + "\n");
      console.log(`… ${b}: ${gaps.length} nieuwe/gewijzigde NL-teksten → ${b}.todo.txt (vertaal in ${b}.todo.en.txt en draai apply opnieuw)`);
      continue;
    }
    let { content, missing } = applyTranslation(item.content.raw, map, rewrite);
    if (missing.length) { console.log(`✗ ${b}: ${missing.length} teksten niet gevonden in vertaling:`, missing.slice(0, 3)); continue; }
    // Formulieren: Engelse Fluent Forms-kopie gebruiken (translations/en/forms.json: NL-id → EN-id).
    const FORMS = existsSync(new URL("forms.json", DIR)) ? JSON.parse(await readFile(new URL("forms.json", DIR), "utf8")) : {};
    for (const [nl, en] of Object.entries(FORMS)) {
      content = content
        .replace(new RegExp(`"formId":"${nl}"`, "g"), `"formId":"${en}"`)
        .replace(new RegExp(`\\[fluentform id="${nl}"\\]`, "g"), `[fluentform id="${en}"]`)
        .replace(new RegExp(`fluentform_wrapper_${nl}\\b`, "g"), `fluentform_wrapper_${en}`)
        .replace(new RegExp(`ff_guten_block-${nl}\\b`, "g"), `ff_guten_block-${en}`);
    }
    // Herbruikbare blokken: naar de Engelse versie laten verwijzen.
    for (const ref of new Set([...content.matchAll(/<!-- wp:block \{"ref":(\d+)/g)].map((m) => m[1]))) {
      const en = (await wpmlTranslations("blocks", ref)).en?.element_id;
      if (en) content = content.split(`<!-- wp:block {"ref":${ref}`).join(`<!-- wp:block {"ref":${en}`);
      else console.log(`  ! herbruikbaar blok #${ref} heeft nog geen Engelse versie`);
    }

    // EN-ouder = vertaling van de NL-ouder.
    let parent = 0;
    if (item.parent) {
      parent = (await wpmlTranslations(type, item.parent)).en?.element_id || 0;
      if (!parent) { console.log(`✗ ${b}: NL-ouder #${item.parent} heeft nog geen Engelse vertaling — die eerst`); continue; }
    }
    const existing = (await wpmlTranslations(type, id)).en?.element_id;
    const body = {
      title: head.title, ...(["blocks", "ct_content_block"].includes(type) ? {} : { slug: head.slug }), content, parent: type === "pages" ? parent : undefined,
      meta: Object.fromEntries(YOAST.filter((k) => head[`yoast_${k}`] !== undefined).map((k) => [`_yoast_wpseo_${k}`, head[`yoast_${k}`]])),
      ...(type === "posts" ? { featured_media: item.featured_media, categories: await enTerms("tax_category", item.categories) } : type === "pages" ? { template: item.template } : {}),
      // Herbruikbare blokken zijn zelf niet zichtbaar; gepubliceerd nodig om in (concept)pagina's te tonen.
      ...(existing ? {} : { status: ["blocks", "ct_content_block"].includes(type) ? "publish" : "draft" }),
    };
    const r = await fetch(`${W}/wp/v2/${type}${existing ? "/" + existing : ""}?lang=en`, { method: "POST", headers: JSONH, body: JSON.stringify(body) });
    const res = await r.json();
    if (!r.ok) { console.log(`✗ ${b}: opslaan mislukt ${r.status} ${res.message || ""}`); continue; }
    if (!existing) {
      const l = await fetch(`${W}/c36/v1/link`, { method: "POST", headers: JSONH, body: JSON.stringify({ element_type: EL[type], source_id: id, translation_id: res.id, lang: "en", source_lang: "nl" }) });
      if (!l.ok) console.log(`  ! koppelen mislukt: ${l.status} ${(await l.text()).slice(0, 150)}`);
    }
    // Pad bijhouden voor interne links in volgende pagina's.
    const p = nlPath(item);
    if (p && head.path_en) urlMap[p] = head.path_en;
    console.log(`✓ ${b} → EN #${res.id} (${res.status}) slug "${res.slug}"${existing ? " bijgewerkt" : " aangemaakt"} | ${head.title}`);
  }
  await writeFile(URLMAP, JSON.stringify(urlMap, null, 2));
} else if (cmd === "changed") {
  // NL-items met EN-vertaling die na de laatste EN-update zijn gewijzigd.
  const files = (await readdir(DIR)).filter((f) => /^(page|post|block)-\d+\.en\.txt$/.test(f));
  for (const f of files) {
    const [, kind, id] = f.match(/^(page|post|block)-(\d+)/);
    const type = { page: "pages", post: "posts", block: "blocks" }[kind];
    const nl = await (await fetch(`${W}/wp/v2/${type}/${id}?context=edit&_fields=modified_gmt,slug`, { headers: AUTH })).json();
    const enId = (await wpmlTranslations(type, id)).en?.element_id;
    if (!enId) continue;
    const en = await (await fetch(`${W}/wp/v2/${type}/${enId}?context=edit&_fields=modified_gmt`, { headers: AUTH })).json();
    if (nl.modified_gmt > en.modified_gmt) console.log(`${id}	${kind}	${nl.slug}	NL gewijzigd ${nl.modified_gmt} (EN ${en.modified_gmt})`);
  }
} else {
  console.log("Gebruik: extract|apply|changed <nlId> …");
}
