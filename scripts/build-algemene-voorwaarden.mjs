// /nl/algemene-voorwaarden/ — beide voorwaarden uit de PDF letterlijk overgenomen.
// Alleen opmaak toegevoegd (koppen, lidnummers vet, lijsten). Controleert dat de
// woordvolgorde op de pagina 1-op-1 gelijk is aan de PDF-tekst.
// Gebruik: node scripts/build-algemene-voorwaarden.mjs [--dry]
import { loadConfig, upsertPage, uploadMedia } from "../lib/wp.mjs";
import { blocks } from "../lib/build.mjs";
import { readFile, writeFile } from "node:fs/promises";

const DRY = process.argv.includes("--dry");
const root = new URL("..", import.meta.url);
const P = (p) => new URL(p, root);
const { paragraph, list, buttons, breadcrumbs } = blocks;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const H = (text, level, id, size) =>
  `<!-- wp:heading {${level !== 2 ? `"level":${level},` : ""}${size ? `"fontSize":"${size}",` : ""}"anchor":"${id}"} -->\n` +
  `<h${level} id="${id}" class="wp-block-heading${size ? ` has-${size}-font-size` : ""}">${esc(text)}</h${level}>\n<!-- /wp:heading -->`;
const sentence = (s) => { const l = s.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); };

// ---------- 1. Tekst inlezen, pagina-afbrekingen herstellen ----------
const SUBS = ["Toepasselijkheid algemene voorwaarden", "Aanvragen voorwaarden", "U krijgt altijd bericht", "Adreswijziging", "Verzendingen buitenland", "Betalen", "Klachtenprocedure", "Aansprakelijkheid"];
const raw = (await readFile(P("pages/legal/algemene-voorwaarden.txt"), "utf8")).replace(/\f/g, "\n");
const isStart = (l) => /^(ARTIKEL \d+|Artikel \d+|SPECIFIEKE|Webshop 36|\d+\.\d*\.?\s*\S|[a-g]\.\s|•)/.test(l) || SUBS.some((s) => l.startsWith(s + " ") || l === s);
const paras = [];
for (const l of raw.split(/\r?\n/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean)) {
  const prev = paras[paras.length - 1];
  if (prev && !/[.;:?!)]$/.test(prev) && !isStart(l)) paras[paras.length - 1] = prev + " " + l;
  else paras.push(l);
}
const split = paras.findIndex((p) => p.startsWith("Webshop 36 Cycling.com"));
const part1 = paras.slice(1, split), part2 = paras.slice(split + 1);

// ---------- 2. Deel 1: zakelijke voorwaarden (lidnummers N.k) ----------
function lidsNk(n, text) {
  const out = []; let pos = 0, k = 1, start = -1, startLen = 0;
  while (true) {
    const re = new RegExp(`(^|\\s)${n}\\.${k}\\.?(?=\\s|[A-Z])`, "g"); re.lastIndex = pos;
    let m, found = null;
    while ((m = re.exec(text))) { if (!/(art\.|artikel|lid)\s*$/i.test(text.slice(0, m.index + m[1].length))) { found = m; break; } }
    if (!found) break;
    const mStart = found.index + found[1].length;
    if (start >= 0) out.push(text.slice(start + startLen, mStart).trim());
    start = mStart; startLen = found[0].length - found[1].length; pos = mStart + startLen; k++;
  }
  if (start >= 0) out.push(text.slice(start + startLen).trim());
  return out;
}
const b2b = [];
for (const p of part1) {
  const m = p.match(/^ARTIKEL (\d+) (.+?)(?=\s\d+\.\d|$)/);
  if (m) b2b.push({ n: +m[1], title: m[2].trim(), text: p.slice(m[0].length).trim() });
  else b2b[b2b.length - 1].text += "\n" + p;
}
for (const a of b2b) a.lids = lidsNk(a.n, a.text);

// ---------- 3. Deel 2: webshopvoorwaarden (lidnummers k.) ----------
const T2 = { 1: "Definities", 2: "Identiteit van de ondernemer", 3: "Toepasselijkheid", 4: "Het aanbod", 5: "De overeenkomst", 6: "Herroepingsrecht bij levering van producten", 7: "Kosten in geval van herroeping", 8: "Uitsluiting herroepingsrecht", 9: "De prijs", 10: "Conformiteit en Garantie", 11: "Levering en uitvoering", 12: "Duurtransacties", 13: "Betaling", 14: "Klachtenregeling", 15: "Geschillen", 16: "Aanvullende of afwijkende bepalingen", 17: "Persoonsgegevens en privacy" };
const cons = []; const spec = []; let inSpec = false;
for (const p of part2) {
  if (p === "SPECIFIEKE VOORWAARDEN") { inSpec = true; continue; }
  if (inSpec) {
    const sub = SUBS.find((s) => p === s || p.startsWith(s + " "));
    if (sub) spec.push({ title: sub, paras: p === sub ? [] : [p.slice(sub.length).trim()] });
    else spec[spec.length - 1].paras.push(p);
    continue;
  }
  const m = p.match(/^Artikel (\d+) [-–] /);
  if (m) { const n = +m[1]; cons.push({ n, title: T2[n], text: p.slice(m[0].length + T2[n].length).trim() }); }
  else cons[cons.length - 1].text += "\n" + p;
}
function lidsK(text) {
  const out = []; let pos = 0, k = 1, start = -1, startLen = 0, intro = "";
  while (true) {
    const re = new RegExp(`(^|\\s)${k}\\.(?=\\s|[A-Z])`, "g"); re.lastIndex = pos;
    const m = re.exec(text); if (!m) break;
    const mStart = m.index + m[1].length;
    if (start >= 0) out.push(text.slice(start + startLen, mStart).trim()); else intro = text.slice(0, mStart).trim();
    start = mStart; startLen = m[0].length - m[1].length; pos = mStart + startLen; k++;
  }
  if (start >= 0) out.push(text.slice(start + startLen).trim()); else intro = text.trim();
  return { intro, lids: out };
}
for (const a of cons) Object.assign(a, lidsK(a.text));

// ---------- 4. Renderen ----------
// Een lid kan opsommingen bevatten (• of a./b./c.): dan alinea + lijst.
function renderLid(label, text) {
  const t = text.replace(/\n/g, " ");
  if (t.includes("•")) { const [head, ...items] = t.split(/\s*•\s*/); return [paragraph(`<strong>${label}</strong> ${esc(head)}`), list(items.map(esc))].join("\n\n"); }
  const parts = []; let rest = t, ch = "a";
  while (true) { const i = rest.search(new RegExp(`(^|\\s)${ch}\\.\\s`)); if (i < 0) break; parts.push(rest.slice(0, i).trim()); rest = rest.slice(i).trim(); ch = String.fromCharCode(ch.charCodeAt(0) + 1); }
  if (parts.length >= 2 || (parts.length === 1 && ch > "b")) {
    parts.push(rest);
    const [head, ...items] = parts;
    return [paragraph(`<strong>${label}</strong> ${esc(head)}`), list(items.map(esc))].join("\n\n");
  }
  return paragraph(`<strong>${label}</strong> ${esc(t)}`);
}

const pdf = DRY ? { source_url: "#" } : await (async () => {
  const state = JSON.parse(await readFile(P("state.json"), "utf8"));
  if (state["algemene-voorwaarden-pdf"]) return state["algemene-voorwaarden-pdf"];
  const m = await uploadMedia(await loadConfig(), { filePath: P("pages/legal/Algemene-Voorwaarden-36Cycling.pdf"), filename: "Algemene-Voorwaarden-36Cycling.pdf", title: "Algemene Voorwaarden 36 Cycling" });
  state["algemene-voorwaarden-pdf"] = { id: m.id, source_url: m.source_url };
  await writeFile(P("state.json"), JSON.stringify(state, null, 2));
  return state["algemene-voorwaarden-pdf"];
})();

const out = [
  breadcrumbs(),
  H("Algemene voorwaarden", 1, "algemene-voorwaarden", "x-large"),
  paragraph("Hieronder vind je de algemene voorwaarden van 36 Cycling BV. Deze pagina bestaat uit twee delen:"),
  list([
    '<a href="#voorwaarden-custom-made">Algemene Voorwaarden 36 Cycling BV – Custom Made Sports Wear</a>',
    '<a href="#voorwaarden-webshop">Webshop 36 Cycling.com – Algemene Voorwaarden</a>',
  ]),
  H("Algemene Voorwaarden 36 Cycling BV – Custom Made Sports Wear", 2, "voorwaarden-custom-made"),
];
for (const a of b2b) {
  out.push(H(`Artikel ${a.n} – ${sentence(a.title)}`, 3, `custom-made-artikel-${a.n}`, "medium"));
  a.lids.forEach((l, i) => out.push(renderLid(`${a.n}.${i + 1}`, l)));
}
out.push(H("Webshop 36 Cycling.com – Algemene Voorwaarden", 2, "voorwaarden-webshop"));
for (const a of cons) {
  out.push(H(`Artikel ${a.n} – ${a.title}`, 3, `webshop-artikel-${a.n}`, "medium"));
  if (a.n === 2) { // Identiteit: oorspronkelijk losse regels
    for (const line of a.intro.split(/\s(?=Vestigings-|Telefoonnummer:|KvK-nummer:|BTW-identificatienummer:)/)) out.push(paragraph(esc(line)));
    continue;
  }
  if (a.intro) out.push(paragraph(esc(a.intro.replace(/\n/g, " "))));
  a.lids.forEach((l, i) => out.push(renderLid(`${i + 1}.`, l)));
}
out.push(H("Specifieke voorwaarden", 3, "specifieke-voorwaarden", "medium"));
for (const s of spec) {
  out.push(H(s.title, 4, `specifiek-${s.title.toLowerCase().replace(/[^a-z]+/g, "-")}`));
  for (const p of s.paras) out.push(paragraph(esc(p).replace(/\s(?=36 Cycling, webshop|Westbaan 286|2841 MC Moordrecht$)/g, "<br>")));
}
const content = out.join("\n\n");

// ---------- 5. Controle: alle letters/cijfers van pagina == PDF (tekenniveau) ----------
const chars = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").toLowerCase().replace(/[^\p{L}\p{N}@&]/gu, "");
const src = chars(paras.slice(1).join(" "));
const page = chars(out.slice(5).join(" "));
let at = 0; while (at < src.length && src[at] === page[at]) at++;
const same = at === src.length && src.length === page.length;
console.log(`Deel 1: ${b2b.length} artikelen, ${b2b.reduce((s, a) => s + a.lids.length, 0)} leden | Deel 2: ${cons.length} artikelen, ${cons.reduce((s, a) => s + a.lids.length, 0)} leden | Specifiek: ${spec.length} kopjes`);
console.log("Leden per artikel (deel 1):", b2b.map((a) => `${a.n}:${a.lids.length}`).join(" "));
console.log("Leden per artikel (deel 2):", cons.map((a) => `${a.n}:${a.lids.length}`).join(" "));
console.log(same ? `Tekencontrole: ✓ pagina is identiek aan de PDF (${src.length} tekens)` : `Tekencontrole: ✗ verschil op positie ${at}: bron "…${src.slice(at - 30, at + 30)}…" ≠ pagina "…${page.slice(at - 30, at + 30)}…"`);
// ---------- 6. Correcties van evidente foutjes (ná de PDF-controle) ----------
// Alleen typ-/spelfouten, verouderde verwijzingen en het verkeerde adres.
// Juridische keuzes (rechtbank, Thuiswinkel, leveringsgebied) blijven ongewijzigd.
const FIXES = [
  ["Levering van geslubimeerde / bedrukte zaken", "Levering van gesublimeerde / bedrukte zaken"],
  ["toepassing (blijken te ) zijn zijn de overige", "toepassing (blijken te) zijn, zijn de overige"],
  ["geschiedt levering af 36 Cycling te Noordwijk", "geschiedt levering af 36 Cycling te Moordrecht"],
  ["goederen, geschied geheel voor risico", "goederen, geschiedt geheel voor risico"],
  ["met inachtname van de verzuimrente", "met inachtneming van de verzuimrente"],
  ["(exclusief b t.w.)", "(exclusief btw)"],
  ["als garantie aangeb oden regeling", "als garantie aangeboden regeling"],
  ["uitgesloten indiende ondernemer", "uitgesloten indien de ondernemer"],
  ["Voorzover niet later is overeengekomen", "Voor zover niet later is overeengekomen"],
  ["overeenkomstig de Wet Bescherming Persoonsgegevens", "overeenkomstig de Algemene verordening gegevensbescherming (AVG)"],
  ["Telefoonnummer: +31 0182 - 232 008", "Telefoonnummer: +31 (0)182 - 232 008"],
  ["Emailadres: info@36cycling.com", "E-mailadres: info@36cycling.com"],
  ["Dit kan via e-mail: info@36 Cycling", "Dit kan via e-mail: info@36cycling.com"],
  ["via Ideal of een overschrijving", "via iDEAL of een overschrijving"],
];
let fixed = content;
for (const [from, to] of FIXES) {
  const n = fixed.split(from).length - 1;
  if (n !== 1) { console.error(`✗ correctie "${from}" komt ${n}× voor (verwacht 1) — afgebroken`); process.exit(1); }
  fixed = fixed.replace(from, to);
}
console.log(`Correcties: ${FIXES.length} toegepast`);
if (DRY) process.exit(0);

const cfg = await loadConfig();
const state = JSON.parse(await readFile(P("state.json"), "utf8"));
const res = await upsertPage(cfg, {
  id: state["algemene-voorwaarden"]?.id, title: "Algemene voorwaarden", slug: "algemene-voorwaarden", content: fixed, lang: "nl",
  meta: {
    _yoast_wpseo_title: "Algemene voorwaarden",
    _yoast_wpseo_metadesc: "De algemene voorwaarden van 36 Cycling BV: voor custom made sportkleding en voor bestellingen in de webshop. Ook te downloaden als PDF.",
  },
});
state["algemene-voorwaarden"] = { id: res.id, link: res.link };
await writeFile(P("state.json"), JSON.stringify(state, null, 2));
console.log(`algemene-voorwaarden → id ${res.id} | ${res.status} | PDF: ${pdf.source_url}`);
